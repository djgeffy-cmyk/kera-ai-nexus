import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Sparkles, Crown, Rocket, ArrowLeft, Image as ImageIcon, Dumbbell, ExternalLink } from "lucide-react";

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

const SPACEINCLOUD_URL = "https://app.spaceincloud.com.br/kera";

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

        {/* ============================================================
            Plano Growth FIT — área Fitness (Kera + SpaceInCloud)
            ============================================================ */}
        <section className="mt-20">
          <header className="text-center mb-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold text-fuchsia-300">
              <Dumbbell className="h-3.5 w-3.5" /> ÁREA FITNESS
            </span>
            <h2 className="font-display text-3xl md:text-4xl text-glow mt-4 mb-3">
              Plano Growth FIT
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Combo exclusivo pra quem leva treino e dieta a sério. Os 3 agentes FIT da Kera
              liberados <strong>+ acesso completo ao app SpaceInCloud</strong> (treinos, nutrição,
              avaliações, Body Scan por IA e gestão financeira).
            </p>
          </header>

          <div className="mx-auto max-w-2xl">
            <Card className="relative overflow-hidden p-6 md:p-10 border-fuchsia-400/40 shadow-[0_0_60px_-15px_hsl(280_90%_60%/0.5)]">
              <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/10 via-transparent to-orange-500/10 pointer-events-none" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-2">
                  <div className="rounded-lg bg-fuchsia-500/20 p-2">
                    <Dumbbell className="h-6 w-6 text-fuchsia-300" />
                  </div>
                  <div>
                    <h3 className="font-display text-2xl">Growth FIT</h3>
                    <p className="text-sm text-muted-foreground">Kera + SpaceInCloud — pacote único</p>
                  </div>
                </div>

                <div className="my-6 flex items-baseline gap-1">
                  <span className="text-5xl font-bold">R$ 99</span>
                  <span className="text-2xl text-muted-foreground">,00</span>
                  <span className="text-sm text-muted-foreground ml-2">/mês</span>
                </div>

                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 mb-8">
                  {[
                    "Kera Nutricionista — dieta, macros e zoeira inteligente",
                    "Kera Treinador — fichas, periodização e progressão",
                    "Kera Iron — bodybuilding feminino (prep e palco)",
                    "App SpaceInCloud completo",
                    "Body Scan por IA (composição corporal)",
                    "Avaliações e anamnese digital",
                    "Gestão financeira (alunos, recibos, agenda)",
                    "Suporte prioritário nos dois apps",
                  ].map((f) => (
                    <div key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-fuchsia-300 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    size="lg"
                    className="flex-1 bg-gradient-to-r from-fuchsia-500 to-orange-500 hover:opacity-90 text-white border-0"
                    onClick={() => {
                      // TODO: integrar checkout do plano Growth FIT
                      window.alert(
                        "Plano Growth FIT selecionado!\n\nA cobrança ainda não está ativa — em breve enviaremos o link de pagamento."
                      );
                    }}
                  >
                    Quero o Growth FIT
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(SPACEINCLOUD_URL, "_blank", "noopener,noreferrer")}
                  >
                    Conhecer o SpaceInCloud <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground mt-4 text-center">
                  Já é assinante do SpaceInCloud? Use o mesmo email no cadastro da Kera —
                  liberamos o pacote FIT automaticamente.
                </p>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
