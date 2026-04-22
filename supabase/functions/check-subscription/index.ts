// Endpoint PÚBLICO consumido pelo app.kera.ia.br (e qualquer outro app Kera).
// Recebe um e-mail e retorna se a assinatura no Mercado Pago está ativa,
// junto com o plano e a data do próximo pagamento.
//
// Uso:
//   GET  /functions/v1/check-subscription?email=fulano@x.com
//   POST /functions/v1/check-subscription   { "email": "fulano@x.com" }
//
// Resposta:
//   { active: boolean, plan_tier: string|null, status: string|null,
//     next_payment_date: string|null, source: 'mp'|'none' }
//
// Esta função NÃO exige JWT — é consultada por outros sistemas.
// Não vaza dados sensíveis: só retorna o status agregado da assinatura.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const ACTIVE_STATUSES = new Set(["authorized", "approved", "active"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let email = url.searchParams.get("email") ?? "";
    if (!email && req.method === "POST") {
      try {
        const body = await req.json();
        email = String(body?.email ?? "");
      } catch { /* ignore */ }
    }
    email = email.trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ active: false, error: "email inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Pega a assinatura mais recente desse e-mail
    const { data, error } = await admin
      .from("mp_subscriptions")
      .select("status, plan_tier, next_payment_date, updated_at")
      .ilike("email", email)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ active: false, error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!data) {
      return new Response(JSON.stringify({
        active: false, plan_tier: null, status: null,
        next_payment_date: null, source: "none",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const active = ACTIVE_STATUSES.has(String(data.status).toLowerCase());

    return new Response(JSON.stringify({
      active,
      plan_tier: data.plan_tier,
      status: data.status,
      next_payment_date: data.next_payment_date,
      source: "mp",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({
      active: false, error: e instanceof Error ? e.message : String(e),
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});