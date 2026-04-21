import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Sparkles, Send, Lock, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import UmbrellaCorpLogo from "./UmbrellaCorpLogo";

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

export const DemoKeraDialog = ({ open, onOpenChange, onWantToSignUp }: DemoKeraDialogProps) => {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "E aí. Sou a Kera. Você tem 3 perguntas grátis pra me testar antes de criar conta. Manda a primeira.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [used, setUsed] = useState(() => {
    const stored = localStorage.getItem(DEMO_KEY);
    return stored ? parseInt(stored, 10) : 0;
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  const remaining = Math.max(0, DEMO_LIMIT - used);
  const exhausted = remaining === 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

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
      <DialogContent className="panel border-primary/30 max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-glow flex items-center gap-2">
            <UmbrellaCorpLogo size={28} />
            Teste a Kera ao vivo
            <span className="ml-auto text-xs font-normal text-muted-foreground flex items-center gap-1">
              <Sparkles className="size-3 text-primary" />
              {remaining}/{DEMO_LIMIT} perguntas grátis
            </span>
          </DialogTitle>
          <DialogDescription>
            Modo demo — sem conta, sem cadastro. Pergunta o que quiser.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto space-y-3 py-3 px-1 min-h-[280px] max-h-[45vh]"
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