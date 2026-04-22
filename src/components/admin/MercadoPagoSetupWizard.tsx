import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, ExternalLink, ChevronRight, ChevronLeft, Sparkles, KeyRound, Webhook, TestTube } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mp-webhook`;

type StepKey = "intro" | "token" | "webhook" | "test" | "done";

const STEPS: { key: StepKey; label: string; icon: any }[] = [
  { key: "intro", label: "Início", icon: Sparkles },
  { key: "token", label: "Token", icon: KeyRound },
  { key: "webhook", label: "Webhook", icon: Webhook },
  { key: "test", label: "Teste", icon: TestTube },
  { key: "done", label: "Pronto", icon: Check },
];

function CopyBox({ value, label }: { value: string; label?: string }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-secondary/40 border border-border">
      <code className="text-xs text-primary flex-1 break-all font-mono">{value}</code>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast.success(`${label ?? "Copiado"} copiado!`);
        }}
      >
        <Copy className="size-4" />
      </Button>
    </div>
  );
}

export function MercadoPagoSetupWizard() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<StepKey>("intro");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "ok" | "fail">("idle");

  const stepIdx = STEPS.findIndex((s) => s.key === step);

  const goNext = () => {
    const next = STEPS[stepIdx + 1];
    if (next) setStep(next.key);
  };
  const goBack = () => {
    const prev = STEPS[stepIdx - 1];
    if (prev) setStep(prev.key);
  };

  const testWebhook = async () => {
    setTesting(true);
    setTestResult("idle");
    try {
      const resp = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ping", action: "wizard.test", data: { id: "wizard-ping" } }),
      });
      if (resp.ok || resp.status === 200) {
        setTestResult("ok");
        toast.success("Webhook está respondendo!");
      } else {
        setTestResult("fail");
        toast.error(`Webhook retornou ${resp.status}`);
      }
    } catch (e) {
      setTestResult("fail");
      toast.error("Falha ao alcançar webhook: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setTesting(false);
    }
  };

  const checkTokenSet = async () => {
    // Heurística: tenta chamar uma function que usa o token. Como não temos endpoint dedicado,
    // só confirmamos com instruções visuais. Isso aqui só facilita o fluxo do wizard.
    toast.info("Após salvar o secret no chat, volte aqui e avance.");
  };

  if (!open) {
    return (
      <Card className="p-4 border-border">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="size-5 text-primary" />
              <h2 className="font-display text-xl text-glow">Assistente Mercado Pago</h2>
              <Badge variant="outline" className="text-muted-foreground">Opcional</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Quando quiser ativar a cobrança via Mercado Pago, este assistente te guia em 4 passos:
              token, webhook, teste e validação.
            </p>
          </div>
          <Button onClick={() => { setOpen(true); setStep("intro"); }}>
            Iniciar configuração <ChevronRight className="size-4 ml-1" />
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 border-border">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="size-5 text-primary" />
        <h2 className="font-display text-xl text-glow">Assistente Mercado Pago</h2>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setOpen(false)}>
          Fechar
        </Button>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === stepIdx;
          const done = i < stepIdx;
          return (
            <div key={s.key} className="flex items-center gap-1 shrink-0">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs ${
                active ? "border-primary bg-primary/10 text-primary"
                : done ? "border-primary/40 text-primary/70"
                : "border-border text-muted-foreground"
              }`}>
                {done ? <Check className="size-3" /> : <Icon className="size-3" />}
                <span className="font-medium">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="size-3 text-muted-foreground" />}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="min-h-[260px] space-y-4">
        {step === "intro" && (
          <div className="space-y-3">
            <h3 className="font-display text-lg">Antes de começar</h3>
            <p className="text-sm text-muted-foreground">
              Você vai precisar de uma conta no Mercado Pago com permissão para criar
              <span className="text-foreground"> assinaturas (preapproval)</span>.
              O processo todo leva uns 5 minutos.
            </p>
            <div className="grid gap-2 text-sm">
              <div className="flex items-start gap-2 p-3 rounded-md bg-secondary/30">
                <span className="text-primary font-bold">1.</span>
                <span>Pegar o <strong>Access Token</strong> de produção</span>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-md bg-secondary/30">
                <span className="text-primary font-bold">2.</span>
                <span>Cadastrar a <strong>URL do webhook</strong> no painel do MP</span>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-md bg-secondary/30">
                <span className="text-primary font-bold">3.</span>
                <span>Disparar um <strong>teste</strong> e confirmar que chegou</span>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-md bg-secondary/30">
                <span className="text-primary font-bold">4.</span>
                <span>Validar uma assinatura real e ver aparecer no painel</span>
              </div>
            </div>
          </div>
        )}

        {step === "token" && (
          <div className="space-y-3">
            <h3 className="font-display text-lg">Passo 1 — Access Token</h3>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal pl-5">
              <li>
                Acesse o painel de credenciais do Mercado Pago:{" "}
                <a
                  href="https://www.mercadopago.com.br/developers/panel/app"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex items-center gap-1"
                >
                  abrir painel <ExternalLink className="size-3" />
                </a>
              </li>
              <li>Selecione (ou crie) sua aplicação.</li>
              <li>
                Em <span className="text-foreground">Credenciais de produção</span>, copie o
                <span className="text-primary font-mono"> Access Token</span>.
              </li>
              <li>
                Volte ao chat do Lovable e diga:{" "}
                <span className="text-foreground">"adicionar secret MERCADOPAGO_ACCESS_TOKEN"</span>.
                Vou te pedir o valor com segurança.
              </li>
            </ol>
            <div className="p-3 rounded-md border border-primary/30 bg-primary/5 text-xs text-muted-foreground">
              <strong className="text-primary">Nome exato do secret:</strong>{" "}
              <code className="text-primary font-mono">MERCADOPAGO_ACCESS_TOKEN</code>
            </div>
            <Button variant="outline" size="sm" onClick={checkTokenSet}>
              Já adicionei o secret
            </Button>
          </div>
        )}

        {step === "webhook" && (
          <div className="space-y-3">
            <h3 className="font-display text-lg">Passo 2 — Webhook</h3>
            <p className="text-sm text-muted-foreground">
              Cadastre esta URL no painel do MP em{" "}
              <span className="text-foreground">Webhooks → Configurar notificações → Modo produção</span>:
            </p>
            <CopyBox value={WEBHOOK_URL} label="URL do webhook" />

            <p className="text-sm text-muted-foreground mt-4">
              Eventos que precisam estar marcados:
            </p>
            <div className="flex flex-wrap gap-2">
              {["subscription_preapproval", "subscription_authorized_payment", "payment"].map((ev) => (
                <Badge key={ev} variant="outline" className="font-mono text-xs">
                  {ev}
                </Badge>
              ))}
            </div>

            <a
              href="https://www.mercadopago.com.br/developers/panel/webhooks"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary text-sm mt-2"
            >
              Abrir página de webhooks do MP <ExternalLink className="size-3" />
            </a>
          </div>
        )}

        {step === "test" && (
          <div className="space-y-3">
            <h3 className="font-display text-lg">Passo 3 — Teste de conectividade</h3>
            <p className="text-sm text-muted-foreground">
              Vou bater na URL do webhook agora pra confirmar que ela está acessível
              publicamente. Isso simula uma notificação do MP.
            </p>
            <Button onClick={testWebhook} disabled={testing}>
              <TestTube className="size-4 mr-2" />
              {testing ? "Testando..." : "Disparar teste"}
            </Button>

            {testResult === "ok" && (
              <div className="p-3 rounded-md border border-primary/40 bg-primary/10 text-sm">
                <Check className="size-4 inline text-primary mr-1" />
                Webhook respondeu — está acessível publicamente.
              </div>
            )}
            {testResult === "fail" && (
              <div className="p-3 rounded-md border border-destructive/40 bg-destructive/10 text-sm">
                Webhook não respondeu. Verifique se a edge function{" "}
                <code className="font-mono">mp-webhook</code> foi deployada.
              </div>
            )}

            <p className="text-xs text-muted-foreground italic">
              Dica: no painel do MP existe também o botão{" "}
              <span className="text-foreground">"Simular notificação"</span> — use ele depois
              pra disparar um payload real.
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-3">
            <h3 className="font-display text-lg">Tudo pronto!</h3>
            <p className="text-sm text-muted-foreground">
              Quando alguém assinar via Mercado Pago, o webhook vai gravar em{" "}
              <code className="font-mono text-primary">mp_subscriptions</code> e o login
              já vai liberar acesso automaticamente.
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
              <li>Acompanhe o status na seção <span className="text-foreground">Status de Pagamento</span> acima.</li>
              <li>Logs do webhook ficam disponíveis no console do Lovable Cloud.</li>
              <li>Stripe e MP rodam em paralelo — qualquer um ativo libera o usuário.</li>
            </ul>
            <Button variant="outline" size="sm" onClick={() => { setOpen(false); setStep("intro"); }}>
              Fechar assistente
            </Button>
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="flex justify-between mt-6 pt-4 border-t border-border">
        <Button variant="ghost" size="sm" onClick={goBack} disabled={stepIdx === 0}>
          <ChevronLeft className="size-4 mr-1" /> Voltar
        </Button>
        {step !== "done" && (
          <Button size="sm" onClick={goNext}>
            Próximo <ChevronRight className="size-4 ml-1" />
          </Button>
        )}
      </div>
    </Card>
  );
}