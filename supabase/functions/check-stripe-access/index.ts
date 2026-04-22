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

type SourceResult = {
  allowed: boolean;
  source: "stripe" | "mercadopago";
  plan_tier?: string;
  status?: string;
  reason?: string;
  message?: string;
};

async function checkStripe(email: string, key: string | undefined): Promise<SourceResult> {
  if (!key) return { allowed: false, source: "stripe", reason: "stripe_not_configured" };
  try {
    const customersResp = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=10`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    if (!customersResp.ok) {
      const txt = await customersResp.text();
      return { allowed: false, source: "stripe", reason: "stripe_error", message: `${customersResp.status}: ${txt.slice(0,200)}` };
    }
    const customers: any[] = (await customersResp.json()).data ?? [];
    if (customers.length === 0) return { allowed: false, source: "stripe", reason: "no_customer" };

    for (const c of customers) {
      const subsResp = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${c.id}&status=all&limit=10&expand[]=data.items.data.price.product`,
        { headers: { Authorization: `Bearer ${key}` } },
      );
      if (!subsResp.ok) continue;
      const subs: any[] = (await subsResp.json()).data ?? [];
      const found = subs.find((s) => s.status === "active" || s.status === "trialing");
      if (found) {
        const price = found.items?.data?.[0]?.price;
        return { allowed: true, source: "stripe", plan_tier: inferTierFromPrice(price), status: found.status };
      }
    }
    return { allowed: false, source: "stripe", reason: "no_active_subscription" };
  } catch (e) {
    return { allowed: false, source: "stripe", reason: "stripe_exception", message: e instanceof Error ? e.message : String(e) };
  }
}

async function checkMercadoPago(email: string, admin: any): Promise<SourceResult> {
  try {
    // Lê do cache local (alimentado pelo webhook mp-webhook).
    const { data, error } = await admin
      .from("mp_subscriptions")
      .select("status, plan_tier, next_payment_date")
      .ilike("email", email)
      .in("status", ["authorized", "approved"])
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) return { allowed: false, source: "mercadopago", reason: "mp_query_error", message: error.message };
    if (!data || data.length === 0) return { allowed: false, source: "mercadopago", reason: "no_active_subscription" };
    const row = data[0];
    return { allowed: true, source: "mercadopago", plan_tier: row.plan_tier ?? "pro", status: row.status };
  } catch (e) {
    return { allowed: false, source: "mercadopago", reason: "mp_exception", message: e instanceof Error ? e.message : String(e) };
  }
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
    if (!email) {
      return new Response(JSON.stringify({
        allowed: false, reason: "no_email",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Consulta Stripe + Mercado Pago em paralelo. Qualquer um ativo libera.
    const stripePromise = checkStripe(email, STRIPE_SECRET_KEY);
    const mpPromise = checkMercadoPago(email, adminClient);
    const [stripeRes, mpRes] = await Promise.all([stripePromise, mpPromise]);

    // Prioriza o que estiver ativo. Se ambos, fica com o de maior tier.
    const tierRank: Record<string, number> = { essencial: 1, pro: 2, master: 3 };
    const candidates = [stripeRes, mpRes].filter((r) => r.allowed);
    if (candidates.length > 0) {
      candidates.sort((a, b) => (tierRank[b.plan_tier ?? ""] ?? 0) - (tierRank[a.plan_tier ?? ""] ?? 0));
      const winner = candidates[0];
      await adminClient
        .from("profiles")
        .update({ plan_tier: winner.plan_tier, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      return new Response(JSON.stringify({
        allowed: true,
        reason: `active_subscription:${winner.source}`,
        plan_tier: winner.plan_tier,
        status: winner.status,
        sources: { stripe: stripeRes, mercadopago: mpRes },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Nenhum ativo. Retorna o motivo mais informativo.
    const reason =
      stripeRes.reason === "stripe_not_configured" && mpRes.reason !== "no_active_subscription"
        ? mpRes.reason
        : stripeRes.reason ?? mpRes.reason ?? "no_active_subscription";

    return new Response(JSON.stringify({
      allowed: false,
      reason,
      email,
      sources: { stripe: stripeRes, mercadopago: mpRes },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({
      allowed: false, reason: "exception",
      error: e instanceof Error ? e.message : String(e),
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});