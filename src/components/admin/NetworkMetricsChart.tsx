import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, RefreshCw, TrendingUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

const CRON_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/network-cron`;

type Metric = {
  id: string;
  label: string;
  host: string;
  loss_pct: number;
  avg_ms: number | null;
  jitter_ms: number | null;
  checked_at: string;
};

type HostStats = {
  host: string;
  label: string;
  samples: number;
  avgLatency: number;
  avgLoss: number;
  maxLoss: number;
  uptime: number;
  series: { time: string; latency: number | null; loss: number; jitter: number | null }[];
};

const COLORS = [
  "hsl(160 90% 45%)", // verde
  "hsl(190 90% 50%)", // ciano
  "hsl(280 80% 60%)", // roxo
  "hsl(30 90% 55%)",  // laranja
  "hsl(340 85% 55%)", // rosa
  "hsl(220 85% 60%)", // azul
];

export function NetworkMetricsChart() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("network_metrics")
      .select("id,label,host,loss_pct,avg_ms,jitter_ms,checked_at")
      .gte("checked_at", since)
      .order("checked_at", { ascending: true });
    if (error) toast.error(error.message);
    setMetrics((data || []) as Metric[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runNow = async () => {
    setRunning(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const resp = await fetch(CRON_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sess.session ? { Authorization: `Bearer ${sess.session.access_token}` } : {}),
        },
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error || `HTTP ${resp.status}`);
      toast.success(`✅ ${j.measured} alvo(s) medido(s) em ${j.elapsedMs}ms`);
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "erro";
      toast.error(`Falha: ${msg}`);
    } finally {
      setRunning(false);
    }
  };

  const stats: HostStats[] = useMemo(() => {
    const byHost = new Map<string, Metric[]>();
    for (const m of metrics) {
      const arr = byHost.get(m.host) ?? [];
      arr.push(m);
      byHost.set(m.host, arr);
    }
    return Array.from(byHost.entries()).map(([host, arr]) => {
      const label = arr[arr.length - 1]?.label ?? host;
      const lat = arr.map(a => a.avg_ms).filter((x): x is number => x !== null);
      const losses = arr.map(a => a.loss_pct);
      const avgLatency = lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0;
      const avgLoss = losses.length ? Math.round(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;
      const maxLoss = losses.length ? Math.max(...losses) : 0;
      const uptime = losses.length
        ? Math.round((losses.filter(l => l < 100).length / losses.length) * 100)
        : 0;
      const series = arr.map(a => ({
        time: new Date(a.checked_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        latency: a.avg_ms,
        loss: a.loss_pct,
        jitter: a.jitter_ms,
      }));
      return { host, label, samples: arr.length, avgLatency, avgLoss, maxLoss, uptime, series };
    }).sort((a, b) => b.avgLatency - a.avgLatency);
  }, [metrics]);

  return (
    <section className="pt-4 border-t border-border space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-cyan-400" />
          <div>
            <h2 className="font-display text-xl text-glow">Histórico de Rede (24h)</h2>
            <p className="text-xs text-muted-foreground">
              Sentinela mede automaticamente a cada 30 minutos. Latência, jitter e perda de pacote por host.
            </p>
          </div>
        </div>
        <Button onClick={runNow} disabled={running} variant="outline" size="sm" className="gap-2">
          <RefreshCw className={`size-4 ${running ? "animate-spin" : ""}`} />
          {running ? "Medindo…" : "Medir agora"}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando histórico…</p>
      ) : stats.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground space-y-2">
          <AlertTriangle className="size-8 mx-auto text-yellow-500/60" />
          <p>Nenhuma métrica nas últimas 24h.</p>
          <p className="text-xs">Cadastre URLs em "URLs do Sentinela" e clique em <span className="text-cyan-400">"Medir agora"</span> ou aguarde o próximo ciclo (30min).</p>
        </Card>
      ) : (
        <>
          {/* Cards de resumo */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((s, i) => {
              const lossFlag = s.avgLoss === 0 ? "🟢" : s.avgLoss < 20 ? "🟡" : s.avgLoss < 50 ? "🟠" : "🔴";
              return (
                <Card key={s.host} className="p-3 border-l-4" style={{ borderLeftColor: COLORS[i % COLORS.length] }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.host}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">{s.samples}x</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Latência</p>
                      <p className="text-sm font-bold text-cyan-400">{s.avgLatency}ms</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Perda</p>
                      <p className="text-sm font-bold">{lossFlag} {s.avgLoss}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground">Uptime</p>
                      <p className="text-sm font-bold text-emerald-400">{s.uptime}%</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Gráfico de latência */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="size-4 text-cyan-400" />
              <h3 className="text-sm font-medium">Latência média (ms) por host</h3>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="time"
                    type="category"
                    allowDuplicatedCategory={false}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} unit="ms" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {stats.map((s, i) => (
                    <Line
                      key={s.host}
                      data={s.series}
                      type="monotone"
                      dataKey="latency"
                      name={s.label}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Gráfico de perda */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="size-4 text-orange-400" />
              <h3 className="text-sm font-medium">Perda de pacote (%) por host</h3>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="time"
                    type="category"
                    allowDuplicatedCategory={false}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} unit="%" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {stats.map((s, i) => (
                    <Line
                      key={s.host}
                      data={s.series}
                      type="monotone"
                      dataKey="loss"
                      name={s.label}
                      stroke={COLORS[i % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}
    </section>
  );
}
