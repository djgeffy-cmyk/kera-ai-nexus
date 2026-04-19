import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, LogOut, Send, MessageSquare, Trash2, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import keraLogo from "@/assets/kera-logo.png";
import keraAvatar from "@/assets/kera-avatar.png";
import { MessageBubble, type ChatMessage } from "@/components/chat/MessageBubble";

type Conversation = { id: string; title: string; updated_at: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-kera`;

const Chat = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Kera AI — Chat";
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => { if (userId) loadConversations(); }, [userId]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from("conversations").select("id,title,updated_at")
      .order("updated_at", { ascending: false });
    if (error) return toast.error(error.message);
    setConversations(data || []);
    if (data && data.length && !currentId) selectConversation(data[0].id);
  };

  const selectConversation = async (id: string) => {
    setCurrentId(id);
    const { data, error } = await supabase
      .from("messages").select("id,role,content")
      .eq("conversation_id", id).order("created_at", { ascending: true });
    if (error) return toast.error(error.message);
    setMessages((data || []).map(m => ({ id: m.id, role: m.role as "user"|"assistant", content: m.content })));
  };

  const newConversation = async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("conversations").insert({ user_id: userId, title: "Nova conversa" })
      .select().single();
    if (error) return toast.error(error.message);
    setConversations([data as Conversation, ...conversations]);
    setCurrentId(data.id);
    setMessages([]);
  };

  const deleteConversation = async (id: string) => {
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setConversations(conversations.filter(c => c.id !== id));
    if (currentId === id) { setCurrentId(null); setMessages([]); }
  };

  const logout = async () => { await supabase.auth.signOut(); navigate("/auth"); };

  const send = async () => {
    if (!input.trim() || streaming || !userId) return;
    let convId = currentId;
    if (!convId) {
      const { data, error } = await supabase
        .from("conversations").insert({ user_id: userId, title: input.slice(0, 40) })
        .select().single();
      if (error) return toast.error(error.message);
      convId = data.id;
      setCurrentId(convId);
      setConversations([data as Conversation, ...conversations]);
    }

    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setStreaming(true);

    await supabase.from("messages").insert({
      conversation_id: convId, user_id: userId, role: "user", content: userMsg.content,
    });

    // Auto title for first message
    if (messages.length === 0) {
      const newTitle = userMsg.content.slice(0, 50);
      await supabase.from("conversations").update({ title: newTitle }).eq("id", convId);
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: newTitle } : c));
    }

    let assistantText = "";
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sess.session ? { Authorization: `Bearer ${sess.session.access_token}` } : {}),
        },
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })) }),
      });

      if (!resp.ok || !resp.body) {
        const j = await resp.json().catch(() => ({}));
        if (resp.status === 429) toast.error("Muitas requisições. Aguarde alguns segundos.");
        else if (resp.status === 402) toast.error("Créditos de IA esgotados.");
        else toast.error(j.error || "Falha ao chamar a Kera.");
        setMessages(prev => prev.slice(0, -1));
        setStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: assistantText };
                return copy;
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      if (assistantText) {
        await supabase.from("messages").insert({
          conversation_id: convId, user_id: userId, role: "assistant", content: assistantText,
        });
        await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro de conexão.");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const Sidebar = () => (
    <aside className="h-full w-full md:w-72 panel border-r border-border flex flex-col">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <img src={keraLogo} alt="Kera AI" className="h-8" />
      </div>
      <div className="p-3">
        <Button onClick={newConversation} className="w-full bg-gradient-cyber text-primary-foreground font-display tracking-wide hover:opacity-90 shadow-soft">
          <Plus className="size-4 mr-1" /> Nova conversa
        </Button>
      </div>
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-1 pb-4">
          {conversations.map(c => (
            <div key={c.id}
              className={`group flex items-center gap-2 rounded-lg px-2 py-2 text-sm cursor-pointer transition ${
                currentId === c.id ? "bg-secondary text-primary border border-primary/30" : "hover:bg-secondary/60"
              }`}
              onClick={() => selectConversation(c.id)}
            >
              <MessageSquare className="size-4 shrink-0 opacity-70" />
              <span className="truncate flex-1">{c.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                aria-label="Excluir conversa"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {!conversations.length && (
            <p className="text-xs text-muted-foreground text-center py-6 px-2">Nenhuma conversa ainda. Clique em "Nova conversa".</p>
          )}
        </div>
      </ScrollArea>
      <div className="p-3 border-t border-border">
        <Button variant="ghost" onClick={logout} className="w-full justify-start text-muted-foreground hover:text-foreground">
          <LogOut className="size-4 mr-2" /> Sair
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="h-screen flex">
      <div className="hidden md:flex"><Sidebar /></div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border panel flex items-center px-3 md:px-6 gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden"><Menu className="size-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-transparent border-r-0"><Sidebar /></SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary shadow-glow animate-pulse-glow" />
            <h1 className="font-display text-base md:text-lg text-glow">KERA AI</h1>
          </div>
          <div className="ml-auto text-xs text-muted-foreground hidden sm:block">
            Direta. Honesta. Útil.
          </div>
        </header>

        <div ref={scrollerRef} className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
            {messages.length === 0 && !streaming && (
              <div className="text-center pt-10 md:pt-20">
                <img src={keraAvatar} alt="Avatar da Kera" className="size-28 md:size-36 mx-auto rounded-full object-cover object-top border border-primary/40 shadow-glow" />
                <h2 className="font-display text-2xl md:text-3xl mt-6 text-glow">Olá, eu sou a Kera</h2>
                <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                  Sua IA truth-seeking para tecnologia, programação, cibersegurança, licitações e leis de TI no Brasil.
                </p>
                <div className="grid sm:grid-cols-2 gap-2 mt-8 max-w-xl mx-auto">
                  {[
                    "Explique RLS no Supabase com exemplo",
                    "Resumo da Lei 14.133 para TI",
                    "Como mitigar ataque CSRF em React",
                    "Diferença entre MIT, Apache 2.0 e GPL",
                  ].map(s => (
                    <button key={s} onClick={() => setInput(s)}
                      className="text-left text-sm p-3 panel border border-border hover:border-primary/50 rounded-xl transition">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <MessageBubble key={m.id ?? i} msg={m} streaming={streaming && i === messages.length - 1 && m.role === "assistant"} />
            ))}
          </div>
        </div>

        <div className="border-t border-border panel p-3 md:p-4">
          <div className="max-w-3xl mx-auto flex gap-2 items-end">
            <Textarea
              value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey}
              placeholder="Pergunte algo à Kera..."
              rows={1}
              className="resize-none min-h-[48px] max-h-40 bg-input/40 border-border focus-visible:ring-primary"
            />
            <Button onClick={send} disabled={!input.trim() || streaming}
              className="bg-gradient-cyber text-primary-foreground shadow-glow hover:opacity-90 h-12 px-4">
              <Send className="size-5" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Kera pode cometer erros. Verifique informações importantes.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Chat;
