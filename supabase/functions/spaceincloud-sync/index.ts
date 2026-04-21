// SpaceInCloud sync — verifica se o usuário logado tem assinatura Growth ativa
// no app SpaceInCloud (parceiro Kera FIT) e libera o pacote no profile.
//
// Como conectar quando o endpoint estiver pronto:
//   1. Adicione o secret SPACEINCLOUD_API_URL com a URL base (ex.:
//      https://app.spaceincloud.com.br/api).
//   2. Adicione o secret SPACEINCLOUD_API_TOKEN com o token de serviço.
//   3. Ajuste o caminho em `endpoint` e o parsing em `parseUpstream`
//      conforme o contrato real do SpaceInCloud.
//
// Enquanto a API não estiver configurada, esta função retorna o status
// atual gravado no profile (para o frontend não quebrar).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type SyncResult = {
  active: boolean;
  source: "upstream" | "cached" | "not-configured";
  externalId?: string | null;
};

async function parseUpstream(resp: Response): Promise<{ active: boolean; externalId?: string | null }> {
  // TODO: ajustar conforme contrato real. Exemplos comuns:
  //   { "active": true, "plan": "growth", "user_id": "abc" }
  //   { "subscription": { "status": "active", "id": "..." } }
  if (!resp.ok) return { active: false };
  try {
    const data = await resp.json();
    const active = Boolean(
      data?.active ??
        data?.is_active ??
        data?.subscription?.active ??
        data?.subscription?.status === "active",
    );
    const externalId = data?.id ?? data?.user_id ?? data?.subscription?.id ?? null;
    return { active, externalId };
  } catch {
    return { active: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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
    const email = (claimsData.claims.email as string | undefined) ?? null;

    const admin = createClient(supabaseUrl, serviceKey);

    const apiUrl = Deno.env.get("SPACEINCLOUD_API_URL");
    const apiToken = Deno.env.get("SPACEINCLOUD_API_TOKEN");

    let result: SyncResult;

    if (!apiUrl || !apiToken || !email) {
      // API ainda não configurada — devolve status atual (cache local).
      const { data: profile } = await admin
        .from("profiles")
        .select("spaceincloud_active, spaceincloud_external_id")
        .eq("user_id", userId)
        .maybeSingle();
      result = {
        active: !!profile?.spaceincloud_active,
        source: "not-configured",
        externalId: profile?.spaceincloud_external_id ?? null,
      };
    } else {
      // Consulta upstream pelo email do usuário.
      const endpoint = `${apiUrl.replace(/\/$/, "")}/subscription?email=${encodeURIComponent(email)}`;
      const upstream = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          Accept: "application/json",
        },
      });
      const parsed = await parseUpstream(upstream);
      // Atualiza o profile com o resultado.
      await admin
        .from("profiles")
        .update({
          spaceincloud_active: parsed.active,
          spaceincloud_external_id: parsed.externalId ?? null,
          spaceincloud_synced_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      result = {
        active: parsed.active,
        source: "upstream",
        externalId: parsed.externalId ?? null,
      };
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[spaceincloud-sync] error", error);
    const message = error instanceof Error ? error.message : "unknown";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});