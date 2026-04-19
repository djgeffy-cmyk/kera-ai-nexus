import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Mic, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type Quota = {
  tier?: string | null;
  status?: string | null;
  used: number;
  limit: number;
  remaining: number;
  percent_used: number;
  reset_at: string | null;
  days_until_reset: number | null;
  error?: string;
  detail?: string;
};

const URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-quota`;

const fmt = (n: number) => n.toLocaleString("pt-BR");

export function ElevenLabsQuotaCard() {
  const [data, setData] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(URL);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const detail = typeof j.detail === "string" ? j.detail : "";
        if (r.status === 401 && detail.includes("user_read")) {
          setError(
            "A chave da ElevenLabs não tem a permissão 'User → Read'. Edite a chave em elevenlabs.io/app/settings/api-keys e marque essa permissão.",
          );
        } else {
          setError(j.error || `Erro ${r.status}`);
        }
        setData(null);
      } else {
        setData(j);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const refresh = () => {
    load();
    toast.success("Atualizando saldo...");
  };

  return (
    <section className="pt-4 border-t border-border space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mic className="size-5 text-primary" />
          <h2 className="font-display text-xl text-glow">Saldo ElevenLabs</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Card className="p-4 space-y-3">
        {loading && !data ? (
          <p className="text-sm text-muted-foreground">Carregando saldo...</p>
        ) : error ? (
          <div className="flex items-start gap-2 text-sm">
            <AlertCircle className="size-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-destructive font-medium">Não foi possível ler o saldo.</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
          </div>
        ) : data ? (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              {data.tier && (
                <Badge className="bg-primary/15 text-primary border border-primary/40 hover:bg-primary/15 capitalize">
                  Plano {data.tier}
                </Badge>
              )}
              {data.status && data.status !== "active" && (
                <Badge variant="outline" className="text-destructive border-destructive/40 capitalize">
                  {data.status}
                </Badge>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Caracteres restantes</span>
                <span className="font-medium">
                  <span className="text-primary text-base">{fmt(data.remaining)}</span>
                  <span className="text-muted-foreground"> / {fmt(data.limit)}</span>
                </span>
              </div>
              <Progress value={data.percent_used} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Usado: {fmt(data.used)} ({data.percent_used}%)</span>
                {data.days_until_reset !== null && (
                  <span>
                    Renova em <span className="text-foreground font-medium">{data.days_until_reset}</span>{" "}
                    {data.days_until_reset === 1 ? "dia" : "dias"}
                  </span>
                )}
              </div>
            </div>

            {data.reset_at && (
              <p className="text-xs text-muted-foreground">
                Próxima renovação:{" "}
                {new Date(data.reset_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}

            {data.percent_used >= 80 && (
              <div className="flex items-start gap-2 text-xs p-2 rounded bg-destructive/10 border border-destructive/30">
                <AlertCircle className="size-3.5 text-destructive mt-0.5 shrink-0" />
                <span className="text-destructive">
                  Atenção: mais de 80% da cota usada neste ciclo.
                </span>
              </div>
            )}
          </>
        ) : null}
      </Card>
    </section>
  );
}
