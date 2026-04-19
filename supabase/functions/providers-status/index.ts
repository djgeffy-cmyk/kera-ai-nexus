// Atualiza o status para incluir ElevenLabs também
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const status = {
    lovable: !!Deno.env.get("LOVABLE_API_KEY"),
    openai: !!Deno.env.get("OPENAI_API_KEY"),
    groq: !!Deno.env.get("GROQ_API_KEY"),
    openrouter: !!Deno.env.get("OPENROUTER_API_KEY"),
    gemini: !!Deno.env.get("GEMINI_API_KEY"),
    xai: !!Deno.env.get("XAI_API_KEY"),
    elevenlabs: !!Deno.env.get("ELEVENLABS_API_KEY"),
  };

  return new Response(JSON.stringify(status), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
