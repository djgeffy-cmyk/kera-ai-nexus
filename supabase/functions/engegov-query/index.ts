// Consulta o Portal GEVO (engegov.net.br) via Firecrawl.
// Suporta:
//   - tipo='lista'   -> dashboard de obras do município
//   - tipo='detalhe' -> página de uma obra específica
//
// Body:
//   { tipo: 'lista', cidade_id: 4900, force_refresh?: boolean }
//   { tipo: 'lista', cidade_nome: 'Massaranduba', uf?: 'SC' }
//   { tipo: 'detalhe', cidade_id: 4900, obra_url: 'https://...' }
//
// Esta função é chamada server-to-server pelo chat-kera (que já valida o usuário)
// e também pelo painel admin via supabase.functions.invoke (autenticado).
// Cache: 6h por chave (cidade+tipo+obra).
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PORTAL_BASE = "https://www.engegov.net.br/portal-gevo";
const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

interface ListaPayload {
  tipo: "lista";
  cidade_id?: number;
  cidade_nome?: string;
  uf?: string;
  force_refresh?: boolean;
}
interface DetalhePayload {
  tipo: "detalhe";
  cidade_id: number;
  obra_url: string;
  force_refresh?: boolean;
}
type Payload = ListaPayload | DetalhePayload;

async function firecrawlScrape(url: string, apiKey: string) {
  const r = await fetch(`${FIRECRAWL_V2}/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown", "links"],
      onlyMainContent: false, // o portal usa JSF, conteúdo fica espalhado
      waitFor: 2500,
    }),
  });
  const data = await r.json();
  if (!r.ok) {
    throw new Error(`Firecrawl ${r.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }
  // SDK pode devolver no top-level OU em data.data
  return {
    markdown: data.markdown ?? data.data?.markdown ?? "",
    links: (data.links ?? data.data?.links ?? []) as string[],
    metadata: data.metadata ?? data.data?.metadata ?? {},
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_KEY) {
      return new Response(JSON.stringify({ error: "FIRECRAWL_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE);

    const body = (await req.json()) as Payload;
    if (!body?.tipo) throw new Error("Campo 'tipo' obrigatório (lista|detalhe).");

    // ---- Resolver cidade_id se vier por nome ----
    let cidadeId: number | undefined =
      "cidade_id" in body ? body.cidade_id : undefined;
    let municipio: { nome: string; uf: string; cidade_id: number } | null = null;

    if (body.tipo === "lista" && !cidadeId && body.cidade_nome) {
      const q = admin.from("engegov_municipios")
        .select("nome, uf, cidade_id")
        .eq("enabled", true)
        .ilike("nome", `%${body.cidade_nome}%`);
      if (body.uf) q.eq("uf", body.uf.toUpperCase());
      const { data, error } = await q.limit(1).maybeSingle();
      if (error) throw error;
      if (data) { municipio = data; cidadeId = data.cidade_id; }
    }

    if (!cidadeId) {
      return new Response(JSON.stringify({
        error: "Município não encontrado. Cadastre em /admin > EngeGov.",
      }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Carrega dados do município se ainda não veio
    if (!municipio) {
      const { data } = await admin.from("engegov_municipios")
        .select("nome, uf, cidade_id")
        .eq("cidade_id", cidadeId).maybeSingle();
      municipio = data;
    }

    // ---- Cache key ----
    const cacheKey = body.tipo === "lista"
      ? `lista:${cidadeId}`
      : `detalhe:${cidadeId}:${(body as DetalhePayload).obra_url}`;

    if (!body.force_refresh) {
      const { data: cached } = await admin
        .from("engegov_cache")
        .select("response, expires_at, hit_count")
        .eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (cached) {
        await admin.from("engegov_cache")
          .update({ hit_count: (cached.hit_count ?? 0) + 1, last_hit_at: new Date().toISOString() })
          .eq("cache_key", cacheKey);
        return new Response(JSON.stringify({
          ok: true, cached: true, municipio, ...(cached.response as object),
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ---- Scrape ----
    const targetUrl = body.tipo === "lista"
      ? `${PORTAL_BASE}/dashboard.xhtml?cidade=${cidadeId}`
      : (body as DetalhePayload).obra_url;

    const scraped = await firecrawlScrape(targetUrl, FIRECRAWL_KEY);

    // Filtra links das obras (heurística: links do portal-gevo que NÃO sejam o dashboard)
    const obraLinks = (scraped.links || []).filter(l =>
      l.includes("portal-gevo") &&
      !l.includes("dashboard.xhtml") &&
      !l.includes("javax.faces.resource")
    );

    const response = {
      url: targetUrl,
      tipo: body.tipo,
      conteudo: scraped.markdown,
      links_obras: [...new Set(obraLinks)].slice(0, 100),
      metadata: scraped.metadata,
      scraped_at: new Date().toISOString(),
    };

    // ---- Salva cache ----
    await admin.from("engegov_cache").upsert({
      cache_key: cacheKey,
      cidade_id: cidadeId,
      tipo: body.tipo,
      obra_id: body.tipo === "detalhe" ? (body as DetalhePayload).obra_url : null,
      url: targetUrl,
      response,
      hit_count: 0,
      created_at: new Date().toISOString(),
      last_hit_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
    }, { onConflict: "cache_key" });

    return new Response(JSON.stringify({
      ok: true, cached: false, municipio, ...response,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("engegov-query error:", e);
    return new Response(JSON.stringify({
      ok: false, error: e instanceof Error ? e.message : String(e),
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});