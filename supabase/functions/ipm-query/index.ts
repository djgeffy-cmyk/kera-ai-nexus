// ipm-query — consulta endpoints IPM cadastrados pelo admin + fallback scraping
// Usado como "ferramenta" pela Kera via tool calling no chat-kera.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

interface IpmEndpoint {
  id: string;
  label: string;
  base_url: string;
  kind: "public" | "authenticated" | "transparency";
  auth_type: "none" | "bearer" | "apikey" | "basic";
  token: string | null;
  notes: string | null;
  enabled: boolean;
}

const PROMPTS: Record<string, string> = {
  licitacoes:
    "Extraia TODAS as licitações listadas. Para cada uma: numero, modalidade, objeto, status (aberta/em andamento/homologada/deserta), data_abertura, data_encerramento, valor, vencedor (se já houver), link.",
  protocolos:
    "Extraia todos os protocolos: numero, assunto/objeto, secretaria, data_abertura, status (aberto/em andamento/concluído), tempo_aberto, requerente.",
  contratos:
    "Extraia contratos: numero, objeto, vencedor (contratada), valor, data_abertura (assinatura), data_encerramento (vigência), status.",
  receitas:
    "Extraia receitas/despesas: descrição (em objeto), valor, data, secretaria, status.",
  generico:
    "Extraia todos os dados estruturados relevantes da página em formato de lista de items.",
};

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          numero: { type: "string" },
          modalidade: { type: "string" },
          objeto: { type: "string" },
          status: { type: "string" },
          data_abertura: { type: "string" },
          data_encerramento: { type: "string" },
          valor: { type: "string" },
          secretaria: { type: "string" },
          tempo_aberto: { type: "string" },
          vencedor: { type: "string" },
          requerente: { type: "string" },
          link: { type: "string" },
        },
      },
    },
    total_encontrado: { type: "number" },
    observacoes: { type: "string" },
  },
  required: ["items"],
};

function buildAuthHeaders(ep: IpmEndpoint): Record<string, string> {
  if (!ep.token) return {};
  switch (ep.auth_type) {
    case "bearer": return { Authorization: `Bearer ${ep.token}` };
    case "apikey": return { "X-API-Key": ep.token };
    case "basic": return { Authorization: `Basic ${btoa(ep.token)}` };
    default: return {};
  }
}

