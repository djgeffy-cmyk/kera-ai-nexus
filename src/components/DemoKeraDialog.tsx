import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Sparkles, Send, Lock, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import UmbrellaCorpLogo from "./UmbrellaCorpLogo";
import { BUILTIN_AGENTS } from "@/lib/agents";
import keraAvatarVideo from "@/assets/kera-avatar-rain.mp4.asset.json";
import keraAvatarPng from "@/assets/kera-avatar.png";
import { assetUrl } from "@/lib/assetUrl";
import { cn } from "@/lib/utils";

const DEMO_LIMIT = 3;
const DEMO_KEY = "kera-demo-questions-used";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface DemoKeraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWantToSignUp: () => void;
}

// Agentes que aparecem no demo (subset curado, em ordem)
const DEMO_AGENT_KEYS = [
  "kera",
  "kera-dev",
  "kera-sec",
  "kera-security-nasa",
  "kera-juridica",
  "kera-familia",
  "kera-sucessoes",
  "kera-personalidade",
  "kera-curatela",
  "kera-sentinela",
  "kera-nutri",
  "kera-treinador",
  "kera-iron",
  "kera-gamer",
  "kera-tradutora",
] as const;

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
  const rainVideoUrl = assetUrl(keraAvatarVideo);

  const remaining = Math.max(0, DEMO_LIMIT - used);
  const exhausted = remaining === 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

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

      const newUsed = used + 1;
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
      <DialogContent className="panel border-primary/30 max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header com avatar de vídeo */}
        <div className="relative px-5 pt-5 pb-3 border-b border-primary/20 bg-gradient-to-b from-primary/10 to-transparent">
          <div className="flex items-start gap-3">
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="relative size-16 sm:size-20 rounded-full overflow-hidden border-2 border-primary/70 shadow-glow ring-2 ring-primary/30 shrink-0 bg-background"
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
                <DialogTitle className="font-display text-glow flex items-center gap-2 text-lg">
                  <UmbrellaCorpLogo size={22} />
                  Teste a Kera ao vivo
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Escolhe um agente e manda ver. Sem conta, sem cadastro.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                <Sparkles className="size-3 text-primary" />
                {remaining}/{DEMO_LIMIT} grátis
              </span>
              <button
                onClick={() => {
                  onOpenChange(false);
                  onWantToSignUp();
                }}
                className="text-[10px] text-primary/70 hover:text-primary underline transition-colors"
              >
                Já tem conta? Entrar
              </button>
            </div>
          </div>

          {/* Seletor de agentes — chips horizontais */}
          <div className="mt-4 -mx-1 px-1 overflow-x-auto scrollbar-thin">
            <div className="flex gap-2 pb-1 min-w-max">
              {DEMO_AGENTS.map((ag) => {
                const Icon = ag.icon;
                const active = ag.key === agentKey;
                return (
                  <button
                    key={ag.key}
                    type="button"
                    onClick={() => switchAgent(ag.key)}
                    disabled={loading}
                    title={ag.description}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition-all",
                      active
                        ? "bg-primary/20 border-primary text-primary shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
                        : "bg-muted/30 border-border/40 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                      loading && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <Icon className={cn("size-3.5", active ? "text-primary" : ag.iconColor)} />
                    {ag.name}
                  </button>
                );
              })}
            </div>
          </div>

          {currentAgent && (
            <p className="mt-2 text-[11px] text-muted-foreground/80 italic">
              {currentAgent.description}
            </p>
          )}
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto space-y-3 py-4 px-5 min-h-[260px] max-h-[42vh]"
        >
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 border border-border/50 text-foreground"
                  }`}
                >
                  {m.content || (loading && i === messages.length - 1 ? "…" : "")}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-2.5 bg-muted/40 border border-border/50">
                <Loader2 className="size-4 animate-spin text-primary" />
              </div>
            </div>
          )}
        </div>

        {exhausted ? (
          <div className="border-t border-border/40 pt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-amber-400">
              <Lock className="size-4" />
              Você usou suas 3 perguntas grátis. Crie sua conta pra liberar tudo.
            </div>
            <Button
              onClick={() => {
                onOpenChange(false);
                onWantToSignUp();
              }}
              className="w-full bg-gradient-cyber text-primary-foreground font-display tracking-wider shadow-glow"
            >
              Criar conta grátis
            </Button>
          </div>
        ) : (
          <div className="border-t border-border/40 pt-3 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Pergunta o que quiser…"
              disabled={loading}
              className="bg-input/50 flex-1"
              autoFocus
            />
            <Button
              onClick={send}
              disabled={!input.trim() || loading}
              size="icon"
              className="bg-gradient-cyber text-primary-foreground shadow-glow shrink-0"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DemoKeraDialog;