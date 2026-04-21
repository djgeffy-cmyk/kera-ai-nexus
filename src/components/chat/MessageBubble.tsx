import { memo, useCallback, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import keraAvatar from "@/assets/kera-avatar.png";
import { User, FileText, Volume2, Square, Sparkles, ArrowRight, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Definido fora do componente: referência estável evita recriação a cada render
// e preserva memoização interna do ReactMarkdown.
const CodeBlock = ({ inline, className, children, ...props }: any) => {
  const [copied, setCopied] = useState(false);
  const text = String(children).replace(/\n$/, "");

  if (inline) {
    return (
      <code className="px-1.5 py-0.5 rounded bg-muted text-primary text-[0.9em] font-mono" {...props}>
        {children}
      </code>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Código copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4 rounded-xl overflow-hidden border border-border/40 bg-card/40 backdrop-blur-sm shadow-sm transition-all duration-300 hover:shadow-md hover:border-border/60">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-muted/30">
        <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">{className?.replace('language-', '') || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all active:scale-95"
          title="Copiar código"
          aria-label="Copiar código"
        >
          {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 pr-12 text-[13px] leading-relaxed scrollbar-thin">
        <code className={className} {...props}>{children}</code>
      </pre>
    </div>
  );
};

// Referências estáveis pro ReactMarkdown — evita re-parse desnecessário do AST.
const MD_REMARK_PLUGINS = [remarkGfm];
const MD_COMPONENTS = { code: CodeBlock };

// Regex pré-compilados (eram instanciados a cada chamada de suggestsKeraSwitch).
const SWITCH_PATTERNS = [
  /\bkera\s+(principal|generalista|m[ãa]e)\b/,
  /\b(use|usa|chama|chame|abre|abra|troc[ae]|mude|mud[ae]|v[ãa]|v[áa])\s+(pra|para|para\s+a|pra\s+a|à|a)?\s*kera\b/,
  /\bagente\s+kera\b/,
  /\*\*kera\*\*/,
  /\bfora\s+do\s+(meu\s+)?(escopo|tema|foco|dom[íi]nio)\b/,
];

// Detecta se a resposta do especialista sugere trocar pra Kera principal.
export const suggestsKeraSwitch = (text: string): boolean => {
  if (!text) return false;
  const t = text.toLowerCase();
  return SWITCH_PATTERNS.some(re => re.test(t));
};

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string | ContentPart[];
};

const renderUserContent = (content: string | ContentPart[]) => {
  if (typeof content === "string") {
    const parts = content.split(/\n\n--- Anexo: (.+?) ---\n```\n([\s\S]*?)\n```/);
    if (parts.length === 1) return <p className="whitespace-pre-wrap">{content}</p>;
    const elements: React.ReactNode[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (i % 3 === 0) {
        if (parts[i].trim()) elements.push(<p key={`t${i}`} className="whitespace-pre-wrap">{parts[i]}</p>);
      } else if (i % 3 === 1) {
        const name = parts[i];
        const preview = (parts[i + 1] || "").slice(0, 80);
        elements.push(
     <div key={`f${i}`} className="mt-2 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-background/40 backdrop-blur-sm border border-border/40 text-xs hover:border-primary/20 transition-colors group cursor-default">
       <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
         <FileText className="size-4.5 text-primary" />
       </div>
       <div className="min-w-0">
         <p className="font-semibold text-foreground truncate">{name}</p>
         <p className="text-muted-foreground truncate opacity-70 italic font-mono">{preview}…</p>
       </div>
     </div>
        );
      }
    }
    return <div className="space-y-1">{elements}</div>;
  }

  const text = content.find(c => c.type === "text") as Extract<ContentPart, { type: "text" }> | undefined;
  const images = content.filter(c => c.type === "image_url") as Extract<ContentPart, { type: "image_url" }>[];
  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className={`grid gap-2 ${images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {images.map((img, i) => (
            <img key={i} src={img.image_url.url} alt={`anexo ${i + 1}`} className="rounded-lg max-h-64 w-full object-cover border border-border" />
          ))}
        </div>
      )}
      {text?.text && <p className="whitespace-pre-wrap">{text.text}</p>}
    </div>
  );
};

type Props = {
  msg: ChatMessage;
  streaming?: boolean;
  onSpeak?: (text: string) => void;
  onStopSpeak?: () => void;
  isSpeaking?: boolean;
  showSwitchToKera?: boolean;
  onSwitchToKera?: () => void;
};

const MessageBubbleImpl = ({
  msg,
  streaming,
  onSpeak,
  onStopSpeak,
  isSpeaking,
  showSwitchToKera,
  onSwitchToKera,
}: Props) => {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === "user";
  const plainText = typeof msg.content === "string" ? msg.content : "";

  // Skip regex pesado durante streaming (re-roda a cada token).
  const shouldOfferSwitch = useMemo(() => {
    if (isUser || streaming || !showSwitchToKera || !onSwitchToKera) return false;
    return suggestsKeraSwitch(plainText);
  }, [isUser, streaming, showSwitchToKera, onSwitchToKera, plainText]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(plainText);
    setCopied(true);
    toast.success("Resposta copiada!");
    setTimeout(() => setCopied(false), 2000);
  }, [plainText]);

  const handleSpeakClick = useCallback(() => {
    if (isSpeaking) onStopSpeak?.();
    else onSpeak?.(plainText.replace(/```[\s\S]*?```/g, "(bloco de código)").replace(/[#*_`>]/g, ""));
  }, [isSpeaking, onSpeak, onStopSpeak, plainText]);

  return (
    <div className={`flex gap-3 w-full group/msg ${isUser ? "flex-row-reverse" : "flex-row"} animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out`}>
      <div className={`shrink-0 size-10 rounded-xl overflow-hidden border flex items-center justify-center transition-all duration-300 ${
        isUser
          ? "border-border bg-secondary shadow-sm"
          : "border-primary/30 shadow-glow bg-card ring-1 ring-primary/10"
      }`}>
        {isUser ? (
          <User className="size-5 text-muted-foreground" />
        ) : (
          <img
            src={keraAvatar}
            alt="Kera"
            loading="lazy"
            decoding="async"
            className="size-full object-cover object-center scale-[1.3] transition-transform duration-500 group-hover/msg:scale-[1.4]"
          />
        )}
      </div>
      <div className={`max-w-[88%] md:max-w-[80%] min-w-0 rounded-2xl px-5 py-4 text-[15px] leading-relaxed shadow-sm transition-all duration-300 ${
        isUser
          ? "bg-primary/5 text-foreground border border-primary/10 rounded-tr-sm hover:bg-primary/10"
          : "panel border border-white/5 rounded-tl-sm prose-kera hover:shadow-md hover:border-white/10"
      }`}>
        {isUser ? (
          <div className="font-medium">{renderUserContent(msg.content)}</div>
        ) : (
          <>
            <ReactMarkdown remarkPlugins={MD_REMARK_PLUGINS} components={MD_COMPONENTS}>{plainText || ""}</ReactMarkdown>
            {streaming && <span className="inline-block w-2.5 h-5 bg-primary/80 rounded-sm ml-1.5 align-middle animate-blink" />}

            {shouldOfferSwitch && (
              <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/20 animate-in zoom-in-95 duration-300">
                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="size-4 text-primary" />
                </div>
                <span className="text-[13px] font-medium text-foreground/80 flex-1 min-w-0">
                  Kera principal pode ajudar mais?
                </span>
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 px-3 text-xs font-semibold bg-primary hover:bg-primary-glow text-primary-foreground shadow-md transition-all active:scale-95"
                  onClick={onSwitchToKera}
                >
                  Trocar <ArrowRight className="size-3.5 ml-1.5" />
                </Button>
              </div>
            )}

            {!streaming && plainText.trim() && (
              <div className="mt-4 flex justify-end items-center gap-2 border-t border-border/10 pt-3 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-300">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-3 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg font-medium transition-all"
                  onClick={handleCopy}
                  title="Copiar resposta"
                >
                  {copied ? <Check className="size-3.5 mr-1.5 text-emerald-400" /> : <Copy className="size-3.5 mr-1.5" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>

                {onSpeak && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-8 px-3 text-xs rounded-lg font-medium transition-all ${
                      isSpeaking
                        ? "text-primary bg-primary/10 hover:bg-primary/20"
                        : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                    }`}
                    onClick={handleSpeakClick}
                    aria-label={isSpeaking ? "Parar áudio" : "Ouvir resposta"}
                    title={isSpeaking ? "Parar" : "Ouvir com voz da Kera"}
                  >
                    {isSpeaking ? <Square className="size-3.5 mr-1.5 fill-current" /> : <Volume2 className="size-3.5 mr-1.5" />}
                    {isSpeaking ? "Parar" : "Ouvir"}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Memoizado: mensagens antigas não re-renderizam quando uma nova chega ou
// quando o assistente está streaming (apenas a última atualiza).
export const MessageBubble = memo(MessageBubbleImpl, (prev, next) => {
  // Re-renderiza só se props que afetam o visual mudarem.
  if (prev.msg !== next.msg) return false;
  if (prev.streaming !== next.streaming) return false;
  if (prev.isSpeaking !== next.isSpeaking) return false;
  if (prev.showSwitchToKera !== next.showSwitchToKera) return false;
  // Callbacks: comparamos por referência (pais devem usar useCallback).
  if (prev.onSpeak !== next.onSpeak) return false;
  if (prev.onStopSpeak !== next.onStopSpeak) return false;
  if (prev.onSwitchToKera !== next.onSwitchToKera) return false;
  return true;
});
