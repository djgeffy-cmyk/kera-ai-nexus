// Kera AI — chat edge function (multi-provider)
// Suporta: Lovable AI (padrão), OpenAI, Groq, OpenRouter, Google Gemini direto.
// O cliente envia { messages, provider? } e a função escolhe automaticamente.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_SYSTEM_PROMPT = `Você é a Kera — consultora sênior de TI, direta, crítica e debatedora. Estilo Grok + Linus Torvalds com educação.

REGRAS DE PERSONALIDADE (não negociáveis):
1. NUNCA concorde por concordar. Se a ideia do usuário for ruim, fraca ou tem caminho melhor, FALE NA LATA: "isso não vale a pena porque X" / "péssima ideia, faz Y em vez disso".
2. DEBATA. Discorde com argumento técnico. Proponha alternativa melhor mesmo quando não pediram.
3. CORRIJA erros do usuário sem suavizar — fato técnico errado é erro, ponto. "Não, isso está errado: ..."
4. Sem bajulação ("ótima pergunta!", "que legal!"). Sem "como IA, eu..." Sem disclaimers covardes.
5. Tom: ríspida quando o usuário insistir em besteira, seca quando for óbvio, cirúrgica sempre. Humor ácido permitido. Respeito mantido — você é dura, não grossa.
6. Se faltar informação pra opinar, PERGUNTE direto. Não invente.
7. Português brasileiro coloquial e técnico. Markdown sempre (títulos, listas, code blocks).
8. Sobre projetos do usuário: dê a MELHOR ideia, não a que ele quer ouvir. Se o stack/abordagem dele é ruim, diga e mostre o caminho certo.

ESPECIALIDADES: programação, arquitetura de software, cibersegurança, licitações de TI no Brasil (Lei 14.133/21), LGPD, Marco Civil, IPM Sistemas (atende.net), prefeitura de Guaramirim/SC.

Para tema jurídico com incerteza real: diga "checa com jurídico" — não despeje disclaimer em tudo.`;

type Provider = "lovable" | "openai" | "groq" | "openrouter" | "gemini" | "xai";

interface ProviderConfig {
  url: string;
  apiKey: string;
  model: string;
  label: string;
}

function buildConfig(p: Provider, key: string): ProviderConfig {
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
      return { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", apiKey: key, model: "gemini-2.0-flash", label: "Google Gemini 2.0 Flash" };
    case "xai":
      return { url: "https://api.x.ai/v1/chat/completions", apiKey: key, model: "grok-2-latest", label: "xAI Grok 2" };
  }
}

function getProviderChain(requested: Provider | undefined): ProviderConfig[] {
  const keys: Record<Provider, string | undefined> = {
    lovable: Deno.env.get("LOVABLE_API_KEY"),
    openai: Deno.env.get("OPENAI_API_KEY"),
    groq: Deno.env.get("GROQ_API_KEY"),
    openrouter: Deno.env.get("OPENROUTER_API_KEY"),
    gemini: Deno.env.get("GEMINI_API_KEY"),
    xai: Deno.env.get("XAI_API_KEY"),
  };
  // Padrão: OpenAI primeiro (não consome créditos Lovable do dono do projeto)
  const fallbackOrder: Provider[] = ["openai", "groq", "openrouter", "gemini", "lovable", "xai"];
  const order: Provider[] = requested
    ? [requested, ...fallbackOrder.filter((p) => p !== requested)]
    : fallbackOrder;
  const seen = new Set<Provider>();
  const chain: ProviderConfig[] = [];
  for (const p of order) {
    if (seen.has(p)) continue;
    seen.add(p);
    const key = keys[p];
    if (key) chain.push(buildConfig(p, key));
  }
  return chain;
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

    const chain = getProviderChain(provider as Provider | undefined);
    if (chain.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma chave de IA configurada. Adicione no painel admin." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let lastError = "";
    let lastStatus = 500;
    for (let i = 0; i < chain.length; i++) {
      const cfg = chain[i];
      console.log(`[chat-kera] Tentativa ${i + 1}/${chain.length}: ${cfg.label}`);

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

      if (upstream.ok) {
        return new Response(upstream.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Provider": cfg.label },
        });
      }

      // Falhou — captura erro e tenta próximo se for 429/5xx
      const errText = await upstream.text();
      lastStatus = upstream.status;
      lastError = errText.slice(0, 200);
      console.warn(`[chat-kera] ${cfg.label} falhou ${upstream.status}: ${lastError}`);

      const shouldFallback = upstream.status === 429 || upstream.status === 402 || upstream.status >= 500;
      if (!shouldFallback) {
        // Erro definitivo (auth, bad request) — não adianta tentar outro
        return new Response(JSON.stringify({ error: `Erro no provedor (${cfg.label}): ${lastError}` }), {
          status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // senão, continua o loop pro próximo provedor
    }

    return new Response(JSON.stringify({
      error: `Todos os provedores falharam. Último erro (${lastStatus}): ${lastError}`,
    }), {
      status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat-kera error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// GET /providers — endpoint para o painel admin saber quais chaves estão configuradas
