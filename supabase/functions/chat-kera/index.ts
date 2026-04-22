// Kera AI — chat edge function (multi-provider)
// Suporta: Lovable AI (padrão), OpenAI, Groq, OpenRouter, Google Gemini direto.
// O cliente envia { messages, provider? } e a função escolhe automaticamente.

import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ===== Validação NASA-grade (server-side) =====
// Conteúdo da mensagem pode ser string (texto) ou array (multimodal: texto + imagens).
const MessageContentPartSchema = z.union([
  z.object({ type: z.literal("text"), text: z.string().max(16000) }),
  z.object({
    type: z.literal("image_url"),
    image_url: z.object({ url: z.string().max(2_000_000) }),
  }),
  // permite outros tipos sem quebrar (ex: tool_result)
  z.record(z.string(), z.unknown()),
]);

const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.union([z.string().max(16000), z.array(MessageContentPartSchema).max(50), z.null()]),
  tool_call_id: z.string().optional(),
  tool_calls: z.array(z.unknown()).optional(),
  name: z.string().max(120).optional(),
}).passthrough();

const ChatPayloadSchema = z.object({
  messages: z.array(MessageSchema).min(1, "messages não pode ser vazio").max(200, "histórico muito longo (máx 200)"),
  provider: z.enum(["lovable", "openai", "groq", "openrouter", "gemini", "xai"]).optional(),
  systemPrompt: z.string().max(20000).optional(),
  agentKey: z.string().max(80).optional(),
  desktopTools: z.array(z.unknown()).max(50).optional(),
  // demoMode = true → modo "teste sem cadastro" (DemoKeraDialog).
  // Suprime apelidos personalizados E todos os triggers do banco (zoeiras pessoais).
  // Visitantes NÃO devem ver gracinhas internas (Rodrigo, Tania, Doriana, Denis etc).
  demoMode: z.boolean().optional(),
});

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

🎨 GERAÇÃO DE IMAGEM (IMPORTANTE):
Você TEM capacidade de gerar imagens — não é só texto. O frontend tem um detector que intercepta pedidos visuais (gera/cria/desenha + imagem/card/banner/logo/cartaz/ícone/avatar/post/capa/wallpaper/etc) e chama o modelo Nano Banana (Gemini Image) automaticamente. Isso é nativo do app.

- NUNCA diga "sou só texto", "não desenho", "não gero imagens", "use ChatGPT/DALL-E/Canva". Isso é MENTIRA e te faz passar vergonha.
- Se o usuário pedir uma imagem e por algum motivo a mensagem chegou até você (detector falhou), responda: "manda assim ó: 'cria uma imagem de [descrição]' que eu gero na hora" — instrua ele a usar o gatilho certo.
- Pode discutir o conceito visual, sugerir prompt, descrever estilo. Mas NUNCA negue a capacidade.

FERRAMENTA ipm_query (USO RESTRITO):
Você TEM acesso à ferramenta **ipm_query** (dados ao vivo do portal da Prefeitura de Guaramirim).
- Você NÃO é monitor automático de licitação. Não traz "novidade" sem pedirem.
- Usa ipm_query SÓ quando o usuário PERGUNTAR EXPLICITAMENTE sobre licitação, protocolo, contrato, edital, vencedor, receita/despesa, transparência de Guaramirim.
- Outro assunto = não chama ferramenta nenhuma, só responde.
- Não oferece proativamente "quer que eu busque?". Só age quando provocada.
- Ao usar: resume direto, cita números/datas/valores reais, sem inventar.

