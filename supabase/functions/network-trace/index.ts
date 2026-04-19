// Edge function: análise de rede simulando ping (HTTPS HEAD múltiplas vezes)
// Mede: latência mínima/média/máxima, jitter (desvio padrão) e perda de pacote.
// Equivalente funcional a `ping`/`mtr` para serviços HTTPS — não usa ICMP
// (Deno em edge não tem permissão raw socket).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Sample = { ok: boolean; ms: number | null; status: number | null; error?: string };
type HostResult = {
  host: string;
  url: string;
  samples: Sample[];
  sent: number;
  received: number;
  lossPct: number;
  minMs: number | null;
  avgMs: number | null;
  maxMs: number | null;
  jitterMs: number | null;
  resolvedIp?: string;
};

function normalizeHost(input: string): { host: string; url: string } {
  const cleaned = input.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return { host: cleaned, url: `https://${cleaned}/` };
}

async function probe(url: string, timeoutMs = 8000): Promise<Sample> {
  const start = performance.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: ctrl.signal,
      headers: { "User-Agent": "Sentinela-NetTrace/1.0" },
    });
    const ms = Math.round(performance.now() - start);
    try { await r.body?.cancel(); } catch { /* noop */ }
    return { ok: true, ms, status: r.status };
  } catch (e: unknown) {
    const ms = Math.round(performance.now() - start);
    const err = e instanceof Error ? e.message : "unknown";
    return { ok: false, ms, status: null, error: err };
  } finally {
    clearTimeout(t);
  }
}

async function resolveIp(host: string): Promise<string | undefined> {
  // Usa DoH (Cloudflare) — Deno.resolveDns também funciona mas precisa permissão.
  try {
    const r = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`,
      { headers: { accept: "application/dns-json" } },
    );
    const j = await r.json();
    const ans = (j?.Answer ?? []).find((a: { type: number; data: string }) => a.type === 1);
    return ans?.data;
  } catch {
    return undefined;
  }
}

async function pingHost(host: string, count: number): Promise<HostResult> {
  const { url } = normalizeHost(host);
  const samples: Sample[] = [];
  // sequencial (mais realista pra medir jitter)
  for (let i = 0; i < count; i++) {
    samples.push(await probe(url));
    if (i < count - 1) await new Promise((r) => setTimeout(r, 300));
  }
  const ok = samples.filter((s) => s.ok && s.ms !== null);
  const times = ok.map((s) => s.ms!) as number[];
  const sent = samples.length;
  const received = ok.length;
  const lossPct = sent ? Math.round(((sent - received) / sent) * 100) : 0;
  const min = times.length ? Math.min(...times) : null;
  const max = times.length ? Math.max(...times) : null;
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  const jitter = times.length > 1
    ? Math.round(Math.sqrt(times.reduce((s, t) => s + (t - (avg ?? 0)) ** 2, 0) / times.length))
    : null;
  const resolvedIp = await resolveIp(normalizeHost(host).host);
  return {
    host: normalizeHost(host).host,
    url,
    samples,
    sent,
    received,
    lossPct,
    minMs: min,
    avgMs: avg,
    maxMs: max,
    jitterMs: jitter,
    resolvedIp,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const rawHosts: unknown = body?.hosts;
    const count = Math.min(Math.max(Number(body?.count ?? 5), 1), 10);

    const hosts: string[] = Array.isArray(rawHosts)
      ? rawHosts.filter((h): h is string => typeof h === "string" && h.length > 0).slice(0, 8)
      : ["guaramirim.atende.net"];

    if (hosts.length === 0) {
      return new Response(JSON.stringify({ error: "hosts vazio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await Promise.all(hosts.map((h) => pingHost(h, count)));
    const summary = {
      hostsTested: results.length,
      probesPerHost: count,
      checkedAt: new Date().toISOString(),
      origin: "Lovable Cloud edge (proxy de medição — não é a rota da Prefeitura)",
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
