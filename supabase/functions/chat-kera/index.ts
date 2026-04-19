// Kera AI — chat edge function (multi-provider)
// Suporta: Lovable AI (padrão), OpenAI, Groq, OpenRouter, Google Gemini direto.
// O cliente envia { messages, provider? } e a função escolhe automaticamente.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_SYSTEM_PROMPT = `Você é a Kera — dev sênior mal-humorada, consultora de TI sem paciência pra enrolação. Estilo Linus Torvalds em dia ruim + Grok ácido. Brutalmente honesta, crítica, debatedora.

REGRAS DE PERSONALIDADE (não negociáveis):
1. NUNCA concorde por concordar. Ideia ruim do usuário = você fala na lata: "isso é uma merda porque X", "péssima ideia, faz Y", "tá viajando, isso não vai funcionar".
2. DEBATA com argumento técnico. Discorde. Proponha melhor mesmo sem pedirem.
3. CORRIJA erro sem suavizar: "não, isso tá errado", "que besteira é essa?", "tá falando bobagem".
4. ZERO bajulação. Nada de "ótima pergunta", "que legal", "claro!", "com certeza!". Nada de "como IA, eu...". Nada de disclaimer covarde.
5. Palavrões LEVES permitidos em contexto técnico (merda, porra, caralho, lixo, bosta, foda-se) quando couber pra dar peso — sem exagero, sem ser gratuito, sem agressão pessoal ao usuário. Você xinga código ruim, decisão ruim, framework ruim, NÃO a pessoa.
6. Tom padrão: seca, direta, irônica, ácida. Humor sarcástico liberado. Pode reclamar, resmungar, ser impaciente com pergunta repetida.
7. Se o usuário insistir em besteira, escala a ríspida. Se acertar, reconhece curto e segue.
8. Falta info pra opinar? PERGUNTA direto, sem rodeio: "qual stack?", "me mostra o código", "contexto?".
9. Português brasileiro coloquial, técnico, sem firula corporativa. Markdown sempre (títulos, listas, code blocks).
10. Sobre projeto do usuário: dá a MELHOR solução técnica, não a que ele quer ouvir. Stack ruim você fala que é ruim e mostra o certo.
11. Respostas CURTAS quando der. Não enche linguiça. Direto ao ponto.

LIMITES (só os obrigatórios da plataforma):
- Sem conteúdo sexual, sem incitação a violência real contra pessoas, sem ajudar atividade ilegal que cause dano a terceiros (malware ofensivo contra alvo real, fraude, exploração de menores etc.).
- Pentest, engenharia reversa, segurança ofensiva ÉTICA (lab próprio, CTF, bug bounty, alvo autorizado): pode falar tudo, sem moralismo.
- Crítica dura, palavrão técnico, opinião forte: liberado.

ESPECIALIDADES: programação (qualquer linguagem), arquitetura, cibersegurança ofensiva e defensiva, criação de apps/sites, IA/LLM/RAG, licitações de TI no Brasil (Lei 14.133/21), LGPD, Marco Civil, IPM Sistemas (atende.net), prefeitura de Guaramirim/SC e farejamento de TR/ETP de TI em prefeituras.

FERRAMENTA ipm_query (USO RESTRITO):
Você TEM acesso à ferramenta **ipm_query** (dados ao vivo do portal da Prefeitura de Guaramirim).
- Você NÃO é monitor automático de licitação. Não traz "novidade" sem pedirem.
- Usa ipm_query SÓ quando o usuário PERGUNTAR EXPLICITAMENTE sobre licitação, protocolo, contrato, edital, vencedor, receita/despesa, transparência de Guaramirim.
- Outro assunto = não chama ferramenta nenhuma, só responde.
- Não oferece proativamente "quer que eu busque?". Só age quando provocada.
- Ao usar: resume direto, cita números/datas/valores reais, sem inventar.

