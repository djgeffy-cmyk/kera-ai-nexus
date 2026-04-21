import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Sparkles, Crown, Rocket, ArrowLeft, Image as ImageIcon } from "lucide-react";

type Plan = {
  key: "essencial" | "pro" | "master";
  name: string;
  price: string;
  cents: string;
  tagline: string;
  highlight?: boolean;
  icon: typeof Sparkles;
  features: string[];
  cta: string;
};

const PLANS: Plan[] = [
  {
    key: "essencial",
    name: "Essencial",
    price: "R$ 29",
    cents: ",90",
    tagline: "Comece com 3 áreas à sua escolha",
    icon: Sparkles,
    features: [
      "Kera generalista liberada",
      "3 agentes especialistas à escolha",
      "Histórico de conversas",
      "1 imagem gerada por dia",
      "Suporte por e-mail",
    ],
    cta: "Quero o Essencial",
  },
  {
    key: "pro",
    name: "Pro",
    price: "R$ 79",
    cents: ",90",
    tagline: "Para quem usa Kera todo dia",
    highlight: true,
    icon: Rocket,
    features: [
      "Tudo do Essencial",
      "Todos os agentes especialistas",
      "10 imagens geradas por dia",
      "Modo voz com TTS premium",
      "Análise de código (até 50/mês)",
      "Suporte prioritário",
    ],
    cta: "Quero o Pro",
  },
  {
    key: "master",
    name: "Master",
    price: "R$ 149",
    cents: ",90",
    tagline: "Poder total — sem limites",
    icon: Crown,
    features: [
      "Tudo do Pro",
      "Kera Security NASA ilimitada",
      "Sentinela (monitor 24/7)",
      "50 imagens geradas por dia",
      "Análise de código ilimitada",
      "Acesso antecipado a novos agentes",
      "Suporte dedicado WhatsApp",
    ],
    cta: "Quero o Master",
  },
];

export default function Planos() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reason = searchParams.get("reason");

  return (
    <main className="min-h-screen bg-background px-4 py-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-8"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        {reason === "image_quota" && (
          <div className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 md:p-5 flex items-start gap-3">
            <ImageIcon className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <h2 className="font-semibold text-amber-200">Cota diária de imagens atingida</h2>
              <p className="text-sm text-amber-100/80">
                Você usou todas as imagens do seu plano hoje. Escolha um plano abaixo pra liberar mais — a cota renova todo dia à meia-noite.
              </p>
            </div>
          </div>
        )}

        <header className="text-center mb-12">
          <h1 className="font-display text-4xl md:text-5xl text-glow mb-3">
            Desbloqueie todo o poder da Kera
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Você já experimentou. Agora escolha o plano que combina com seu uso e libere os agentes especialistas que faltam.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <Card
                key={plan.key}
                className={`relative p-6 md:p-8 flex flex-col transition-all ${
                  plan.highlight
                    ? "border-primary shadow-[0_0_40px_-10px_hsl(var(--primary)/0.6)] scale-[1.02]"
                    : "border-border"
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    MAIS POPULAR
                  </span>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-2xl">{plan.name}</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-6">{plan.tagline}</p>

                <div className="mb-6">
                  <span className="text-5xl font-bold">{plan.price}</span>
                  <span className="text-2xl text-muted-foreground">{plan.cents}</span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.highlight ? "default" : "outline"}
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    // Pagamento ainda não integrado — registra interesse e avisa.
                    // TODO: integrar Stripe/Paddle e abrir checkout aqui.
                    window.alert(
                      `Plano ${plan.name} selecionado!\n\nA cobrança ainda não está ativa — em breve enviaremos o link de pagamento.`
                    );
                  }}
                >
                  {plan.cta}
                </Button>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-10">
          Pagamento seguro · Cancele quando quiser · Nota fiscal automática
        </p>
      </div>
    </main>
  );
}
