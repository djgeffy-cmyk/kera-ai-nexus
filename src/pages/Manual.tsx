import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Sparkles,
  MessageSquare,
  LayoutGrid,
  Image as ImageIcon,
  Mic,
  ShieldCheck,
  Crown,
  Rocket,
  Dumbbell,
  Scale,
  Code2,
  Shield,
  ShieldAlert,
  Radar,
  Apple,
  Flame,
  Gamepad2,
  Landmark,
  Building2,
  BookOpen,
  Lock,
  Zap,
  CheckCircle2,
  MonitorDown,
  Globe,
  Terminal,
  Apple as AppleIcon,
  Download,
} from "lucide-react";

type AgentInfo = {
  name: string;
  desc: string;
  icon: typeof Sparkles;
  color: string;
  plan: string;
};

const AGENTS: AgentInfo[] = [
  { name: "Kera (Generalista)", desc: "Porta de entrada. Responde de tudo com personalidade — tira dúvidas rápidas e te aponta o especialista certo.", icon: Sparkles, color: "text-primary", plan: "Liberada para todos" },
  { name: "Kera Dev", desc: "Programação, arquitetura, debugging, code review em qualquer linguagem.", icon: Code2, color: "text-orange-400", plan: "Essencial / Pro" },
  { name: "Kera Sec", desc: "Cibersegurança ofensiva e defensiva, OWASP, pentest, hardening.", icon: Shield, color: "text-red-400", plan: "Essencial / Pro" },
  { name: "Kera Security Pro (NASA)", desc: "Análise mission-critical de código nível NASA — JPL, MISRA, CWE, OWASP.", icon: ShieldAlert, color: "text-blue-400", plan: "Master" },
  { name: "Sentinela", desc: "Monitor 24/7 de URLs, e-mails suspeitos e logs — foco em prefeituras e sistemas IPM.", icon: Radar, color: "text-emerald-400", plan: "Master / Tech" },
  { name: "Kera Jurídica", desc: "Lei 14.133, LGPD, Marco Civil, contratos de TI, licitações.", icon: Scale, color: "text-purple-400", plan: "Jurídico / Pro" },
  { name: "Kera Nutricionista", desc: "Nutrição esportiva direta: macros, déficit, suplementação, sem desculpa.", icon: Apple, color: "text-green-400", plan: "Kera Fit" },
  { name: "Kera Treinador", desc: "Hipertrofia, força, periodização. Treino prescrito com séries e reps.", icon: Dumbbell, color: "text-orange-400", plan: "Kera Fit" },
  { name: "Kera Iron", desc: "Bodybuilding avançado e composição corporal. Estilo carrasco honesto.", icon: Flame, color: "text-red-500", plan: "Kera Fit" },
  { name: "Kera Gamer", desc: "Guias de jogos, troféus, dicas de gameplay e cultura gamer.", icon: Gamepad2, color: "text-fuchsia-400", plan: "Kera Diversão" },
  { name: "Kera Guaramirim", desc: "Especialista nos sistemas IPM, Olostech e e-SUS de Guaramirim/SC.", icon: Landmark, color: "text-emerald-500", plan: "Municipal" },
  { name: "Kera Prefeituras", desc: "APIs governamentais (PNCP), gestão de transparência e ERPs públicos.", icon: Building2, color: "text-sky-500", plan: "Municipal" },
];

const PLANS = [
  {
    key: "essencial",
    name: "Essencial",
    price: "R$ 29,90",
    icon: Sparkles,
    color: "text-primary",
    features: ["Kera generalista", "3 agentes à escolha", "1 imagem/dia", "Histórico completo"],
  },
  {
    key: "pro",
    name: "Pro",
    price: "R$ 79,90",
    icon: Rocket,
    color: "text-fuchsia-400",
    highlight: true,
    features: ["Todos os especialistas", "10 imagens/dia", "Voz TTS premium", "Análise de código (50/mês)"],
  },
  {
    key: "master",
    name: "Master",
    price: "R$ 149,90",
    icon: Crown,
    color: "text-amber-400",
    features: ["Tudo do Pro", "NASA + Sentinela ilimitados", "50 imagens/dia", "Suporte WhatsApp"],
  },
];

