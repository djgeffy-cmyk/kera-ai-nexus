// TTS natural para Kera. Prioriza ElevenLabs (qualidade superior em PT-BR),
// com fallback automático para OpenAI se ElevenLabs falhar ou não estiver configurado.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ElevenLabs - Sarah: voz feminina jovem, natural, excelente em PT-BR
const ELEVEN_DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL"; // Sarah
// Turbo v2.5: ~50% menos latência que multilingual_v2, qualidade quase igual em PT-BR.
// Usado para reduzir o tempo entre o clique em "Ouvir" e o início da fala.
const ELEVEN_DEFAULT_MODEL = "eleven_turbo_v2_5";

// Pré-processador de pronúncia para PT-BR.
// Carrega correções da tabela pronunciation_fixes (gerenciada no painel admin)
// e aplica antes de enviar pro TTS.
type PronFix = {
  word: string;
  replacement: string;
  case_sensitive: boolean;
  whole_word: boolean;
  enabled: boolean;
};

let pronCache: { fixes: PronFix[]; ts: number } | null = null;
const PRON_CACHE_MS = 60_000; // 1 min — propaga edição rápido sem martelar o banco

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function loadPronFixes(): Promise<PronFix[]> {
  if (pronCache && Date.now() - pronCache.ts < PRON_CACHE_MS) return pronCache.fixes;
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) return pronCache?.fixes ?? [];
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/pronunciation_fixes?enabled=eq.true&select=word,replacement,case_sensitive,whole_word,enabled`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    );
    if (!r.ok) return pronCache?.fixes ?? [];
    const rows = (await r.json()) as PronFix[];
    pronCache = { fixes: rows, ts: Date.now() };
    return rows;
  } catch (e) {
    console.warn("[tts-kera] falha ao carregar pronunciation_fixes:", e);
    return pronCache?.fixes ?? [];
  }
}

function applyPronFixes(text: string, fixes: PronFix[]): string {
  let out = text;
  for (const f of fixes) {
    if (!f.enabled || !f.word) continue;
    const flags = f.case_sensitive ? "g" : "gi";
    const body = escapeRegex(f.word);
    const pattern = f.whole_word ? `\\b${body}\\b` : body;
    try {
      out = out.replace(new RegExp(pattern, flags), f.replacement);
    } catch (e) {
      console.warn("[tts-kera] regex inválida para", f.word, e);
    }
  }
  return out;
}

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
  // Endpoint /stream + optimize_streaming_latency=3 reduz fortemente o time-to-first-byte.
  // output_format mp3_22050_32 é leve e suficiente pra fala (mais rápido que 44100_128).
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_22050_32&optimize_streaming_latency=3`;

  // Retry até 6x se for 429 concurrent_limit_exceeded (limite de 3 requisições paralelas)
  let lastErr = "";
  for (let attempt = 0; attempt < 6; attempt++) {
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
      // Pass-through do stream: o cliente começa a baixar (e pode tocar) antes
      // do ElevenLabs terminar de gerar todo o áudio. Reduz time-to-first-audio.
      console.log(`[ElevenLabs] OK stream voice=${voiceId} model=${modelId}`);
      return new Response(upstream.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
          "X-TTS-Provider": "elevenlabs",
        },
      });
    }
    const t = await upstream.text();
    lastErr = `ElevenLabs ${upstream.status}: ${t.slice(0, 300)}`;
    // Se for limite de concorrência, espera mais e tenta de novo (até 6x)
    if (upstream.status === 429 && /concurrent_limit_exceeded|concurrent requests/i.test(t)) {
      const wait = 1000 + 1500 * attempt; // 1s, 2.5s, 4s, 5.5s, 7s, 8.5s
      console.warn(`[ElevenLabs] concurrent limit, retry em ${wait}ms (tentativa ${attempt + 1}/6)`);
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

    // Conserta pronúncia de nomes que TTS erra em PT-BR (ex: Geverson → Guêverson)
    // Carrega correções cadastradas no admin (cache de 1 min).
    const pronFixes = await loadPronFixes();
    const speakText = applyPronFixes(text, pronFixes);

    const wantEleven = provider === "elevenlabs" || (!provider && !!ELEVEN_KEY);
    const wantOpenAI = provider === "openai" || (!provider && !ELEVEN_KEY && !!OPENAI_KEY);

    // 1ª tentativa: ElevenLabs (se quiser e tiver chave)
    if (wantEleven && ELEVEN_KEY) {
      try {
        return await ttsElevenLabs({
          apiKey: ELEVEN_KEY,
          text: speakText,
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
          text: speakText,
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
