import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import keraAvatar from "@/assets/kera-avatar.png";
import { User, FileText, Volume2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    // Detecta blocos "--- Anexo: nome ---" para mostrar como chip
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
          <div key={`f${i}`} className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-background/50 border border-border text-xs">
            <FileText className="size-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="font-medium truncate">{name}</p>
              <p className="text-muted-foreground truncate">{preview}…</p>
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

export const MessageBubble = ({
  msg,
  streaming,
  onSpeak,
  onStopSpeak,
  isSpeaking,
}: {
  msg: ChatMessage;
  streaming?: boolean;
  onSpeak?: (text: string) => void;
  onStopSpeak?: () => void;
  isSpeaking?: boolean;
}) => {
  const isUser = msg.role === "user";
  const plainText = typeof msg.content === "string" ? msg.content : "";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className={`shrink-0 size-9 rounded-full overflow-hidden border ${isUser ? "border-border bg-secondary flex items-center justify-center" : "border-primary/40 shadow-glow"}`}>
        {isUser ? (
          <User className="size-5 text-muted-foreground" />
        ) : (
          <img src={keraAvatar} alt="Kera" className="size-full object-cover object-top" />
        )}
      </div>
      <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
        isUser
          ? "bg-secondary text-foreground rounded-tr-sm"
          : "panel border border-primary/15 rounded-tl-sm prose-kera"
      }`}>
        {isUser ? (
          renderUserContent(msg.content)
        ) : (
          <>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{plainText || ""}</ReactMarkdown>
            {streaming && <span className="inline-block w-2 h-4 bg-primary ml-1 align-middle animate-blink" />}
            {!streaming && onSpeak && plainText.trim() && (
              <div className="mt-2 -mb-1 flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
                  onClick={() => {
                    if (isSpeaking) onStopSpeak?.();
                    else onSpeak(plainText.replace(/```[\s\S]*?```/g, "(bloco de código)").replace(/[#*_`>]/g, ""));
                  }}
                  aria-label={isSpeaking ? "Parar áudio" : "Ouvir resposta"}
                  title={isSpeaking ? "Parar" : "Ouvir com voz da Kera"}
                >
                  {isSpeaking ? <Square className="size-3.5 mr-1" /> : <Volume2 className="size-3.5 mr-1" />}
                  {isSpeaking ? "Parar" : "Ouvir"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
