// Verifica se o usuário logado tem assinatura ativa na Stripe.
// Usado a cada login pra liberar/bloquear acesso ao space.kera.
// IMPORTANTE: a senha é compartilhada porque o backend de auth é o mesmo —
// aqui apenas decidimos se o usuário pode ENTRAR, baseado na Stripe.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Map opcional: nickname/lookup_key da Stripe → plan_tier interno do space.
// Qualquer assinatura ativa libera acesso, mesmo que não esteja no map (cai em 'pro').
const PLAN_MAP: Record<string, string> = {
  essencial: "essencial",
  pro: "pro",
  master: "master",
};

function inferTierFromPrice(priceObj: any): string {
  const candidates = [
    priceObj?.lookup_key,
    priceObj?.nickname,
    priceObj?.metadata?.plan_tier,
    priceObj?.product?.metadata?.plan_tier,
    priceObj?.product?.name,
  ];
  for (const c of candidates) {
    if (!c || typeof c !== "string") continue;
    const k = c.toLowerCase();
    for (const [needle, tier] of Object.entries(PLAN_MAP)) {
      if (k.includes(needle)) return tier;
    }
  }
  return "pro"; // fallback genérico — assinatura ativa = pelo menos pro
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;
    const email = user.email;

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Admin sempre passa, ignorando Stripe.
    const { data: roleRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleRow) {
      return new Response(JSON.stringify({
        allowed: true, reason: "admin", plan_tier: "admin",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Sem chave Stripe → não conseguimos validar. Retorna estado degradado.
    if (!STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({
        allowed: false,
        reason: "stripe_not_configured",
        message: "STRIPE_SECRET_KEY ainda não foi configurada no backend.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!email) {
      return new Response(JSON.stringify({
        allowed: false, reason: "no_email",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1) Acha cliente na Stripe pelo e-mail.
    const customersResp = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=10`,
      { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } },
    );
    if (!customersResp.ok) {
      const txt = await customersResp.text();
      return new Response(JSON.stringify({
        allowed: false, reason: "stripe_error",
        message: `Stripe ${customersResp.status}: ${txt.slice(0, 200)}`,
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const customersJson = await customersResp.json();
    const customers: any[] = customersJson.data ?? [];

    if (customers.length === 0) {
      return new Response(JSON.stringify({
        allowed: false, reason: "no_customer", email,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2) Procura assinatura ativa em qualquer um dos customers.
    let activeSub: any = null;
    for (const c of customers) {
      const subsResp = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${c.id}&status=all&limit=10&expand[]=data.items.data.price.product`,
        { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } },
      );
      if (!subsResp.ok) continue;
      const subsJson = await subsResp.json();
      const subs: any[] = subsJson.data ?? [];
      const found = subs.find((s) => s.status === "active" || s.status === "trialing");
      if (found) { activeSub = found; break; }
    }

    if (!activeSub) {
      return new Response(JSON.stringify({
        allowed: false, reason: "no_active_subscription", email,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const price = activeSub.items?.data?.[0]?.price;
    const planTier = inferTierFromPrice(price);

    // Cacheia no profiles pra admin/UI usarem sem reconsultar.
    await adminClient
      .from("profiles")
      .update({ plan_tier: planTier, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    return new Response(JSON.stringify({
      allowed: true,
      reason: "active_subscription",
      plan_tier: planTier,
      status: activeSub.status,
      current_period_end: activeSub.current_period_end,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({
      allowed: false, reason: "exception",
      error: e instanceof Error ? e.message : String(e),
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});