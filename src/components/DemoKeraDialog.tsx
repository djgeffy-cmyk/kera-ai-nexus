import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Sparkles, Send, Lock, Loader2, ChevronDown, Video, VideoOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BUILTIN_AGENTS } from "@/lib/agents";
import {
  KERA_FIT_AGENT_KEYS,
  KERA_FIT_LABEL,
  KERA_JURIDICO_AGENT_KEYS,
  KERA_JURIDICO_LABEL,
  KERA_TECH_AGENT_KEYS,
  KERA_TECH_LABEL,
} from "@/lib/agents";
import keraAvatarPng from "@/assets/kera-avatar.png";
import { cn } from "@/lib/utils";

// Fundo da tela de testes: Kera realista com gotas de chuva (mesmo do login).
const KERA_RAIN_VIDEO_URL =
  "https://ytixqgkzqgeoxrbmjqbo.supabase.co/storage/v1/object/public/kera-videos/kera-avatar-rain.mp4?v=2026-04-22c";

const DEMO_LIMIT = 3;
const DEMO_KEY = "kera-demo-questions-used";
const FP_KEY = "kera-demo-fp";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Fingerprint estável do navegador — combina características que persistem
// mesmo após limpar localStorage/cookies normais. Salvo em IndexedDB-ish
// (localStorage) + cookie pra resistir a limpezas parciais.
function getStableFingerprint(): string {
  try {
    const cached = localStorage.getItem(FP_KEY);
    if (cached) return cached;
  } catch { /* ignore */ }

  let canvasHash = "";
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px 'Arial'";
      ctx.fillStyle = "#f60";
      ctx.fillRect(0, 0, 240, 60);
      ctx.fillStyle = "#069";
      ctx.fillText("Kera-fp-🛡️-2026", 2, 15);
      ctx.strokeStyle = "rgba(102,204,0,0.7)";
      ctx.strokeRect(10, 10, 100, 30);
      canvasHash = canvas.toDataURL().slice(-64);
    }
  } catch { /* ignore */ }

  const parts = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    new Date().getTimezoneOffset(),
    (navigator as any).hardwareConcurrency ?? "?",
    (navigator as any).deviceMemory ?? "?",
    canvasHash,
  ].join("|");

  try { localStorage.setItem(FP_KEY, parts); } catch { /* ignore */ }
  return parts;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface DemoKeraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWantToSignUp: () => void;
}

// Agentes do demo agrupados por pacote (espelha os grupos da tela principal:
// Kera principal, Tecnologia, Jurídica, Kera Fit e Outros).
const DEMO_GROUPS: { label: string; keys: readonly string[] }[] = [
  { label: "Kera", keys: ["kera"] },
  { label: KERA_TECH_LABEL, keys: KERA_TECH_AGENT_KEYS },
  { label: KERA_JURIDICO_LABEL, keys: KERA_JURIDICO_AGENT_KEYS },
  { label: KERA_FIT_LABEL, keys: KERA_FIT_AGENT_KEYS },
  { label: "Outros", keys: ["kera-gamer", "kera-tradutora"] },
];

const DEMO_AGENT_KEYS = DEMO_GROUPS.flatMap((g) => g.keys);

const DEMO_AGENTS = DEMO_AGENT_KEYS
  .map((k) => BUILTIN_AGENTS.find((a) => a.key === k))
  .filter((a): a is NonNullable<typeof a> => Boolean(a));

const greetingFor = (agentKey: string, name: string) => {
  if (agentKey === "kera") {
    return "E aí. Sou a Kera. Você tem 3 perguntas grátis pra me testar antes de criar conta. Manda a primeira.";
  }
  return `Aqui é a ${name}. Modo demo: 3 perguntas grátis. Manda a primeira que eu já resolvo.`;
};

