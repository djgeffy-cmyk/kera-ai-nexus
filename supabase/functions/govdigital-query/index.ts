// govdigital-query — scraping autenticado do portal Guaramirim na Mão (govdigital.app)
// Usa Firecrawl `actions` pra logar com credenciais que o usuário fornece no chat.
// Credenciais NUNCA são persistidas — recebe-se por requisição, usa-se, descarta.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";
const PORTAL_BASE = "https://guaramirimnamao.govdigital.app";
const LOGIN_URL = `${PORTAL_BASE}/login`;
const DEFAULT_TARGET_PATHS = ["/meus-chamados", "/chamados", "/solicitacoes", "/ouvidoria", "/"];

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          numero: { type: "string", description: "Número/protocolo do chamado" },
          assunto: { type: "string" },
          secretaria: { type: "string" },
          status: { type: "string", description: "aberto, em andamento, concluído etc." },
          data_abertura: { type: "string" },
          ultima_atualizacao: { type: "string" },
          descricao: { type: "string" },
          link: { type: "string" },
        },
      },
    },
    total_encontrado: { type: "number" },
    observacoes: { type: "string" },
  },
  required: ["items"],
};

const PROMPTS: Record<string, string> = {
  meus_chamados:
    "Liste TODOS os chamados/protocolos do usuário logado visíveis nesta página: número, assunto, secretaria, status (aberto/em andamento/concluído), data de abertura, última atualização e link. Não invente — só o que está visível.",
  detalhe:
    "Extraia os detalhes completos do chamado/protocolo aberto nesta página: número, assunto, descrição, secretaria, status, data de abertura, última atualização, histórico de movimentações e link.",
  generico:
    "Extraia todos os dados estruturados visíveis na página em formato de lista de itens.",
};

interface QueryBody {
  username?: string;
  password?: string;
  tipo?: "meus_chamados" | "detalhe" | "generico";
  path?: string; // path relativo ao PORTAL_BASE, ex "/meus-chamados" ou "/protocolo/12345"
  filtro_status?: string;
}

function targetUrl(path?: string): string {
  if (!path) return `${PORTAL_BASE}/`;
  if (path.startsWith("http")) return path;
  return `${PORTAL_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

async function scrapeAuthed(opts: {
  username: string;
  password: string;
  url: string;
  prompt: string;
}): Promise<{ items: unknown[]; raw_preview: string; error?: string }> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) return { items: [], raw_preview: "", error: "FIRECRAWL_API_KEY não configurada" };

  // Sequência de actions:
  // 1) navega pro login → 2) digita user → 3) digita senha → 4) clica entrar
  // 5) espera carregar → 6) navega pra URL final → 7) espera → 8) scrape
  const actions = [
    { type: "navigate", url: LOGIN_URL },
    { type: "wait", milliseconds: 2000 },
    { type: "write", selector: 'input[type="email"]', text: opts.username },
    { type: "write", selector: 'input[name="email"]', text: opts.username },
    { type: "write", selector: 'input[name="usuario"]', text: opts.username },
    { type: "write", selector: 'input[name="login"]', text: opts.username },
    { type: "write", selector: 'input[type="text"]', text: opts.username },
    { type: "write", selector: 'input[type="password"]', text: opts.password },
    { type: "write", selector: 'input[name="senha"]', text: opts.password },
    { type: "write", selector: 'input[name="password"]', text: opts.password },
    { type: "click", selector: 'button[type="submit"]' },
    { type: "click", selector: 'button, a, input[type="submit"]', text: 'Entrar' },
    { type: "click", selector: 'button, a, input[type="submit"]', text: 'Login' },
    { type: "wait", milliseconds: 3500 },
    { type: "navigate", url: opts.url },
    { type: "wait", milliseconds: 3000 },
  ];

  try {
    const r = await fetch(`${FIRECRAWL_V2}/scrape`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url: LOGIN_URL,
        formats: ["markdown", { type: "json", schema: SCHEMA, prompt: opts.prompt }],
        onlyMainContent: false,
        actions,
        location: { country: "BR", languages: ["pt-BR"] },
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      return {
        items: [],
        raw_preview: "",
        error: `Firecrawl ${r.status}: ${JSON.stringify(data).slice(0, 300)}`,
      };
    }
    const payload = data?.data ?? data;
    const items = (payload?.json?.items ?? []) as unknown[];
    const preview = (payload?.markdown ?? "").slice(0, 1500);

    // Heurística: se a página final ainda tem "Entrar" / "Login" no markdown,
    // provavelmente o login falhou (credencial errada ou seletor não bateu).
    const looksLikeLoginPage = /\b(entrar|login|esqueci.{0,10}senha)\b/i.test(preview) &&
      items.length === 0;
    if (looksLikeLoginPage) {
      return {
        items: [],
        raw_preview: preview,
        error: "Login parece ter falhado (página final ainda mostra tela de login). Confirma usuário e senha.",
      };
    }

    return { items, raw_preview: preview };
  } catch (e) {
    return { items: [], raw_preview: "", error: e instanceof Error ? e.message : "scrape falhou" };
  }
}

async function scrapeAcrossTargets(opts: {
  username: string;
  password: string;
  path?: string;
  prompt: string;
}): Promise<{ items: unknown[]; raw_preview: string; url: string; error?: string }> {
  const targets = opts.path ? [targetUrl(opts.path)] : DEFAULT_TARGET_PATHS.map((path) => targetUrl(path));

  let lastError: string | undefined;
  let lastPreview = "";

  for (const url of targets) {
    const result = await scrapeAuthed({ username: opts.username, password: opts.password, url, prompt: opts.prompt });
    if (Array.isArray(result.items) && result.items.length > 0) {
      return { items: result.items, raw_preview: result.raw_preview, url, error: result.error };
    }

    const previewSuggestsLoggedArea = /chamado|protocolo|ouvidoria|solicitaç|minhas/i.test(result.raw_preview);
    if (!result.error && previewSuggestsLoggedArea) {
      return { items: result.items, raw_preview: result.raw_preview, url, error: undefined };
    }

    lastError = result.error;
    lastPreview = result.raw_preview;
  }

  return {
    items: [],
    raw_preview: lastPreview,
    url: targets[0] ?? targetUrl(opts.path),
    error: lastError ?? "Não achei a área de chamados no portal após o login.",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => ({}))) as QueryBody;
    const { username, password, tipo = "meus_chamados", path, filtro_status } = body;

    if (!username || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          needs_credentials: true,
          error:
            "Pra consultar o Guaramirim na Mão eu preciso do teu login (usuário/email) e senha do portal. Me passa que eu busco — não guardo nada.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const prompt = PROMPTS[tipo] ?? PROMPTS.generico;

    const r = await scrapeAcrossTargets({ username, password, path, prompt });

    let items = r.items;
    if (filtro_status && Array.isArray(items)) {
      const f = filtro_status.toLowerCase();
      items = items.filter((it: any) =>
        typeof it?.status === "string" && it.status.toLowerCase().includes(f)
      );
    }

    return new Response(
      JSON.stringify({
        success: !r.error,
        source: "govdigital_scraping",
        portal: "Guaramirim na Mão",
        url: r.url,
        tipo,
        filtro_status: filtro_status ?? null,
        total: items.length,
        items,
        raw_preview: r.raw_preview,
        error: r.error,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[govdigital-query] erro:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});