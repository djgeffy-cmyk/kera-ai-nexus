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
// Filament/Livewire admin panel — rotas comuns pós-login
const DEFAULT_TARGET_PATHS = [
  "/",
  "/meus-chamados",
  "/chamados",
  "/solicitacoes",
  "/ouvidoria",
  "/protocolos",
];

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

  // Portal é Filament 3 + Livewire (Laravel). Campos têm IDs `form.email` e `form.password`,
  // mas usam wire:model — precisamos disparar input event pra Livewire enxergar o valor.
  // Estratégia: click → write → executeJavascript pra dispatch input → click submit.
  const escapedUser = opts.username.replace(/"/g, '\\"');
  const escapedPass = opts.password.replace(/"/g, '\\"');
  const actions = [
    { type: "navigate", url: LOGIN_URL },
    { type: "wait", milliseconds: 2500 },
    // Foca e digita email
    { type: "click", selector: '#\\31  #form\\.email, input[type="email"]' },
    { type: "wait", milliseconds: 200 },
    { type: "write", selector: 'input[type="email"]', text: opts.username },
    { type: "wait", milliseconds: 200 },
    // Foca e digita senha
    { type: "click", selector: 'input[type="password"]' },
    { type: "wait", milliseconds: 200 },
    { type: "write", selector: 'input[type="password"]', text: opts.password },
    { type: "wait", milliseconds: 300 },
    // Força sync do Livewire: dispara input event nos dois campos via JS puro
    {
      type: "executeJavascript",
      script: `
        const e = document.querySelector('input[type="email"]');
        const p = document.querySelector('input[type="password"]');
        if (e) { e.value = "${escapedUser}"; e.dispatchEvent(new Event('input', {bubbles:true})); e.dispatchEvent(new Event('change', {bubbles:true})); e.dispatchEvent(new Event('blur', {bubbles:true})); }
        if (p) { p.value = "${escapedPass}"; p.dispatchEvent(new Event('input', {bubbles:true})); p.dispatchEvent(new Event('change', {bubbles:true})); p.dispatchEvent(new Event('blur', {bubbles:true})); }
      `,
    },
    { type: "wait", milliseconds: 800 },
    // Submit (Livewire intercepta o submit do form)
    { type: "click", selector: 'button[type="submit"]' },
    { type: "wait", milliseconds: 4500 },
    // Vai pro destino
    { type: "navigate", url: opts.url },
    { type: "wait", milliseconds: 3500 },
  ];

  try {
    const r = await fetch(`${FIRECRAWL_V2}/scrape`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // O Firecrawl scrapeia a URL final após executar todas as actions.
        // Começamos pela URL alvo; a primeira action navega pro login, faz auth, e volta pra cá.
        url: opts.url,
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

    // Heurística: se a página final ainda tem "Esqueceu sua senha" / "Lembre de mim"
    // (textos exclusivos da tela de login do Filament), o login falhou.
    const looksLikeLoginPage =
      /(esqueceu sua senha|lembre de mim|e-?mail.{0,30}senha)/i.test(preview) &&
      items.length === 0;
    if (looksLikeLoginPage) {
      return {
        items: [],
        raw_preview: preview,
        error:
          "Login não passou — o portal devolveu a tela de login. Confere se o e-mail e senha estão certinhos (é o mesmo cadastro que tu usa em guaramirimnamao.govdigital.app).",
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