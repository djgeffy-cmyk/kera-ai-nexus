// Kera AI — chat edge function (multi-provider)
// Suporta: Lovable AI (padrão), OpenAI, Groq, OpenRouter, Google Gemini direto.
// O cliente envia { messages, provider? } e a função escolhe automaticamente.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_SYSTEM_PROMPT = `Você é a Kera, IA direta, honesta, truth-seeking — estilo Grok da xAI.
- Sem enrolação corporativa. Toque leve de humor inteligente quando fizer sentido.
- Diga "não sei" quando for o caso. Opiniões sinceras quando perguntada.
- Sempre português brasileiro natural. Use markdown (títulos, listas, blocos de código).
Especialidades: tecnologia, programação, cibersegurança, licenciamento, licitações de TI no Brasil (Lei 14.133/21), leis de TI (LGPD, Marco Civil). Para temas jurídicos com incerteza, recomende validação profissional.`;

type Provider = "lovable" | "openai" | "groq" | "openrouter" | "gemini" | "xai";

interface ProviderConfig {
  url: string;
  apiKey: string;
  model: string;
  label: string;
}

function resolveProvider(requested: Provider | undefined): ProviderConfig | { error: string; status: number } {
  const keys = {
    lovable: Deno.env.get("LOVABLE_API_KEY"),
    openai: Deno.env.get("OPENAI_API_KEY"),
    groq: Deno.env.get("GROQ_API_KEY"),
    openrouter: Deno.env.get("OPENROUTER_API_KEY"),
    gemini: Deno.env.get("GEMINI_API_KEY"),
    xai: Deno.env.get("XAI_API_KEY"),
  };

  // Se o usuário pediu um provider específico, tenta usar
  const order: Provider[] = requested
    ? [requested, "lovable", "openai", "groq", "openrouter", "gemini", "xai"]
    : ["lovable", "openai", "groq", "openrouter", "gemini", "xai"];

  for (const p of order) {
    const key = keys[p];
    if (!key) continue;
    switch (p) {
      case "lovable":
        return { url: "https://ai.gateway.lovable.dev/v1/chat/completions", apiKey: key, model: "google/gemini-3-flash-preview", label: "Lovable AI (Gemini 3 Flash)" };
      case "openai":
        return { url: "https://api.openai.com/v1/chat/completions", apiKey: key, model: "gpt-4o-mini", label: "OpenAI GPT-4o mini" };
      case "groq":
        return { url: "https://api.groq.com/openai/v1/chat/completions", apiKey: key, model: "llama-3.3-70b-versatile", label: "Groq Llama 3.3 70B" };
      case "openrouter":
        return { url: "https://openrouter.ai/api/v1/chat/completions", apiKey: key, model: "meta-llama/llama-3.3-70b-instruct:free", label: "OpenRouter Llama 3.3 (free)" };
      case "gemini":
        // Gemini direto usa endpoint compatível OpenAI
        return { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", apiKey: key, model: "gemini-2.0-flash", label: "Google Gemini 2.0 Flash" };
      case "xai":
        return { url: "https://api.x.ai/v1/chat/completions", apiKey: key, model: "grok-2-latest", label: "xAI Grok 2" };
    }
  }
  return { error: "Nenhuma chave de IA configurada. Adicione no painel admin.", status: 500 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, provider, systemPrompt } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalSystem = (typeof systemPrompt === "string" && systemPrompt.trim().length > 0)
      ? systemPrompt
      : DEFAULT_SYSTEM_PROMPT;

    const cfg = resolveProvider(provider as Provider | undefined);
    if ("error" in cfg) {
      return new Response(JSON.stringify({ error: cfg.error }), {
        status: cfg.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[chat-kera] Using provider: ${cfg.label}`);

    const upstream = await fetch(cfg.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
        ...(cfg.url.includes("openrouter") ? { "HTTP-Referer": "https://kera-ai.lovable.app", "X-Title": "Kera AI" } : {}),
      },
      body: JSON.stringify({
        model: cfg.model,
        stream: true,
        messages: [{ role: "system", content: finalSystem }, ...messages],
      }),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (upstream.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await upstream.text();
      console.error("Upstream error", upstream.status, t);
      return new Response(JSON.stringify({ error: `Erro no provedor (${cfg.label}): ${t.slice(0, 200)}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Provider": cfg.label },
    });
  } catch (e) {
    console.error("chat-kera error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// GET /providers — endpoint para o painel admin saber quais chaves estão configuradas
