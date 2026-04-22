// Webhook do Mercado Pago.
// Recebe notificações de preapproval (assinaturas) e payments,
// busca o detalhe na API do MP e grava em public.mp_subscriptions.
// Status considerado "ativo": "authorized" (preapproval) ou "approved" (payment).
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Map nickname/reason do MP -> tier interno.
function inferTier(reason: string | null | undefined, amount: number | null): string {
  const r = (reason ?? "").toLowerCase();
  // Planos KeraFit (treinador)
  if (r.includes("business")) return "business";
  if (r.includes("scale")) return "scale";
  if (r.includes("growth")) return "growth";
  // Planos legados Kera
  if (r.includes("master")) return "master";
  if (r.includes("essencial") || r.includes("essential")) return "essencial";
  if (r.includes("pro")) return "pro";
  // fallback por valor (KeraFit: 99 / 147 / 187)
  if (amount && amount >= 180) return "business";
  if (amount && amount >= 140) return "scale";
  if (amount && amount >= 90) return "growth";
  if (amount && amount > 0) return "essencial";
  return "pro";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

    if (!MP_TOKEN) {
      return new Response(JSON.stringify({ ok: false, error: "MERCADOPAGO_ACCESS_TOKEN não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const url = new URL(req.url);
    let body: any = {};
    try { body = await req.json(); } catch { /* MP às vezes manda só query */ }

    // Extrai tipo + id do evento (MP manda em formatos variados).
    const type =
      body?.type ?? body?.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
    const dataId =
      body?.data?.id ?? body?.id ?? url.searchParams.get("id") ?? url.searchParams.get("data.id");

    if (!type || !dataId) {
      return new Response(JSON.stringify({ ok: true, ignored: "missing type/id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers = { Authorization: `Bearer ${MP_TOKEN}` };

    // Caso 1: preapproval (assinatura recorrente)
    if (String(type).includes("preapproval") || String(type) === "subscription_preapproval") {
      const r = await fetch(`https://api.mercadopago.com/preapproval/${dataId}`, { headers });
      if (!r.ok) {
        const t = await r.text();
        return new Response(JSON.stringify({ ok: false, error: `MP ${r.status}: ${t.slice(0,200)}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const pre = await r.json();
      const email: string = pre?.payer_email ?? "";
      const status: string = pre?.status ?? "unknown"; // authorized|paused|cancelled|pending
      const reason: string = pre?.reason ?? null;
      const amount: number = pre?.auto_recurring?.transaction_amount ?? null;
      const currency: string = pre?.auto_recurring?.currency_id ?? null;
      const next: string = pre?.next_payment_date ?? null;
      const planTier = inferTier(reason, amount);

      if (!email) {
        return new Response(JSON.stringify({ ok: false, error: "preapproval sem payer_email" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await admin.from("mp_subscriptions").upsert({
        email,
        payer_id: pre?.payer_id ? String(pre.payer_id) : null,
        preapproval_id: String(pre.id),
        status,
        plan_tier: planTier,
        reason,
        amount,
        currency,
        next_payment_date: next,
        raw: pre,
        updated_at: new Date().toISOString(),
      }, { onConflict: "preapproval_id" });

      return new Response(JSON.stringify({ ok: true, kind: "preapproval", status, email }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Caso 2: payment avulso (não-recorrente). Marca como ativo enquanto approved.
    if (String(type) === "payment") {
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, { headers });
      if (!r.ok) {
        const t = await r.text();
        return new Response(JSON.stringify({ ok: false, error: `MP ${r.status}: ${t.slice(0,200)}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const pay = await r.json();
      const email: string = pay?.payer?.email ?? "";
      const status: string = pay?.status ?? "unknown"; // approved|pending|rejected|refunded
      const reason: string = pay?.description ?? null;
      const amount: number = pay?.transaction_amount ?? null;
      const currency: string = pay?.currency_id ?? null;
      const planTier = inferTier(reason, amount);

      if (!email) {
        return new Response(JSON.stringify({ ok: false, error: "payment sem email" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Para payment avulso usamos `payment:<id>` como preapproval_id sintético.
      await admin.from("mp_subscriptions").upsert({
        email,
        payer_id: pay?.payer?.id ? String(pay.payer.id) : null,
        preapproval_id: `payment:${pay.id}`,
        status: status === "approved" ? "authorized" : status, // normaliza pra checagem
        plan_tier: planTier,
        reason,
        amount,
        currency,
        next_payment_date: null,
        raw: pay,
        updated_at: new Date().toISOString(),
      }, { onConflict: "preapproval_id" });

      return new Response(JSON.stringify({ ok: true, kind: "payment", status, email }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, ignored: type }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});