// Edge function: scribe-token
// Gera um token single-use do ElevenLabs Realtime Scribe (STT em streaming).
// O token expira em ~15min e é seguro pra mandar pro browser.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Valida que o usuário está autenticado (token JWT no header)
    // Usamos verify_jwt = false na config porque algumas chamadas vêm com token de signing-key novo;
    // validamos manualmente aqui contra o auth do Supabase.
    const auth = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supaUrl = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (supaUrl && anon) {
      const r = await fetch(`${supaUrl}/auth/v1/user`, {
        headers: { Authorization: auth, apikey: anon },
      });
      if (!r.ok) {
        return new Response(JSON.stringify({ error: "Sessão inválida" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const r = await fetch(
      "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
      {
        method: "POST",
        headers: { "xi-api-key": apiKey },
      },
    );

    if (!r.ok) {
      const errText = await r.text();
      return new Response(
        JSON.stringify({ error: `ElevenLabs token request failed [${r.status}]: ${errText}` }),
        { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await r.json();
    if (!data?.token) {
      return new Response(JSON.stringify({ error: "Token não retornado" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ token: data.token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
