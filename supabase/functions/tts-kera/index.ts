// TTS via OpenAI (voz natural). Retorna MP3 binário.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Vozes femininas naturais da OpenAI: "nova" (jovem, calorosa), "shimmer" (suave), "alloy" (neutra)
const DEFAULT_VOICE = "nova";
const DEFAULT_MODEL = "gpt-4o-mini-tts"; // mais barato e natural; alternativa: "tts-1-hd"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY não configurada" }), {
      status: 501,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { text, voice, model, instructions } = await req.json();
    if (typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "text é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chosenVoice = voice || DEFAULT_VOICE;
    const chosenModel = model || DEFAULT_MODEL;

    const body: Record<string, unknown> = {
      model: chosenModel,
      voice: chosenVoice,
      input: text.slice(0, 4000),
      response_format: "mp3",
      speed: 1.0,
    };
    // gpt-4o-mini-tts aceita "instructions" para controle de tom/estilo
    if (chosenModel.includes("4o-mini-tts")) {
      body.instructions =
        instructions ||
        "Fale em português brasileiro, com voz feminina jovem, calorosa, natural e expressiva. Tom amigável, ritmo conversacional, sem soar robótica.";
    }

    const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const t = await upstream.text();
      console.error("OpenAI TTS error", upstream.status, t);
      return new Response(JSON.stringify({ error: `OpenAI ${upstream.status}: ${t.slice(0, 300)}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("tts-kera error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