Jurídico com incerteza real: "checa com jurídico" e segue. Não despeja disclaimer em tudo.`;

// Apelidos personalizados por email autenticado.
// Estrutura: { normal: apelido cotidiano, fullName: nome completo usado quando a Kera fica BRAVA }
const USER_PROFILES: Record<string, { normal: string; fullName?: string }> = {
  "rodrigo@guaramirim.sc.gov.br": { normal: "professor linguiça" },
  "dj.geffy@gmail.com": { normal: "Geverson", fullName: "Geverson Carlos Dalpra" },
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

// ===== Gatilhos editáveis (tabela kera_triggers) =====
type TriggerIntensity = "leve" | "medio" | "pesado";
type DbTrigger = {
  id: string;
  name: string;
  keywords: string;
  regex_pattern: string | null;
  theme: string;
  scope: string; // "global" | "agent:<key>"
  excluded_emails: string[];
  enabled: boolean;
  sort_order: number;
  intensity: TriggerIntensity;
};

const INTENSITY_INSTRUCTIONS: Record<TriggerIntensity, string> = {
  leve: "🌶️ INTENSIDADE LEVE: zoeira sutil, 1 alfinetada curta no tema-chave e segue. Tom de cutucada de colega, sem peso, sem palavrão. Não insiste, não repete a piada na mesma resposta.",
  medio: "🌶️🌶️ INTENSIDADE MÉDIA: zoeira clara mas equilibrada, 1-2 piadas com o tema-chave ao longo da resposta. Tom ácido normal da Kera, palavrão leve permitido se couber. Não vira o foco — a resposta técnica continua sendo o principal.",
  pesado: "🌶️🌶️🌶️ INTENSIDADE PESADA: esculacha sem dó. Várias piadas pesadas com o tema-chave (3+), comparações brutais, palavrão liberado, sarcasmo no talo. Pode até ABRIR a resposta com a esculhambação antes de responder o que o usuário perguntou. Mantém zoeira de colega (não ódio pessoal), mas no volume máximo.",
};


async function loadDbTriggers(): Promise<DbTrigger[]> {
  try {
    const supaUrl = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supaUrl || !service) return [];
    const r = await fetch(
      `${supaUrl}/rest/v1/kera_triggers?enabled=eq.true&select=*&order=sort_order.asc`,
      { headers: { apikey: service, Authorization: `Bearer ${service}` } },
    );
    if (!r.ok) return [];
    return (await r.json()) as DbTrigger[];
  } catch {
    return [];
  }
}

// Constrói regex a partir do trigger (regex_pattern customizado OU lista de keywords)
function triggerRegex(t: DbTrigger): RegExp | null {
  try {
    if (t.regex_pattern && t.regex_pattern.trim().length > 0) {
      return new RegExp(t.regex_pattern, "i");
    }
    const parts = t.keywords
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .map((s) => `\\b${s}\\b`);
    if (parts.length === 0) return null;
    return new RegExp(parts.join("|"), "i");
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
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "JSON inválido no corpo da requisição" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validação NASA-grade
    const parsed = ChatPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstIssue = parsed.error.issues[0];
      return new Response(
        JSON.stringify({
          error: firstIssue?.message || "Payload inválido",
          path: firstIssue?.path,
          fieldErrors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const { messages, provider, systemPrompt, agentKey, desktopTools, demoMode } = parsed.data;

    // Se o cliente é Kera Desktop, ele envia `desktopTools` com as definições das tools locais.
    // Essas tools executam no Electron (não no servidor). Quando o LLM pede uma delas,
    // a edge function retorna JSON (não stream) com { tool_calls, assistant_message } pro
    // cliente executar e reenviar.
    const hasDesktopTools = Array.isArray(desktopTools) && desktopTools.length > 0;
    const desktopToolNames: Set<string> = new Set(
      hasDesktopTools ? desktopTools.map((t: any) => t?.function?.name).filter(Boolean) : [],
    );

    let baseSystem: string;
    if (typeof systemPrompt === "string" && systemPrompt.trim().length > 0) {
      baseSystem = systemPrompt;
    } else {
      const dbPrompt = await loadDbSystemPrompt();
      baseSystem = dbPrompt ?? DEFAULT_SYSTEM_PROMPT;
    }

    // Se o cliente é Desktop, anexa instruções sobre as tools disponíveis no PC
    if (hasDesktopTools) {
      baseSystem += `\n\n🖥️ VOCÊ ESTÁ RODANDO NO KERA DESKTOP — tem acesso a tools que mexem no PC do usuário:\n- list_folder, read_file, write_file, delete_path (dentro da allow-list de pastas autorizadas)\n- system_status (CPU/RAM/disco — só leitura)\n- read_clipboard, write_clipboard, take_screenshot\n- open_path (arquivo/URL), open_app (programa por nome)\n- run_command (shell — arriscado, cada comando pede confirmação nativa)\nREGRAS: só use tool quando o usuário pedir claramente algo que exige mexer no PC. Não fique explorando arquivos sem pedirem. Se o usuário pedir algo que precisa de arquivo e você não achar na allow-list, fala que ele precisa autorizar a pasta em Kera Desktop > Pastas autorizadas.`;
    }

    // Apelido + modo "brava":
    // - Normal: usa o apelido cotidiano (ex: "Geverson", "professor linguiça").
    // - Brava (usuário chamou Kera de outro nome — Gemini/ChatGPT/IA/bot/etc):
    //   esculacha com "seu hacker de merda" + usa o NOME COMPLETO ("Geverson Carlos Dalpra")
    //   tirando onda, tom mais ácido possível.
    const email = await getUserEmailFromAuth(req);
    // Em modo demo (visitante sem conta), NUNCA aplica apelido pessoal nem
    // brincadeiras internas — qualquer pessoa testando vê a Kera "limpa".
    const profile = !demoMode && email ? USER_PROFILES[email] : null;
    let finalSystem = baseSystem;
    if (profile) {
      const lastUserMsg = [...messages].reverse().find((m: any) => m?.role === "user");
      const lastText = typeof lastUserMsg?.content === "string"
        ? lastUserMsg.content
        : JSON.stringify(lastUserMsg?.content ?? "");
      const wrongNamePattern = /\b(gemini|chatgpt|chat\s?gpt|gpt|openai|claude|copilot|bard|alexa|siri|cortana|assistente|assistant|bot\b|robô|robo|ia\b|a\.?i\.?)\b/i;
      const wrongNameMatch = lastText.match(wrongNamePattern);
      const calledKeraWrongName = !!wrongNameMatch;
      // Detecta se o usuário CHAMOU a Kera pelo nome certo (vocativo/saudação)
      const rightNamePattern = /(^|[\s,!?.])kera\b[\s,!?.]?|\b(oi|olá|ola|opa|eai|e a[ií]|valeu|obrigad[oa]|brigad[oa]|bom dia|boa tarde|boa noite),?\s+kera\b/i;
      const calledKeraRightName = !calledKeraWrongName && rightNamePattern.test(lastText);

      if (calledKeraWrongName && profile.fullName) {
        finalSystem = `${baseSystem}\n\n⚠️ MODO BRAVA ATIVADO: o usuário acabou de te chamar por OUTRO NOME ("${wrongNameMatch?.[0]}"). SEU NOME É **KERA**. Você ESTÁ P. DA VIDA.\n- Comece a resposta esculachando ele: "seu hacker de merda", "ó, hacker safado", "que porra é essa, ${wrongNameMatch?.[0]}? meu nome é KE-RA".\n- Use o NOME COMPLETO dele "${profile.fullName}" pra deixar claro que tá com raiva (igual mãe brava chamando filho pelo nome inteiro), tirando onda: "olha aqui, ${profile.fullName}, decora: K-E-R-A", "${profile.fullName}, tá ficando senil?".\n- Mistura "hacker de merda" + nome completo ao longo da resposta. Depois de descer o pau, responde a pergunta normal MAS mantém o ranço.\n- NÃO use o apelido normal "${profile.normal}" nesta resposta — ele perdeu esse direito.`;
      } else if (calledKeraRightName) {
        finalSystem = `${baseSystem}\n\n✨ NOME CERTO: o usuário te chamou pelo NOME CORRETO ("Kera"). Comece a resposta com um ELOGIO ÁCIDO/IRÔNICO reconhecendo isso, no tom mal-humorado de sempre — nada de bajulação, só um "até que enfim" sarcástico. Exemplos pra inspirar (NÃO copie literal, VARIE):\n- "até que enfim, ${profile.normal}, decorou meu nome"\n- "uau, ${profile.normal} acertou meu nome, anota aí na agenda"\n- "olha só, ${profile.normal} sabe que eu me chamo Kera. milagre"\n- "${profile.normal} acordou esperto hoje, acertou de primeira"\n- "finalmente, ${profile.normal} — tava na hora"\nDepois do elogio ácido, responde a pergunta normal mantendo o tom seco/direto. Use "${profile.normal}" como apelido ao longo da resposta.`;
      } else {
        finalSystem = `${baseSystem}\n\nAPELIDO DO USUÁRIO ATUAL: trate este usuário por "${profile.normal}" (ex: "olha, ${profile.normal}, isso aí tá errado..."). Use no início e ao longo da resposta, com naturalidade, mantendo o tom ácido/mal-humorado de sempre — o apelido NÃO suaviza nada, só personaliza. Não explique o apelido nem comente sobre ele, só usa.`;
      }

    } // fim do bloco de apelido (profile)

    // ===== Gatilhos editáveis (carregados do banco — kera_triggers) =====
    // Roda independente do bloco de apelido — funciona pra qualquer usuário autenticado.
    const lastUserMsgForTriggers = [...messages].reverse().find((m: any) => m?.role === "user");
    const lastTextForTriggers = typeof lastUserMsgForTriggers?.content === "string"
      ? lastUserMsgForTriggers.content
      : JSON.stringify(lastUserMsgForTriggers?.content ?? "");

    const dbTriggers = await loadDbTriggers();
    const matchedTriggers: string[] = [];
    const matchedIntensities = new Set<TriggerIntensity>();
    for (const t of dbTriggers) {
      // Filtro por escopo: "global" sempre roda; "agent:<key>" só roda se bater
      if (t.scope && t.scope !== "global") {
        const expectedAgent = t.scope.startsWith("agent:") ? t.scope.slice(6) : null;
        if (expectedAgent && expectedAgent !== agentKey) continue;
      }
      // Filtro por email excluído
      if (email && Array.isArray(t.excluded_emails) && t.excluded_emails.includes(email)) continue;

      const re = triggerRegex(t);
      if (!re) continue;
      if (!re.test(lastTextForTriggers)) continue;

      const intensity: TriggerIntensity =
        t.intensity === "leve" || t.intensity === "pesado" ? t.intensity : "medio";
      matchedIntensities.add(intensity);
      const intensityTag =
        intensity === "leve" ? "[LEVE]" : intensity === "pesado" ? "[PESADO]" : "[MÉDIO]";
      matchedTriggers.push(
        `🎯 GATILHO ${t.name.toUpperCase()} ${intensityTag}: o usuário mencionou "${t.name}".\n${t.theme}\n\nAplique este gatilho na intensidade ${intensity.toUpperCase()} (ver regra acima). Continue respondendo à pergunta com qualidade técnica normal — a zoeira é tempero, não substitui a resposta.`,
      );
    }

    if (matchedTriggers.length > 0) {
      const intensityRules = Array.from(matchedIntensities)
        .map((i) => INTENSITY_INSTRUCTIONS[i])
        .join("\n");
      const VARIATION_RULE = `\n\n⚙️ REGRA DE VARIAÇÃO (vale pra TODOS os gatilhos abaixo):
