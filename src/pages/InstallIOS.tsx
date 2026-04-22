import { useNavigate } from "react-router-dom";
import { ArrowLeft, Share, Plus, CheckCircle2, Smartphone, AlertTriangle, Apple } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isSafari, isStandalonePWA } from "@/lib/platform";

const steps = [
  {
    n: 1,
    title: "Abra no Safari",
    body: (
      <>
        Esse tutorial só funciona pelo <strong>Safari</strong> do iPhone/iPad.
        Se você abriu no Chrome, Firefox ou Edge, copie o link
        <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">chat.kera.ia.br</code>
        e cole no Safari.
      </>
    ),
    icon: <Apple className="size-6" />,
  },
  {
    n: 2,
    title: "Toque no botão Compartilhar",
    body: (
      <>
        É o ícone de quadrado com seta pra cima
        <span className="inline-flex items-center justify-center mx-1.5 rounded bg-muted px-1.5 py-0.5 align-middle">
          <Share className="size-4 inline" />
        </span>
        — fica na barra de baixo (iPhone) ou no topo (iPad).
      </>
    ),
    icon: <Share className="size-6" />,
  },
  {
    n: 3,
    title: 'Toque em "Adicionar à Tela de Início"',
    body: (
      <>
        Role o menu pra baixo até achar
        <span className="inline-flex items-center mx-1.5 rounded bg-muted px-1.5 py-0.5 align-middle text-xs gap-1">
          <Plus className="size-3.5" /> Adicionar à Tela de Início
        </span>
        e toque.
      </>
    ),
    icon: <Plus className="size-6" />,
  },
  {
    n: 4,
    title: 'Confirme em "Adicionar"',
    body: (
      <>
        Você pode renomear o app se quiser. Depois toque em
        <strong className="mx-1">Adicionar</strong> no canto superior direito.
        Pronto — o ícone da Kera vai aparecer na sua tela inicial.
      </>
    ),
    icon: <CheckCircle2 className="size-6" />,
  },
];

const InstallIOS = () => {
  const navigate = useNavigate();
  const safari = isSafari();
  const installed = isStandalonePWA();

  return (
    <main className="min-h-screen bg-background text-foreground pb-20">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Smartphone className="size-5 text-primary" />
            <h1 className="font-display text-xl">Instalar Kera no iPhone</h1>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {installed && (
          <Card className="border-emerald-500/40 bg-emerald-500/10">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="size-6 text-emerald-400 shrink-0" />
              <div className="text-sm">
                <p className="font-bold text-emerald-200">Já instalado!</p>
                <p className="text-emerald-100/80">
                  Você está acessando pelo app Kera. Aproveite!
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!safari && !installed && (
          <Card className="border-amber-500/40 bg-amber-500/10">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="size-6 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-bold text-amber-200">Você não está no Safari</p>
                <p className="text-amber-100/90">
                  A instalação no iPhone só funciona pelo <strong>Safari</strong>.
                  Abra <strong>chat.kera.ia.br</strong> no Safari pra continuar.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div>
          <h2 className="text-2xl font-display text-glow mb-2">
            Instale a Kera como app no seu iPhone
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Em 4 passos a Kera vira um app de verdade na sua tela inicial — com
            ícone próprio, abertura em tela cheia (sem barra do Safari) e Face
            ID funcionando normalmente. <strong>Grátis e sem App Store.</strong>
          </p>
        </div>

        <ol className="space-y-3">
          {steps.map((s) => (
            <li key={s.n}>
              <Card className="border-primary/20 hover:border-primary/40 transition">
                <CardContent className="p-4 flex gap-4">
                  <div className="shrink-0 size-12 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center text-primary font-bold text-lg">
                    {s.n}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-primary">{s.icon}</span>
                      <h3 className="font-bold text-base">{s.title}</h3>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      {s.body}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-2">
            <h3 className="font-bold text-primary flex items-center gap-2">
              <CheckCircle2 className="size-5" /> O que muda depois de instalar
            </h3>
            <ul className="text-sm text-foreground/80 space-y-1.5 ml-2">
              <li>• Ícone da Kera direto na tela inicial, igual app nativo</li>
              <li>• Abre em tela cheia, sem a barra de endereço do Safari</li>
              <li>• Face ID continua funcionando normalmente pra login</li>
              <li>• Carrega mais rápido nas próximas vezes</li>
              <li>• Funciona offline pra páginas já visitadas</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-muted/30">
          <CardContent className="p-4 text-sm text-muted-foreground space-y-2">
            <p>
              <strong className="text-foreground">Quer um app de verdade da App Store?</strong>{" "}
              Estamos avaliando publicar a versão nativa via App Store no futuro.
              Por enquanto, a instalação via Safari entrega quase tudo que um app
              nativo faz.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default InstallIOS;