async function tryRestCall(ep: IpmEndpoint, path: string): Promise<unknown | null> {
  try {
    const url = path.startsWith("http") ? path : `${ep.base_url.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
    const r = await fetch(url, {
      headers: { Accept: "application/json", ...buildAuthHeaders(ep) },
    });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") ?? "";
    if (!ct.includes("json")) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function scrapeWithFirecrawl(url: string, tipo: string): Promise<{ items: unknown[]; raw_preview: string; error?: string }> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) return { items: [], raw_preview: "", error: "FIRECRAWL_API_KEY não configurada" };
  const prompt = PROMPTS[tipo] ?? PROMPTS.generico;
  try {
    const r = await fetch(`${FIRECRAWL_V2}/scrape`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formats: ["markdown", { type: "json", schema: SCHEMA, prompt }],
        onlyMainContent: true,
        waitFor: 2500,
        location: { country: "BR", languages: ["pt-BR"] },
      }),
    });
    const data = await r.json();
    if (!r.ok) return { items: [], raw_preview: "", error: `Firecrawl ${r.status}: ${JSON.stringify(data).slice(0, 200)}` };
    const payload = data?.data ?? data;
    const items = (payload?.json?.items ?? []) as unknown[];
    const preview = (payload?.markdown ?? "").slice(0, 1500);
    return { items, raw_preview: preview };
  } catch (e) {
    return { items: [], raw_preview: "", error: e instanceof Error ? e.message : "scrape failed" };
  }
}

// TTL padrão do cache (segundos). 6h = 21600. Pode ser sobrescrito por body.cache_ttl.
const DEFAULT_CACHE_TTL = 6 * 60 * 60;

function buildCacheKey(parts: {
  tipo: string;
  filtroStatus?: string;
  endpointId?: string;
  customUrl?: string;
  path?: string;
}): string {
  return [
    parts.tipo,
    parts.filtroStatus ?? "",
    parts.endpointId ?? "",
    parts.customUrl ?? "",
    parts.path ?? "",
  ].join("::");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const tipo: string = body.tipo || "generico";
    const filtroStatus: string | undefined = body.filtro_status; // ex "aberta"
    const endpointId: string | undefined = body.endpoint_id;
    const customUrl: string | undefined = body.url;
    const path: string | undefined = body.path; // path REST opcional
    const skipCache: boolean = body.skip_cache === true || body.no_cache === true;
    const cacheTtl: number = Number.isFinite(body.cache_ttl) ? Number(body.cache_ttl) : DEFAULT_CACHE_TTL;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const cacheKey = buildCacheKey({ tipo, filtroStatus, endpointId, customUrl, path });

    // ─── 1) Tenta cache ───
    if (!skipCache) {
      const { data: cached } = await supabase
        .from("ipm_query_cache")
        .select("id, response, hit_count, created_at, expires_at")
        .eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (cached) {
        // Atualiza hit count + last_hit (fire-and-forget — não bloqueia resposta)
        supabase
          .from("ipm_query_cache")
          .update({
            hit_count: (cached.hit_count ?? 0) + 1,
            last_hit_at: new Date().toISOString(),
          })
          .eq("id", cached.id)
          .then(() => {});

        const cachedResponse = cached.response as Record<string, unknown>;
        return new Response(JSON.stringify({
          ...cachedResponse,
          cached: true,
          cache_hit_count: (cached.hit_count ?? 0) + 1,
          cached_at: cached.created_at,
          cache_expires_at: cached.expires_at,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ─── 2) Sem cache: busca dados reais ───
    let responsePayload: Record<string, unknown>;

    // Carrega endpoints ativos
    let query = supabase.from("ipm_endpoints").select("*").eq("enabled", true);
    if (endpointId) query = query.eq("id", endpointId);
    const { data: endpoints, error } = await query;
    if (error) throw new Error("DB: " + error.message);

    const list = (endpoints ?? []) as IpmEndpoint[];

    // Se passou URL custom, usa direto via Firecrawl
    if (customUrl) {
      const r = await scrapeWithFirecrawl(customUrl, tipo);
      responsePayload = {
        success: true,
        source: "scraping_direto",
        url: customUrl,
        tipo,
        total: r.items.length,
        items: r.items,
        raw_preview: r.raw_preview,
        error: r.error,
      };
    } else if (list.length === 0) {
      // Não cacheia ausência de endpoints
      return new Response(JSON.stringify({
        success: false,
        error: "Nenhum endpoint IPM cadastrado/habilitado. Cadastre em /admin → APIs IPM.",
      }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      const results: Array<Record<string, unknown>> = [];
      for (const ep of list) {
        // 1) Tentativa REST se for autenticado e tem path/inferência
        if (ep.auth_type !== "none" && path) {
          const json = await tryRestCall(ep, path);
          if (json) {
            results.push({
              endpoint: ep.label,
              base_url: ep.base_url,
              kind: ep.kind,
              source: "rest_api",
              data: json,
            });
            continue;
          }
        }

        // 2) Fallback: scraping com Firecrawl
        const targetUrl = path && !path.startsWith("http")
          ? `${ep.base_url.replace(/\/$/, "")}/${path.replace(/^\//, "")}`
          : (path ?? ep.base_url);
        const r = await scrapeWithFirecrawl(targetUrl, tipo);
        let items = r.items;

        if (filtroStatus && Array.isArray(items)) {
          const f = filtroStatus.toLowerCase();
          items = items.filter((it: any) =>
            typeof it?.status === "string" && it.status.toLowerCase().includes(f)
          );
        }

        results.push({
          endpoint: ep.label,
          base_url: ep.base_url,
          kind: ep.kind,
          source: "scraping",
          url: targetUrl,
          total: items.length,
          items,
          raw_preview: r.raw_preview,
          error: r.error,
        });
      }

      responsePayload = {
        success: true,
        tipo,
        filtro_status: filtroStatus ?? null,
        consulted_at: new Date().toISOString(),
        results,
      };
    }

    // ─── 3) Salva no cache (apenas se sucesso) ───
    if (!skipCache && responsePayload.success === true) {
      const expiresAt = new Date(Date.now() + cacheTtl * 1000).toISOString();
      const { error: upErr } = await supabase
        .from("ipm_query_cache")
        .upsert({
          cache_key: cacheKey,
          tipo,
          filtro_status: filtroStatus ?? null,
          endpoint_id: endpointId ?? null,
          url: customUrl ?? null,
          path: path ?? null,
          response: responsePayload,
          hit_count: 0,
          created_at: new Date().toISOString(),
          last_hit_at: new Date().toISOString(),
          expires_at: expiresAt,
        }, { onConflict: "cache_key" });
      if (upErr) console.warn("[ipm-query] cache upsert erro:", upErr.message);
    }

    return new Response(JSON.stringify({
      ...responsePayload,
      cached: false,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[ipm-query] erro:", e);
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : "Erro desconhecido",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