const Section = ({ icon: Icon, title, children }: { icon: typeof Sparkles; title: string; children: React.ReactNode }) => (
  <section className="space-y-4">
    <div className="flex items-center gap-3">
      <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Icon className="size-5 text-primary" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
    </div>
    <div className="pl-12 space-y-3 text-muted-foreground leading-relaxed">{children}</div>
  </section>
);

export default function Manual() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </Button>
          <BookOpen className="size-5 text-primary" />
          <h1 className="text-lg font-bold">Manual da Kera</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-16">
        {/* HERO */}
        <div className="space-y-4 text-center pb-6 border-b border-border">
          <Badge variant="outline" className="border-primary/30 text-primary">Guia oficial</Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Como usar o sistema <span className="text-primary">Kera</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Kera não é só mais um chatbot. É um time de especialistas brasileiros — cada agente é treinado para um domínio específico.
            Aqui você aprende a tirar o melhor de cada um.
          </p>
        </div>

        {/* O QUE É */}
        <Section icon={Sparkles} title="O que é a Kera?">
          <p>
            A Kera é uma plataforma de IA com <strong className="text-foreground">agentes especialistas</strong>. Em vez de uma IA genérica
            tentando saber tudo (como ChatGPT/Grok/Gemini), você fala com o especialista certo para cada assunto:
            jurídico, código, segurança, nutrição, jogos, gestão municipal.
          </p>
          <p>
            A <strong className="text-foreground">Kera generalista</strong> é a porta de entrada — boa para qualquer pergunta e ela te
            sugere o especialista quando o assunto fica fundo. Os outros agentes têm prompts, tons e expertise dedicados.
          </p>
        </Section>

        {/* PRIMEIROS PASSOS */}
        <Section icon={Zap} title="Primeiros passos">
          <ol className="space-y-3 list-decimal list-inside">
            <li><strong className="text-foreground">Crie sua conta</strong> em /auth (e-mail + senha ou Google).</li>
            <li><strong className="text-foreground">Onboarding</strong>: escolha 3 áreas de interesse para liberar seus especialistas.</li>
            <li><strong className="text-foreground">Comece a conversar</strong> com a Kera generalista — ela é gratuita.</li>
            <li>Use o <strong className="text-foreground">menu de agentes</strong> (ícone no topo do chat) para trocar de especialista.</li>
            <li>Cada agente bloqueado dá <strong className="text-foreground">3 perguntas grátis</strong> antes do paywall.</li>
          </ol>
        </Section>

        {/* RECURSOS */}
        <Section icon={LayoutGrid} title="Recursos do chat">
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { icon: MessageSquare, title: "Histórico completo", desc: "Toda conversa fica salva, agrupada por data." },
              { icon: ImageIcon, title: "Geração de imagens", desc: "Peça imagens dentro do chat (cota varia por plano)." },
              { icon: Mic, title: "Modo voz", desc: "Fale com a Kera e ouça as respostas (TTS premium no Pro)." },
              { icon: ShieldCheck, title: "Segurança 2FA", desc: "Ative autenticação em 2 fatores em /security." },
            ].map(({ icon: I, title, desc }) => (
              <Card key={title} className="p-4 bg-card/50 border-border">
                <div className="flex items-start gap-3">
                  <I className="size-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">{title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Section>

        {/* AGENTES */}
        <Section icon={Sparkles} title="Conheça os agentes">
          <p className="mb-4">
            Cada agente é um especialista — não tente forçar a Kera generalista a fazer trabalho de agente.
            Use o certo para o trabalho certo.
          </p>
          <div className="grid gap-3 not-prose">
            {AGENTS.map(({ name, desc, icon: Icon, color, plan }) => (
              <Card key={name} className="p-4 bg-card/50 border-border hover:border-primary/30 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="size-10 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                    <Icon className={`size-5 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">{name}</h3>
                      <Badge variant="outline" className="text-[10px] font-medium">{plan}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Section>

        {/* KERA FIT */}
        <Section icon={Dumbbell} title="Kera Fit (integração com Kera Personal)">
          <Card className="p-5 bg-gradient-to-br from-fuchsia-500/10 to-pink-500/5 border-fuchsia-500/30">
            <div className="flex items-start gap-3">
              <Dumbbell className="size-6 text-fuchsia-400 shrink-0 mt-1" />
              <div className="space-y-3">
                <h3 className="font-bold text-foreground text-lg">Tem o Kera Personal? Ganha 3 agentes Fit grátis.</h3>
                <p className="text-sm">
                  Se você é assinante do <strong className="text-foreground">Kera Personal</strong> (app de treino), ao vincular sua conta
                  você libera automaticamente os 3 agentes Fit aqui no Kera AI:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-fuchsia-400 mt-0.5 shrink-0" /> <span><strong className="text-foreground">Kera Nutricionista</strong> — dieta e macros</span></li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-fuchsia-400 mt-0.5 shrink-0" /> <span><strong className="text-foreground">Kera Treinador</strong> — prescrição de treino</span></li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="size-4 text-fuchsia-400 mt-0.5 shrink-0" /> <span><strong className="text-foreground">Kera Iron</strong> — bodybuilding avançado</span></li>
                </ul>
                <p className="text-sm">
                  <strong className="text-foreground">Como vincular:</strong> vá em <em>Planos → Vincular Kera Fit</em> e entre com seu e-mail e senha do app de treino. Pronto, os 3 agentes aparecem liberados na hora.
                </p>
                <Button onClick={() => navigate("/planos")} className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white">
                  <Dumbbell className="size-4 mr-2" /> Vincular agora
                </Button>
              </div>
            </div>
          </Card>
        </Section>

        {/* PLANOS */}
        <Section icon={Crown} title="Planos">
          <div className="grid md:grid-cols-3 gap-4 not-prose">
            {PLANS.map(({ key, name, price, icon: Icon, color, features, highlight }) => (
              <Card
                key={key}
                className={`p-5 bg-card/50 border-border ${highlight ? "border-primary/50 ring-1 ring-primary/30" : ""}`}
              >
                {highlight && (
                  <Badge className="mb-3 bg-primary text-primary-foreground">Mais popular</Badge>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`size-5 ${color}`} />
                  <h3 className="font-bold text-foreground">{name}</h3>
                </div>
                <p className="text-2xl font-bold text-foreground mb-4">{price}<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
                <ul className="space-y-2 text-sm">
                  {features.map(f => (
                    <li key={f} className="flex items-start gap-2">
                      <CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
          <div className="text-center pt-4">
            <Button onClick={() => navigate("/planos")} size="lg">
              Ver todos os planos
            </Button>
          </div>
        </Section>

        {/* SEGURANÇA */}
        <Section icon={Lock} title="Segurança e privacidade">
          <ul className="space-y-2 list-disc list-inside">
            <li>Suas conversas são privadas — só você acessa o seu histórico.</li>
            <li>Suporte a <strong className="text-foreground">2FA (autenticação em 2 fatores)</strong> via app autenticador ou WebAuthn.</li>
            <li>Senhas seguem padrão forte (mín. 12 caracteres, maiúscula, número, símbolo).</li>
            <li>Conformidade com LGPD: você pode pedir exclusão dos seus dados a qualquer momento.</li>
          </ul>
        </Section>

        {/* DICAS */}
        <Section icon={Sparkles} title="Dicas para tirar o melhor da Kera">
          <ul className="space-y-2 list-disc list-inside">
            <li><strong className="text-foreground">Seja específico:</strong> "Como otimizar query SQL com 3 JOINs" rende muito mais que "ajuda com banco".</li>
            <li><strong className="text-foreground">Cole código direto:</strong> Kera Dev e Security analisam snippets inteiros.</li>
            <li><strong className="text-foreground">Use o agente certo:</strong> dúvida jurídica? Kera Jurídica. Treino? Kera Treinador. Não force a generalista.</li>
            <li><strong className="text-foreground">Use voz:</strong> em deslocamento ou cozinhando, ative o modo voz.</li>
            <li><strong className="text-foreground">Exporte conversas:</strong> ícone de download gera PDF da conversa.</li>
          </ul>
        </Section>

        {/* FOOTER */}
        <div className="pt-8 border-t border-border text-center text-sm text-muted-foreground space-y-2">
          <p>Dúvidas? Fale com a gente em <strong className="text-foreground">contato@kera.ia.br</strong></p>
          <p className="text-xs">Manual atualizado · Kera AI © {new Date().getFullYear()}</p>
        </div>
      </main>
    </div>
  );
}