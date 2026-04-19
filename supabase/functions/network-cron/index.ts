// Edge function: cron de medição de rede.
// Chamada por pg_cron a cada 30min. Para CADA usuário com monitor_targets
// habilitados, mede latência/perda/jitter via HTTPS HEAD e persiste em
// network_metrics usando service role (bypass RLS).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Sample = { ok: boolean; ms: number | null; status: number | null };

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
      headers: { "User-Agent": "Sentinela-Cron/1.0" },
    });
    const ms = Math.round(performance.now() - start);
    try { await r.body?.cancel(); } catch { /* noop */ }
    return { ok: true, ms, status: r.status };
  } catch {
    const ms = Math.round(performance.now() - start);
    return { ok: false, ms, status: null };
  } finally {
    clearTimeout(t);
  }
}

async function resolveIp(host: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`,
      { headers: { accept: "application/dns-json" } },
    );
    const j = await r.json();
    const ans = (j?.Answer ?? []).find((a: { type: number; data: string }) => a.type === 1);
    return ans?.data ?? null;
  } catch {
    return null;
  }
}

async function pingHost(rawUrl: string, count = 4) {
  const { host, url } = normalizeHost(rawUrl);
  const samples: Sample[] = [];
  for (let i = 0; i < count; i++) {
    samples.push(await probe(url));
    if (i < count - 1) await new Promise((r) => setTimeout(r, 250));
  }
  const ok = samples.filter((s) => s.ok && s.ms !== null);
  const times = ok.map((s) => s.ms!) as number[];
  const sent = samples.length;
  const received = ok.length;
  const lossPct = Math.round(((sent - received) / sent) * 100);
  const min = times.length ? Math.min(...times) : null;
  const max = times.length ? Math.max(...times) : null;
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  const jitter = times.length > 1
    ? Math.round(Math.sqrt(times.reduce((s, t) => s + (t - (avg ?? 0)) ** 2, 0) / times.length))
    : null;
  const resolvedIp = await resolveIp(host);
  const lastStatus = samples[samples.length - 1]?.status ?? null;
  return { host, url, sent, received, lossPct, min, avg, max, jitter, resolvedIp, lastStatus };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Pega TODOS os targets habilitados (de todos os usuários)
    const { data: targets, error } = await supabase
      .from("monitor_targets")
      .select("id, user_id, label, url")
      .eq("enabled", true);

    if (error) throw error;
    if (!targets || targets.length === 0) {
      return new Response(JSON.stringify({ ok: true, measured: 0, note: "nenhum alvo habilitado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mede em paralelo (limita lote pra não estourar)
    const measurements = await Promise.all(
      targets.map(async (t) => {
        const m = await pingHost(t.url, 4);
        return {
          user_id: t.user_id,
          target_id: t.id,
          label: t.label,
          host: m.host,
          url: m.url,
          sent: m.sent,
          received: m.received,
          loss_pct: m.lossPct,
          min_ms: m.min,
          avg_ms: m.avg,
          max_ms: m.max,
          jitter_ms: m.jitter,
          last_status: m.lastStatus,
          resolved_ip: m.resolvedIp,
        };
      }),
    );

    const { error: insErr } = await supabase.from("network_metrics").insert(measurements);
    if (insErr) throw insErr;

    // Limpeza: mantém só últimos 30 dias
    await supabase
      .from("network_metrics")
      .delete()
      .lt("checked_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    return new Response(
      JSON.stringify({
        ok: true,
        measured: measurements.length,
        elapsedMs: Date.now() - startedAt,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("network-cron error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
