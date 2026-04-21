// SpaceInCloud sync — valida se o usuário tem assinatura Growth ativa no
// app SpaceInCloud (parceiro Kera FIT) e libera o pacote FIT no profile.
//
// Fluxo:
//   1. O usuário envia email + senha da conta SpaceInCloud dele.
//   2. Fazemos signIn no Supabase do SpaceInCloud pra pegar um access_token.
//   3. Chamamos a edge function `validate-kera-access` deles com esse token.
//   4. Se retornar plano Growth ativo, marcamos `spaceincloud_active=true`.
//
// Endpoints públicos do SpaceInCloud (anon key, ok no código):
const SIC_URL = "https://eaaxuixnugocazqzhthz.supabase.co";
const SIC_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhYXh1aXhudWdvY2F6cXpodGh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyODI2MTQsImV4cCI6MjA4Nzg1ODYxNH0.ns1DBunwAmc9RW8N_S5yWmbGMyAvQPBuqdkS3l5i7u0";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ValidateResponse = {
  active?: boolean;
  plan?: string;
  user_id?: string;
  email?: string;
  [k: string]: unknown;
};

function isGrowthActive(data: ValidateResponse): boolean {
  if (data?.active === true) return true;
  const plan = String(data?.plan ?? "").toLowerCase();
  if (plan.includes("growth")) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Autentica o usuário Kera
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // 2. Body: email + senha do SpaceInCloud (opcional — se não vier, só lê cache)
    let email: string | null = null;
    let password: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        email = typeof body?.email === "string" ? body.email.trim() : null;
        password = typeof body?.password === "string" ? body.password : null;
      } catch {
        // sem body — modo "check status"
      }
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Modo "só consultar status atual"
    if (!email || !password) {
      const { data: profile } = await admin
        .from("profiles")
        .select("spaceincloud_active, spaceincloud_external_id, spaceincloud_synced_at")
        .eq("user_id", userId)
        .maybeSingle();
      return new Response(
        JSON.stringify({
          active: !!profile?.spaceincloud_active,
          source: "cached",
          externalId: profile?.spaceincloud_external_id ?? null,
          syncedAt: profile?.spaceincloud_synced_at ?? null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Login no Supabase do SpaceInCloud
    const sicClient = createClient(SIC_URL, SIC_ANON);
    const { data: sicAuth, error: sicErr } = await sicClient.auth.signInWithPassword({
      email,
      password,
    });

    if (sicErr || !sicAuth?.session?.access_token) {
      console.warn("[spaceincloud-sync] login fail", sicErr?.message);
      return new Response(
        JSON.stringify({
          active: false,
          error: "Não foi possível entrar no SpaceInCloud. Verifique email e senha.",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sicToken = sicAuth.session.access_token;
    const sicUserId = sicAuth.user?.id ?? null;

    // 4. Chama a API de validação do SpaceInCloud
    const validateResp = await fetch(`${SIC_URL}/functions/v1/validate-kera-access`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sicToken}`,
        apikey: SIC_ANON,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    let validateData: ValidateResponse = {};
    try {
      validateData = await validateResp.json();
    } catch {
      // ignore
    }

    const active = validateResp.ok && isGrowthActive(validateData);

    // 5. Atualiza profile
    await admin
      .from("profiles")
      .update({
        spaceincloud_active: active,
        spaceincloud_external_id: sicUserId,
        spaceincloud_synced_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    // Encerra a sessão remota (não precisa manter)
    try { await sicClient.auth.signOut(); } catch { /* noop */ }

    return new Response(
      JSON.stringify({
        active,
        source: "upstream",
        externalId: sicUserId,
        plan: validateData?.plan ?? null,
        message: active
          ? "Plano Growth ativo — agentes FIT liberados!"
          : "Encontramos sua conta no SpaceInCloud, mas não há plano Growth ativo.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[spaceincloud-sync] error", error);
    const message = error instanceof Error ? error.message : "unknown";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});