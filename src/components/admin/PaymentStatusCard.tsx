import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, RefreshCw, Check, X, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type SourceResult = {
  allowed: boolean;
  source: "stripe" | "mercadopago";
  plan_tier?: string;
  status?: string;
  reason?: string;
  message?: string;
};

type AccessResponse = {
  allowed: boolean;
  reason?: string;
  plan_tier?: string;
  status?: string;
  email?: string;
  sources?: { stripe: SourceResult; mercadopago: SourceResult };
};

const REASON_LABELS: Record<string, string> = {
  stripe_not_configured: "Chave Stripe não configurada",
  no_customer: "Sem cadastro de cliente",
  no_active_subscription: "Sem assinatura ativa",
  stripe_error: "Erro ao consultar Stripe",
  stripe_exception: "Falha técnica na Stripe",
  mp_query_error: "Erro ao ler tabela MP",
  mp_exception: "Falha técnica no Mercado Pago",
  admin: "Acesso de administrador",
};

function reasonText(r?: string) {
  if (!r) return "—";
  return REASON_LABELS[r] ?? r;
}

function SourceBadge({ src, label }: { src?: SourceResult; label: string }) {
  if (!src) {
    return (
      <div className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/20">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant="outline" className="text-muted-foreground">
          <AlertTriangle className="size-3 mr-1" /> Sem dados
        </Badge>
      </div>
    );
  }
  const isAdminPath = !src && false;
  const ok = src.allowed;
  return (
    <div className={`p-3 rounded-md border ${ok ? "border-primary/40 bg-primary/5" : "border-border bg-muted/10"}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm font-medium">{label}</span>
        {ok ? (
          <Badge className="bg-primary/15 text-primary border border-primary/40 hover:bg-primary/15">
            <Check className="size-3 mr-1" /> Ativo
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            <X className="size-3 mr-1" /> Inativo
          </Badge>
        )}
      </div>
      <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
        {ok && (
          <>
            <p>Plano: <span className="text-foreground font-medium">{src.plan_tier ?? "—"}</span></p>
            <p>Status: <span className="text-foreground">{src.status ?? "—"}</span></p>
          </>
        )}
        {!ok && (
          <p>Motivo: <span className="text-foreground">{reasonText(src.reason)}</span></p>
        )}
        {src.message && (
          <p className="truncate" title={src.message}>Detalhe: {src.message}</p>
        )}
      </div>
    </div>
  );
}

export function PaymentStatusCard() {
  const [data, setData] = useState<AccessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke("check-stripe-access", { body: {} });
      if (error) throw error;
      setData(resp as AccessResponse);
      if (manual) toast.success("Status atualizado");
    } catch (e) {
      toast.error("Falha ao consultar status: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const isAdminBypass = data?.reason === "admin";

  return (
    <Card className="p-4 border-border">
      <div className="flex items-center gap-2 mb-1">
        <CreditCard className="size-5 text-primary" />
        <h2 className="font-display text-xl text-glow">Status de Pagamento</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Verificação em tempo real de Stripe e Mercado Pago para o seu e-mail.
        {isAdminBypass && (
          <span className="block text-primary mt-1">
            ⚡ Você é admin — acesso liberado independente de assinatura.
          </span>
        )}
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3 p-2 rounded-md bg-secondary/30">
            <div className="text-sm">
              <span className="text-muted-foreground">Acesso geral: </span>
              {data?.allowed ? (
                <span className="text-primary font-semibold">Liberado</span>
              ) : (
                <span className="text-destructive font-semibold">Bloqueado</span>
              )}
              {data?.plan_tier && (
                <span className="text-muted-foreground"> • plano <span className="text-foreground">{data.plan_tier}</span></span>
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <SourceBadge label="Stripe" src={data?.sources?.stripe} />
            <SourceBadge label="Mercado Pago" src={data?.sources?.mercadopago} />
          </div>

          {!data?.sources && !isAdminBypass && (
            <p className="text-xs text-muted-foreground mt-3 italic">
              Sem detalhes por fonte (resposta antiga ou bypass).
            </p>
          )}
        </>
      )}

      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchStatus(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`size-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Re-sincronizar agora
        </Button>
      </div>
    </Card>
  );
}