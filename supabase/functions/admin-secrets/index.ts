// Painel admin pra gerenciar secrets de webservice via Supabase Management API.
// SOMENTE admin (has_role). Lista/seta/testa.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Lista branca dos secrets que esse painel pode tocar. Nada fora daqui é gerenciável.
const ALLOWED = new Set([
  "ATENDE_WS_USER",
  "ATENDE_WS_PASS",
  "ATENDE_WS_BASE_URL",
  "GOVDIGITAL_USER",
  "GOVDIGITAL_PASS",
  "GOVDIGITAL_BASE_URL",
]);

const PROJECT_REF = "ytixqgkzqgeoxrbmjqbo";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ACCESS_TOKEN = Deno.env.get("SUPABASE_ACCESS_TOKEN"); // opcional

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleData, error: roleErr } = await adminClient
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (roleErr || !roleData) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (action === "list") {
      // Não retorna valores. Só diz quais estão configurados.
      const status: Record<string, boolean> = {};
      for (const name of ALLOWED) {
        const v = Deno.env.get(name);
        status[name] = !!v && v.length > 0;
      }
      return new Response(JSON.stringify({ ok: true, status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "set") {
      const name = String(body.name ?? "");
      const value = String(body.value ?? "");
      if (!ALLOWED.has(name)) {
        return new Response(JSON.stringify({ error: "secret name not allowed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (value.length < 1 || value.length > 4096) {
        return new Response(JSON.stringify({ error: "value out of range" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!SUPABASE_ACCESS_TOKEN) {
        return new Response(JSON.stringify({
          error: "SUPABASE_ACCESS_TOKEN não configurado. Adicione esse secret no Lovable Cloud pra permitir gravação programática. Enquanto isso, cadastre o secret manualmente em Cloud → Secrets.",
          requires_manual: true,
          secret_name: name,
        }), { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/secrets`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify([{ name, value }]),
      });
      if (!r.ok) {
        const txt = await r.text();
        return new Response(JSON.stringify({ error: `management api ${r.status}: ${txt.slice(0, 300)}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true, name, note: "Pode levar até 60s pra propagar nas edge functions." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "test_atende") {
      const user = Deno.env.get("ATENDE_WS_USER") ?? "";
      const pass = Deno.env.get("ATENDE_WS_PASS") ?? "";
      const base = Deno.env.get("ATENDE_WS_BASE_URL") ?? "https://guaramirim.atende.net/?pg=services&service=WPTProcessoDigital";
      if (!user || !pass) {
        return new Response(JSON.stringify({ ok: false, error: "ATENDE_WS_USER/PASS não configurados" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://atende.net/wsdl">
  <soapenv:Header><ws:Autenticacao><usuario>${user}</usuario><senha>${pass}</senha></ws:Autenticacao></soapenv:Header>
  <soapenv:Body><ws:listarOperacoes/></soapenv:Body>
</soapenv:Envelope>`;
      const r = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "text/xml; charset=UTF-8", "SOAPAction": "listarOperacoes" },
        body: envelope,
      });
      const txt = await r.text();
      return new Response(JSON.stringify({
        ok: r.ok, http_status: r.status, response_preview: txt.slice(0, 800),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
