import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Send } from "lucide-react";
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
    navigate(`/chat?ask=${encodeURIComponent(q)}${agentParam}`);
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="lg"
        variant="glass-primary"
        className="fixed bottom-6 right-6 z-40 rounded-full h-14 px-5 shadow-lg gap-2"
        aria-label="Pedir pra Kera"
      >
        <Sparkles className="h-5 w-5" />
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
              Digite o que você quer e a Kera responde no chat.
            </DialogDescription>
          </DialogHeader>

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
            placeholder="Ex.: Abre o Firefox, qual o status do PC, instala o Spotify..."
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