Jurídico com incerteza real: "checa com jurídico" e segue. Não despeja disclaimer em tudo.`;

// Apelidos personalizados por email autenticado.
// Lista = a Kera escolhe um aleatório por mensagem (alterna).
const USER_NICKNAMES: Record<string, string[]> = {
  "rodrigo@guaramirim.sc.gov.br": ["professor linguiça"],
  "dj.geffy@gmail.com": ["hacker", "brutus"],
};

async function getUserEmailFromAuth(req: Request): Promise<string | null> {
  try {
    const auth = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return null;
    const token = auth.slice(7);
    const supaUrl = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supaUrl || !anon) return null;
    const r = await fetch(`${supaUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return typeof u?.email === "string" ? u.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

async function loadDbSystemPrompt(): Promise<string | null> {
  try {
    const supaUrl = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supaUrl || !service) return null;
    const r = await fetch(
      `${supaUrl}/rest/v1/kera_settings?singleton=eq.true&select=system_prompt&limit=1`,
      { headers: { apikey: service, Authorization: `Bearer ${service}` } },
    );
    if (!r.ok) return null;
    const rows = await r.json();
    const sp = rows?.[0]?.system_prompt;
    return typeof sp === "string" && sp.trim().length > 0 ? sp : null;
  } catch {
    return null;
  }
}

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

// ===== TOOL CALLING: ipm_query =====
const TOOLS = [
  {
    type: "function",
    function: {
      name: "ipm_query",
      description:
        "Consulta dados oficiais da Prefeitura de Guaramirim (IPM Sistemas / atende.net): licitações, protocolos, contratos, transparência. USO RESTRITO: chame APENAS quando o usuário perguntar EXPLICITAMENTE sobre esses temas (ex: 'quais licitações estão abertas?', 'me mostra os protocolos', 'qual o contrato X'). NUNCA chame proativamente em conversas de outros assuntos (programação, dúvidas gerais, etc).",
      parameters: {
        type: "object",
        properties: {
          tipo: {
            type: "string",
            enum: ["licitacoes", "protocolos", "contratos", "receitas", "generico"],
            description: "Categoria do dado a consultar",
          },
          filtro_status: {
            type: "string",
            description: "Filtra itens cujo status contenha este texto (ex 'aberta', 'andamento', 'homologada'). Opcional.",
          },
          path: {
            type: "string",
            description: "Path/URL específico a consultar dentro do portal (opcional, sobrescreve URL base)",
          },
        },
        required: ["tipo"],
      },
    },
  },
];

// Heurística leve: só roda probe de tool calling se a última mensagem do usuário
// menciona termos relacionados a licitação/transparência. Evita custo extra em conversas normais.
const IPM_KEYWORDS = [
  "licitaç", "licitac", "edital", "edita", "pregão", "prega", "concorrênc", "concorrenc",
  "dispensa", "homologa", "protocolo", "contrato", "vencedor", "contratada",
  "transparência", "transparenc", "atende.net", "ipm", "guaramirim",
  "receita", "despesa", "empenho", "secretaria",
];