export const DemoKeraDialog = ({ open, onOpenChange, onWantToSignUp }: DemoKeraDialogProps) => {
  const [agentKey, setAgentKey] = useState<string>("kera");
  const currentAgent = DEMO_AGENTS.find((a) => a.key === agentKey) ?? DEMO_AGENTS[0];
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: greetingFor("kera", "Kera") },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [used, setUsed] = useState(() => {
    const stored = localStorage.getItem(DEMO_KEY);
    return stored ? parseInt(stored, 10) : 0;
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const rainVideoUrl = KERA_RAIN_VIDEO_URL;
  // Grupo expandido no seletor (só um por vez). null = nenhum aberto.
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  // Preferência do visitante: mostrar vídeo da Kera atrás do chat ou fundo escuro limpo.
  const BG_KEY = "kera-demo-show-bg";
  const [showBackground, setShowBackground] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(BG_KEY);
      return v === null ? true : v === "1";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(BG_KEY, showBackground ? "1" : "0"); } catch {}
  }, [showBackground]);

  // Auto-typing da saudação (só na primeira mensagem assistant, antes do user mandar algo).
  // Pausa imediatamente se o usuário começar a digitar no input.
  const [typedGreeting, setTypedGreeting] = useState("");
  const [greetingDone, setGreetingDone] = useState(false);
  const fullGreeting = greetingFor(agentKey, currentAgent?.name ?? "Kera");
  const isFirstAssistantOnly =
    messages.length === 1 && messages[0].role === "assistant";
  const userStartedTyping = input.length > 0;

  useEffect(() => {
    // Reset quando a saudação muda (troca de agente).
    setTypedGreeting("");
    setGreetingDone(false);
  }, [fullGreeting]);

  useEffect(() => {
    if (!isFirstAssistantOnly || greetingDone) return;
    if (userStartedTyping) {
      // Usuário assumiu — completa a saudação na hora.
      setTypedGreeting(fullGreeting);
      setGreetingDone(true);
      return;
    }
    if (typedGreeting.length >= fullGreeting.length) {
      setGreetingDone(true);
      return;
    }
    const t = window.setTimeout(() => {
      setTypedGreeting(fullGreeting.slice(0, typedGreeting.length + 1));
    }, 22);
    return () => window.clearTimeout(t);
  }, [typedGreeting, fullGreeting, isFirstAssistantOnly, greetingDone, userStartedTyping]);

  const remaining = Math.max(0, DEMO_LIMIT - used);
  const exhausted = remaining === 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Ao abrir o diálogo, sincroniza com o servidor (controle por IP).
  // Usa o MAIOR entre localStorage (este device) e servidor (este IP).
  // Assim trocar navegador/abrir anônimo não zera o contador.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/check-demo-quota`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
          body: JSON.stringify({
            action: "check",
            clientFingerprint: getStableFingerprint(),
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const localUsed = parseInt(localStorage.getItem(DEMO_KEY) || "0", 10);
        const serverUsed = typeof data.used === "number" ? data.used : 0;
        const merged = Math.max(localUsed, serverUsed);
        setUsed(merged);
        localStorage.setItem(DEMO_KEY, String(merged));
      } catch {
        /* offline / falha — segue com valor local */
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const switchAgent = (key: string) => {
    if (key === agentKey || loading) return;
    const ag = DEMO_AGENTS.find((a) => a.key === key);
    if (!ag) return;
    setAgentKey(key);
    setMessages([{ role: "assistant", content: greetingFor(key, ag.name) }]);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading || exhausted) return;

    const newMessages: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      // 1) Tenta consumir quota no servidor (controle por IP).
      //    Se o IP já bateu o limite, bloqueia mesmo se o localStorage estiver zerado.
      const quotaRes = await fetch(`${SUPABASE_URL}/functions/v1/check-demo-quota`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          action: "consume",
          clientFingerprint: getStableFingerprint(),
        }),
      });
      const quota = await quotaRes.json().catch(() => ({} as any));
      if (quotaRes.status === 429 || quota?.blocked === true) {
        const serverUsed = typeof quota.used === "number" ? quota.used : DEMO_LIMIT;
        setUsed(Math.max(serverUsed, DEMO_LIMIT));
        localStorage.setItem(DEMO_KEY, String(Math.max(serverUsed, DEMO_LIMIT)));
        setMessages((m) => m.slice(0, -1)); // tira a pergunta que não foi enviada
        setInput(text); // devolve o texto pro input
        return;
      }
      if (!quotaRes.ok) throw new Error("Falha ao validar quota");

      const res = await fetch(`${SUPABASE_URL}/functions/v1/chat-kera`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          // Agente escolhido pelo visitante no demo
          agentKey,
          systemPrompt: currentAgent?.systemPrompt,
          // Modo demo: backend suprime apelidos pessoais e zoeiras internas (Rodrigo,
          // Tania, Doriana, Denis, etc). Visitante sem cadastro vê a Kera "limpa".
          demoMode: true,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // chat-kera streams; lemos como texto puro
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          // Tenta parsear linhas SSE; senão, concatena bruto
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta?.content || "";
                if (delta) {
                  assistantText += delta;
                  setMessages((m) => {
                    const copy = [...m];
                    copy[copy.length - 1] = { role: "assistant", content: assistantText };
                    return copy;
                  });
                }
              } catch {
                // ignora linhas não-JSON
              }
            }
          }
        }
      }

      if (!assistantText) {
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "assistant",
            content: "Tive um problema de conexão. Tenta de novo.",
          };
          return copy;
        });
      }

      // Servidor já incrementou; usamos o valor canônico dele.
      const serverUsed = typeof quota.used === "number" ? quota.used : used + 1;
      const newUsed = Math.max(used + 1, serverUsed);
      setUsed(newUsed);
      localStorage.setItem(DEMO_KEY, String(newUsed));
    } catch (err: any) {
      toast.error("Erro no demo: " + (err.message || "tente novamente"));
      setMessages((m) => m.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="panel border-white/10 w-[96vw] max-w-5xl h-[94vh] max-h-[94vh] flex flex-col p-0 overflow-hidden rounded-3xl bg-background/40 backdrop-blur-xl shadow-[0_30px_80px_-20px_hsl(220_60%_4%/0.7)] animate-fade-in-up">
        {/* Vídeo de fundo de chuva, igual ao login */}
        <video
          aria-hidden
          autoPlay
          loop
          muted
          playsInline
          src={rainVideoUrl}
          poster={keraAvatarPng}
          className="absolute inset-0 w-full h-full object-cover object-bottom opacity-40 pointer-events-none"
        />

        {/* Glow ambiente sobre o vídeo */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(circle at 20% 0%, hsl(210 100% 60% / 0.12), transparent 55%), radial-gradient(circle at 80% 100%, hsl(265 90% 65% / 0.1), transparent 55%)",
          }}
        />

        {/* Header com avatar de vídeo */}
        <div className="relative px-6 pt-4 pb-3 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="relative size-12 sm:size-14 rounded-full overflow-hidden border-2 border-primary/60 shadow-[0_0_30px_-4px_hsl(var(--primary)/0.55)] ring-2 ring-primary/20 shrink-0 bg-background"
            >
              <video
                aria-hidden
                autoPlay
                loop
                muted
                playsInline
                src={rainVideoUrl}
                poster={keraAvatarPng}
                className="w-full h-full object-cover"
              />
            </motion.div>
            <div className="flex-1 min-w-0">
              <DialogHeader className="space-y-1 text-left">
                <DialogTitle className="font-display text-glow text-lg tracking-tight">
                  Teste a Kera ao vivo
                </DialogTitle>
                <DialogDescription className="text-[11px] text-muted-foreground/70">
                  Escolhe um agente e manda ver. Sem conta, sem cadastro.
                </DialogDescription>
              </DialogHeader>
            </div>
            <span className="text-[11px] font-medium text-foreground/80 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-md shrink-0">
              <Sparkles className="size-3 text-primary" />
              {remaining}/{DEMO_LIMIT} grátis
            </span>
          </div>

          {/* Seletor de agentes — agrupado por pacote (Kera Fit, Tecnologia, Jurídica…) */}
          <div className="mt-4">
            <div className="flex flex-wrap gap-2">
              {DEMO_GROUPS.map((group) => {
                const groupAgents = group.keys
                  .map((k) => BUILTIN_AGENTS.find((a) => a.key === k))
                  .filter((a): a is NonNullable<typeof a> => Boolean(a));
                if (groupAgents.length === 0) return null;

                // Grupo de 1 agente só (ex: "Kera"): vira botão direto, sem expandir.
                if (groupAgents.length === 1) {
                  const ag = groupAgents[0];
                  const Icon = ag.icon;
                  const active = ag.key === agentKey;
                  return (
                    <button
                      key={group.label}
                      type="button"
                      onClick={() => switchAgent(ag.key)}
                      disabled={loading}
                      title={ag.description}
                      className={cn(
                        "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs whitespace-nowrap border transition-all duration-300 backdrop-blur-md",
                        active
                          ? "bg-primary/15 border-primary/60 text-primary shadow-[0_0_18px_-2px_hsl(var(--primary)/0.45)] scale-[1.02]"
                          : "bg-foreground/5 border-white/10 text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-foreground/10",
                        loading && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <Icon className={cn("size-3.5", active ? "text-primary" : ag.iconColor)} />
                      {ag.name}
                    </button>
                  );
                }

                const isOpen = openGroup === group.label;
                const hasActive = groupAgents.some((a) => a.key === agentKey);
                return (
                  <div key={group.label} className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenGroup(isOpen ? null : group.label)}
                      disabled={loading}
                      className={cn(
                        "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs whitespace-nowrap border transition-all duration-300 backdrop-blur-md",
                        hasActive
                          ? "bg-primary/15 border-primary/60 text-primary shadow-[0_0_18px_-2px_hsl(var(--primary)/0.45)]"
                          : "bg-foreground/5 border-white/10 text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-foreground/10",
                        isOpen && "ring-1 ring-primary/40",
                        loading && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <span className="font-medium">{group.label}</span>
                      <span className="text-[10px] opacity-60">
                        {groupAgents.length}
                      </span>
                      <ChevronDown
                        className={cn(
                          "size-3 transition-transform",
                          isOpen && "rotate-180",
                        )}
                      />
                    </button>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-0 top-full mt-2 z-30 min-w-[200px] rounded-2xl border border-primary/30 bg-background/95 backdrop-blur-xl shadow-[0_20px_50px_-10px_hsl(220_60%_4%/0.8)] p-1.5"
                        >
                          {groupAgents.map((ag) => {
                            const Icon = ag.icon;
                            const active = ag.key === agentKey;
                            return (
                              <button
                                key={ag.key}
                                type="button"
                                onClick={() => {
                                  switchAgent(ag.key);
                                  setOpenGroup(null);
                                }}
                                disabled={loading}
                                title={ag.description}
                                className={cn(
                                  "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-left transition-colors",
                                  active
                                    ? "bg-primary/15 text-primary"
                                    : "text-foreground/85 hover:bg-foreground/10",
                                )}
                              >
                                <Icon className={cn("size-3.5 shrink-0", active ? "text-primary" : ag.iconColor)} />
                                <span className="flex-1">{ag.name}</span>
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        <div
          ref={scrollRef}
          className="relative flex-1 overflow-y-auto space-y-3 py-6 px-6 min-h-0"
        >
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed transition-shadow ${
                    m.role === "user"
                      ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-[0_4px_18px_-4px_hsl(var(--primary)/0.55)] rounded-br-md"
                      : "bg-foreground/5 border border-white/10 text-foreground backdrop-blur-md rounded-bl-md"
                  }`}
                >
                  {m.content || (loading && i === messages.length - 1 ? "…" : "")}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start animate-fade-in-up">
              <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-foreground/5 border border-white/10 backdrop-blur-md flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary/80 animate-pulse" />
                <span className="size-1.5 rounded-full bg-primary/80 animate-pulse [animation-delay:150ms]" />
                <span className="size-1.5 rounded-full bg-primary/80 animate-pulse [animation-delay:300ms]" />
              </div>
            </div>
          )}
        </div>

        {exhausted ? (
          <div className="relative border-t border-white/5 px-6 py-5 space-y-3">
            <div className="flex items-start gap-2 text-sm text-amber-400/90">
              <Lock className="size-4 mt-0.5 shrink-0" />
              <span>
                Suas 3 perguntas grátis acabaram. Pra continuar conversando com a Kera,
                escolhe um plano — sem mais teste grátis por aqui.
              </span>
            </div>
            <Button
              onClick={() => {
                onOpenChange(false);
                onWantToSignUp();
              }}
              className="kera-ai-cta w-full h-12 rounded-xl font-display tracking-wider text-base"
            >
              ✦ Ver planos e assinar
            </Button>
          </div>
        ) : (
          <div className="relative border-t border-white/5 px-6 py-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-background/85 backdrop-blur-xl border border-primary/30 shadow-[0_8px_28px_-8px_hsl(var(--primary)/0.4)] focus-within:border-primary/60 transition-colors">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={`Pergunta pra ${currentAgent?.name ?? "Kera"}…`}
                disabled={loading}
                className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-transparent text-base text-foreground placeholder:text-muted-foreground/60"
                autoFocus
              />
              <Button
                onClick={send}
                disabled={!input.trim() || loading}
                className="h-10 px-4 rounded-xl font-semibold shrink-0 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="size-3.5" />
                    <span className="hidden sm:inline">Gerar</span>
                  </>
                )}
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-foreground/70">
              <span>Modo demo · respostas filtradas · sem histórico salvo</span>
              <span className="opacity-40">·</span>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onWantToSignUp();
                }}
                className="text-primary/90 hover:text-primary transition-colors underline-offset-2 underline"
              >
                Já tem conta? Entrar
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DemoKeraDialog;