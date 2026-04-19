// Edge function: monitora disponibilidade de URLs públicas (HTTP HEAD/GET).
// Retorna status, latência, redirect, SSL info básica. NÃO faz scan invasivo.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CheckResult = {
  url: string;
  ok: boolean;
  status: number | null;
  statusText: string;
  latencyMs: number | null;
  finalUrl?: string;
  server?: string;
  contentType?: string;
  error?: string;
};

const DEFAULT_URLS = [
  "https://www.guaramirim.sc.gov.br",
  "https://guaramirim.sc.gov.br",
  // IPM público (portal do contribuinte tipico)
  "https://guaramirim.atende.net",
  // Webmail (Google Workspace genérico — aceita qualquer dominio)
  "https://mail.google.com",
];

async function checkUrl(url: string, timeoutMs = 10_000): Promise<CheckResult> {
  const start = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // GET com Range pequeno para evitar baixar tudo, mas alguns servers ignoram HEAD.
    const resp = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Sentinela-Monitor/1.0 (+https://kera.ai uptime check)",
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
      },
    });
    const latencyMs = Math.round(performance.now() - start);
    // descarta body para não vazar memória
    try { await resp.body?.cancel(); } catch { /* noop */ }
    return {
      url,
      ok: resp.ok,
      status: resp.status,
      statusText: resp.statusText,
      latencyMs,
      finalUrl: resp.url,
      server: resp.headers.get("server") ?? undefined,
      contentType: resp.headers.get("content-type") ?? undefined,
    };
  } catch (e: unknown) {
    const latencyMs = Math.round(performance.now() - start);
    const msg = e instanceof Error ? e.message : "unknown";
    return {
      url,
      ok: false,
      status: null,
      statusText: "ERROR",
      latencyMs,
      error: msg,
    };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let urls: string[] = DEFAULT_URLS;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (Array.isArray(body?.urls) && body.urls.length) {
        urls = body.urls
          .filter((u: unknown): u is string => typeof u === "string" && u.length > 0)
          .map((u: string) => (u.startsWith("http") ? u : `https://${u}`))
          .slice(0, 20); // máx 20 URLs por chamada
      }
    }

    const results = await Promise.all(urls.map((u) => checkUrl(u)));
    const summary = {
      total: results.length,
      up: results.filter((r) => r.ok).length,
      down: results.filter((r) => !r.ok).length,
      checkedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify({ summary, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
