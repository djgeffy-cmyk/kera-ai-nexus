// TTS natural para Kera. Prioriza ElevenLabs (qualidade superior em PT-BR),
// com fallback automático para OpenAI se ElevenLabs falhar ou não estiver configurado.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ElevenLabs - Sarah: voz feminina jovem, natural, excelente em PT-BR
const ELEVEN_DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL"; // Sarah
const ELEVEN_DEFAULT_MODEL = "eleven_multilingual_v2";

// OpenAI - fallback
const OPENAI_DEFAULT_VOICE = "nova";
const OPENAI_DEFAULT_MODEL = "gpt-4o-mini-tts";

async function ttsElevenLabs(opts: {
  apiKey: string;
  text: string;
  voiceId: string;
  modelId: string;
}): Promise<Response> {
  const { apiKey, text, voiceId, modelId } = opts;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

  // Retry até 3x se for 429 concurrent_limit_exceeded (limite de 3 requisições paralelas)
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text.slice(0, 4000),
        model_id: modelId,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
          style: 0.35,
          use_speaker_boost: true,
          speed: 1.0,
        },
      }),
    });
    if (upstream.ok) {
      // Bufferiza o áudio inteiro antes de responder (evita "connection closed before message completed")
      const audioBuf = await upstream.arrayBuffer();
      console.log(`[ElevenLabs] OK voice=${voiceId} bytes=${audioBuf.byteLength}`);
      return new Response(audioBuf, {
        headers: {
          ...corsHeaders,
          "Content-Type": "audio/mpeg",
          "Content-Length": String(audioBuf.byteLength),
          "Cache-Control": "no-store",
          "X-TTS-Provider": "elevenlabs",
        },
      });
    }
    const t = await upstream.text();
    lastErr = `ElevenLabs ${upstream.status}: ${t.slice(0, 300)}`;
    // Se for limite de concorrência, espera e tenta de novo
    if (upstream.status === 429 && /concurrent_limit_exceeded|concurrent requests/i.test(t)) {
      const wait = 800 * (attempt + 1); // 800ms, 1.6s, 2.4s
      console.warn(`[ElevenLabs] concurrent limit, retry em ${wait}ms (tentativa ${attempt + 1}/3)`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    // Outro tipo de erro: aborta
    throw new Error(lastErr);
  }
  throw new Error(lastErr);
}

async function ttsOpenAI(opts: {
  apiKey: string;
  text: string;
  voice: string;
  model: string;
  instructions?: string;
}): Promise<Response> {
  const { apiKey, text, voice, model, instructions } = opts;
  const body: Record<string, unknown> = {
    model,
    voice,
    input: text.slice(0, 4000),
    response_format: "mp3",
    speed: 1.0,
  };
  if (model.includes("4o-mini-tts")) {
    body.instructions =
      instructions ||
      "Fale em português brasileiro, voz feminina jovem, calorosa, natural e expressiva. Tom amigável, ritmo conversacional, sem soar robótica.";
  }
  const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!upstream.ok) {
    const t = await upstream.text();
    throw new Error(`OpenAI ${upstream.status}: ${t.slice(0, 300)}`);
  }
  const audioBuf = await upstream.arrayBuffer();
  return new Response(audioBuf, {
    headers: {
      ...corsHeaders,
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audioBuf.byteLength),
      "Cache-Control": "no-store",
      "X-TTS-Provider": "openai",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ELEVEN_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");

  if (!ELEVEN_KEY && !OPENAI_KEY) {
    return new Response(
      JSON.stringify({ error: "Nenhum provedor de TTS configurado (ELEVENLABS_API_KEY ou OPENAI_API_KEY)." }),
      { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const text: string = payload?.text;
    const provider: string | undefined = payload?.provider; // "elevenlabs" | "openai" | undefined (auto)
    let voice: string | undefined = payload?.voice;
    const model: string | undefined = payload?.model;
    const instructions: string | undefined = payload?.instructions;

    // Se não veio voice no payload, busca configuração salva no banco (kera_settings.voice_id)
    if (!voice) {
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (SUPABASE_URL && SERVICE_KEY) {
          const r = await fetch(
            `${SUPABASE_URL}/rest/v1/kera_settings?singleton=eq.true&select=voice_id&limit=1`,
            { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
          );
          if (r.ok) {
            const rows = await r.json();
            const v = rows?.[0]?.voice_id;
            if (typeof v === "string" && v.trim()) voice = v.trim();
          }
        }
      } catch (e) {
        console.warn("[tts-kera] não foi possível ler voice_id do banco:", e);
      }
    }

    if (typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "text é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const wantEleven = provider === "elevenlabs" || (!provider && !!ELEVEN_KEY);
    const wantOpenAI = provider === "openai" || (!provider && !ELEVEN_KEY && !!OPENAI_KEY);

    // 1ª tentativa: ElevenLabs (se quiser e tiver chave)
    if (wantEleven && ELEVEN_KEY) {
      try {
        return await ttsElevenLabs({
          apiKey: ELEVEN_KEY,
          text,
          voiceId: voice || ELEVEN_DEFAULT_VOICE,
          modelId: model || ELEVEN_DEFAULT_MODEL,
        });
      } catch (err) {
        console.error("ElevenLabs falhou, tentando fallback:", err);
        if (!OPENAI_KEY) throw err; // sem fallback
      }
    }

    // Fallback ou rota direta: OpenAI
    if (wantOpenAI || (OPENAI_KEY && !wantEleven) || OPENAI_KEY) {
      try {
        return await ttsOpenAI({
          apiKey: OPENAI_KEY!,
          text,
          voice: (provider === "openai" ? voice : undefined) || OPENAI_DEFAULT_VOICE,
          model: (provider === "openai" ? model : undefined) || OPENAI_DEFAULT_MODEL,
          instructions,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Se OpenAI estourou quota e ElevenLabs já falhou antes, devolve 204 silencioso
        if (/\b429\b|insufficient_quota|exceeded your current quota/i.test(msg)) {
          console.warn("[tts-kera] Todos provedores indisponíveis (quota). Retornando 204.");
          return new Response(null, { status: 204, headers: corsHeaders });
        }
        throw err;
      }
    }

    return new Response(JSON.stringify({ error: "Nenhum provedor disponível" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("tts-kera error", e);
    const msg = e instanceof Error ? e.message : "Erro";
    if (/\b429\b|insufficient_quota|exceeded your current quota/i.test(msg)) {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
