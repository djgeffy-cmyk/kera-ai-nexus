const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY ausente" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": apiKey },
    });

    if (!r.ok) {
      const text = await r.text();
      return new Response(
        JSON.stringify({ error: `ElevenLabs ${r.status}`, detail: text }),
        { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await r.json();
    const used = Number(data.character_count ?? 0);
    const limit = Number(data.character_limit ?? 0);
    const remaining = Math.max(0, limit - used);
    const resetUnix = Number(data.next_character_count_reset_unix ?? 0);
    const resetAt = resetUnix > 0 ? new Date(resetUnix * 1000).toISOString() : null;
    const daysUntilReset =
      resetUnix > 0 ? Math.max(0, Math.ceil((resetUnix * 1000 - Date.now()) / 86400000)) : null;

    return new Response(
      JSON.stringify({
        tier: data.tier ?? null,
        status: data.status ?? null,
        used,
        limit,
        remaining,
        percent_used: limit > 0 ? Math.round((used / limit) * 100) : 0,
        reset_at: resetAt,
        days_until_reset: daysUntilReset,
        can_extend_character_limit: !!data.can_extend_character_limit,
        allowed_to_extend_character_limit: !!data.allowed_to_extend_character_limit,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
