import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import keraAvatar from "@/assets/kera-avatar.png";
import { User } from "lucide-react";

export type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
};

export const MessageBubble = ({ msg, streaming }: { msg: ChatMessage; streaming?: boolean }) => {
  const isUser = msg.role === "user";
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
          <p className="whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content || ""}</ReactMarkdown>
            {streaming && <span className="inline-block w-2 h-4 bg-primary ml-1 align-middle animate-blink" />}
          </>
        )}
      </div>
    </div>
  );
};
