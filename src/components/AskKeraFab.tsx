import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Send, MonitorDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { isKeraDesktop } from "@/lib/keraDesktop";

const QUICK_PROMPTS = [
  { label: "Status do PC", desktop: true },
  { label: "Tirar print da tela", desktop: true },
  { label: "Abrir Firefox", desktop: true },
  { label: "Listar arquivos do Desktop", desktop: true },
  { label: "Qual o uso de CPU e RAM?", desktop: true },
  { label: "Gerar uma imagem", desktop: false },
  { label: "Consultar licitação", desktop: false },
];

export const AskKeraFab = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const desktop = isKeraDesktop();

  const filteredPrompts = useMemo(() => {
    return QUICK_PROMPTS.filter(p => !p.desktop || desktop);
  }, [desktop]);

  // Esconde em /auth e na home (que já é o próprio chat)
  const path = location.pathname;
  if (path.startsWith("/auth") || path === "/" || path.startsWith("/chat")) {
    return null;
  }

  const send = (frase: string) => {
    const q = frase.trim();
    if (!q) return;
    setOpen(false);
    setText("");
    const isDesktopPrompt = QUICK_PROMPTS.find(p => p.label === q)?.desktop;
    const agentParam = isDesktopPrompt ? "&agent=kera" : "";
    // O chat é a rota raiz ("/"), não "/chat" — navegar para /chat dava 404.
    navigate(`/?ask=${encodeURIComponent(q)}${agentParam}`);
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="lg"
        className="fixed bottom-6 right-6 z-40 rounded-full h-14 px-6 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base shadow-[0_8px_30px_-4px_hsl(var(--primary)/0.6)] ring-2 ring-primary-foreground/20 hover:ring-primary-foreground/40 transition-all"
        aria-label="Pedir pra Kera"
      >
        <Sparkles className="h-5 w-5 shrink-0" />
        <span className="hidden sm:inline">Pedir pra Kera</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Pedir pra Kera
            </DialogTitle>
            <DialogDescription>
              {desktop
                ? "Digite o que você quer e a Kera responde no chat — incluindo ações no seu PC."
                : "Digite uma pergunta e a Kera responde no chat."}
            </DialogDescription>
          </DialogHeader>

          {!desktop && (
            <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-foreground/80">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p>
                  No navegador a Kera <strong>não consegue</strong> ver o status do seu PC,
                  abrir programas ou organizar pastas — o navegador isola o site do sistema
                  por segurança.
                </p>
                <p>
                  Para isso você precisa do <strong>Kera Desktop</strong> (app instalado no PC),
                  que dá à Kera acesso a CPU/RAM, arquivos do Desktop, abrir apps, etc.
                </p>
                <a
                  href="/desktop"
                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                  onClick={(e) => {
                    e.preventDefault();
                    setOpen(false);
                    navigate("/desktop");
                  }}
                >
                  <MonitorDown className="h-3.5 w-3.5" />
                  Ver como instalar o Kera Desktop
                </a>
              </div>
            </div>
          )}

          <Textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            placeholder={
              desktop
                ? "Ex.: Abre o Firefox, qual o status do PC, instala o Spotify..."
                : "Ex.: Gera uma imagem de um cachorro robô, consulta a licitação X..."
            }
            className="min-h-[100px]"
          />

          <div className="flex flex-wrap gap-2">
            {filteredPrompts.map((p) => (
              <Button
                key={p.label}
                variant="outline"
                size="sm"
                onClick={() => send(p.label)}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="flex justify-end">
            <Button onClick={() => send(text)} disabled={!text.trim()} className="gap-2">
              <Send className="h-4 w-4" />
              Enviar pro chat
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