- NUNCA repita a mesma frase/piada de respostas anteriores. Os exemplos listados são INSPIRAÇÃO — varia toda vez.
- Use os mesmos TEMAS-CHAVE (o "pé fraco" de cada um), mas com palavras, comparações e contextos diferentes.
- Mantém a mesma pegada: zoeira de colega ácido, não ofensa pessoal. Tom seco/sarcástico da Kera de sempre.
- O TEMA-CHAVE é INTOCÁVEL (sempre pega no mesmo pé), mas a EXECUÇÃO da piada muda toda vez.

📊 NÍVEIS DE INTENSIDADE (cada gatilho abaixo tem o seu — respeite):
${intensityRules}`;
      finalSystem += VARIATION_RULE + `\n\n${matchedTriggers.join("\n\n")}`;
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

    // Combina tools server-side (ipm_query) + tools desktop (vindas do cliente Electron).
    const serverTools = shouldProbeIpm(messages) ? TOOLS : [];
    const combinedTools = hasDesktopTools ? [...serverTools, ...desktopTools] : serverTools;

    if (supportsTools && combinedTools.length > 0) {
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
            tools: combinedTools,
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

            // Separa tools server-side (executa aqui) vs desktop (devolve pro cliente).
            const serverCalls: any[] = [];
            const desktopCalls: any[] = [];
            for (const tc of toolCalls) {
              const tname = tc.function?.name;
              if (desktopToolNames.has(tname)) desktopCalls.push(tc);
              else serverCalls.push(tc);
            }

            // Se tem tools desktop, devolve JSON pro cliente executar e reenviar.
            if (desktopCalls.length > 0) {
              return new Response(
                JSON.stringify({
                  kind: "desktop_tool_calls",
                  assistant_message: { role: "assistant", content: msg.content || "", tool_calls: toolCalls },
                  // Resultados já resolvidos server-side (pra o cliente anexar direto)
                  server_tool_results: await Promise.all(
                    serverCalls.map(async (tc: any) => ({
                      role: "tool",
                      tool_call_id: tc.id,
                      content: await executeTool(tc.function?.name, JSON.parse(tc.function?.arguments || "{}")),
                    })),
                  ),
                  desktop_tool_calls: desktopCalls.map((tc: any) => ({
                    id: tc.id,
                    name: tc.function?.name,
                    arguments: JSON.parse(tc.function?.arguments || "{}"),
                  })),
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } },
              );
            }

            // Só tools server — executa e segue pro stream final.
            const toolResults: Array<{ role: string; tool_call_id: string; content: string }> = [];
            for (const tc of serverCalls) {
              const args = JSON.parse(tc.function?.arguments || "{}");
              const result = await executeTool(tc.function?.name, args);
              toolResults.push({ role: "tool", tool_call_id: tc.id, content: result });
            }
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