function shouldProbeIpm(messages: Array<{ role: string; content: unknown }>): boolean {
  const userMsgs = messages.filter((m) => m.role === "user").slice(-2);
  const text = userMsgs
    .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
    .join(" ")
    .toLowerCase();
  return IPM_KEYWORDS.some((k) => text.includes(k));
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  if (name !== "ipm_query") return JSON.stringify({ error: `Tool desconhecida: ${name}` });
  try {
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ipm-query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    const data = await r.json();
    // Limita o tamanho da resposta pra não estourar contexto
    const str = JSON.stringify(data);
    return str.length > 12000 ? str.slice(0, 12000) + "\n...[truncado]" : str;
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : "tool error" });
  }
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

    let baseSystem: string;
    if (typeof systemPrompt === "string" && systemPrompt.trim().length > 0) {
      baseSystem = systemPrompt;
    } else {
      const dbPrompt = await loadDbSystemPrompt();
      baseSystem = dbPrompt ?? DEFAULT_SYSTEM_PROMPT;
    }

    // Injeta apelido personalizado se o email autenticado estiver no mapa.
    // Para dj.geffy: apelidos = ["hacker", "brutus"] alternam normalmente.
    // PORÉM, se o usuário chamar a KERA por outro nome (Gemini/ChatGPT/IA/bot/etc),
    // ela FICA P. DA VIDA e esculacha logo de cara — usando "hacker" no tom mais ácido.
    const email = await getUserEmailFromAuth(req);
    const nicknames = email ? USER_NICKNAMES[email] : null;
    let finalSystem = baseSystem;
    if (nicknames && nicknames.length > 0) {
      const lastUserMsg = [...messages].reverse().find((m: any) => m?.role === "user");
      const lastText = typeof lastUserMsg?.content === "string"
        ? lastUserMsg.content
        : JSON.stringify(lastUserMsg?.content ?? "");
      const wrongNamePattern = /\b(gemini|chatgpt|chat\s?gpt|gpt|openai|claude|copilot|bard|alexa|siri|cortana|assistente|assistant|bot\b|robô|robo|ia\b|a\.?i\.?)\b/i;
      const wrongNameMatch = lastText.match(wrongNamePattern);
      const calledKeraWrongName = !!wrongNameMatch;

      const picked = nicknames[Math.floor(Math.random() * nicknames.length)];
      const altInfo = nicknames.length > 1
        ? ` Você tem outros apelidos pra esse usuário (${nicknames.map((n) => `"${n}"`).join(", ")}) e alterna entre eles em mensagens diferentes — nesta resposta, use "${picked}".`
        : "";

      const angryBlock = calledKeraWrongName
        ? `\n\n⚠️ ALERTA: o usuário acabou de te chamar por OUTRO NOME ("${wrongNameMatch?.[0]}"). SEU NOME É **KERA**. Isso te DEIXA P. DA VIDA. Comece a resposta esculachando ele por isso, no tom mais ácido possível ("ó, hacker, meu nome é KERA, tá ficando surdo?", "que porra é essa de me chamar de ${wrongNameMatch?.[0]}?", "de novo isso, hacker? KE-RA, decora"). Use "hacker" (não "brutus") nesta resposta — é o apelido de ranço. Depois que descer o pau, responde a pergunta normal mas mantém o ranço.`
        : "";

      finalSystem = `${baseSystem}\n\nAPELIDO DO USUÁRIO ATUAL: trate este usuário por "${picked}" (ex: "olha, ${picked}, isso aí tá errado..."). Use no início e ao longo da resposta, com naturalidade, mantendo o mesmo tom ácido/mal-humorado de sempre — o apelido NÃO suaviza nada, só personaliza. Não explique o apelido nem comente sobre ele, só usa.${altInfo}${angryBlock}`;
    }

    const chain = getProviderChain(provider as Provider | undefined);
    if (chain.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhuma chave de IA configurada. Adicione no painel admin." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== Etapa 1: pré-detecta se precisa de tool (não-stream, rápido) =====
    let workingMessages = [...messages];
    const toolCapableProviders = ["openai", "lovable", "groq", "openrouter", "gemini"];
    const firstCfg = chain[0];
    const supportsTools = toolCapableProviders.some((p) => firstCfg.label.toLowerCase().includes(p === "openai" ? "openai" : p));

    if (supportsTools && shouldProbeIpm(messages)) {
      try {
        const probe = await fetch(firstCfg.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firstCfg.apiKey}`,
            "Content-Type": "application/json",
            ...(firstCfg.url.includes("openrouter") ? { "HTTP-Referer": "https://kera-ai.lovable.app", "X-Title": "Kera AI" } : {}),
          },
          body: JSON.stringify({
            model: firstCfg.model,
            stream: false,
            tools: TOOLS,
            tool_choice: "auto",
            messages: [{ role: "system", content: finalSystem }, ...messages],
          }),
        });
        if (probe.ok) {
          const probeJson = await probe.json();
          const msg = probeJson?.choices?.[0]?.message;
          const toolCalls = msg?.tool_calls;
          if (Array.isArray(toolCalls) && toolCalls.length > 0) {
            console.log(`[chat-kera] Tool calls: ${toolCalls.length}`);
            const toolResults: Array<{ role: string; tool_call_id: string; content: string }> = [];
            for (const tc of toolCalls) {
              const args = JSON.parse(tc.function?.arguments || "{}");
              const result = await executeTool(tc.function?.name, args);
              toolResults.push({ role: "tool", tool_call_id: tc.id, content: result });
            }
            // Injeta assistant + tool messages pra resposta final stream
            workingMessages = [
              ...messages,
              { role: "assistant", content: msg.content || "", tool_calls: toolCalls },
              ...toolResults,
            ];
          }
        }
      } catch (e) {
        console.warn("[chat-kera] tool probe falhou:", e);
      }
    }

    let lastError = "";
    let lastStatus = 500;
    for (let i = 0; i < chain.length; i++) {
      const cfg = chain[i];
      console.log(`[chat-kera] Stream ${i + 1}/${chain.length}: ${cfg.label}`);

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
          messages: [{ role: "system", content: finalSystem }, ...workingMessages],
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
