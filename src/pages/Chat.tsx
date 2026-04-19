import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Plus, LogOut, Send, MessageSquare, Trash2, Menu, Settings,
  Image as ImageIcon, LayoutGrid, FolderPlus, Mic, MicOff, Volume2, VolumeX, Bot, ChevronRight,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import keraLogo from "@/assets/kera-logo.png";
import keraAvatar from "@/assets/kera-avatar.png";
import { MessageBubble, type ChatMessage } from "@/components/chat/MessageBubble";
import { PROVIDERS, getPreferredProvider, setPreferredProvider, type ProviderId } from "@/lib/providers";
import { BUILTIN_AGENTS, getBuiltinAgent, DEFAULT_AGENT_KEY } from "@/lib/agents";
import { useVoice } from "@/hooks/useVoice";

type Conversation = { id: string; title: string; updated_at: string; agent_key: string };
type CustomAgent = { id: string; name: string; system_prompt: string; description: string | null };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-kera`;
const STATUS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/providers-status`;

const Chat = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [customAgents, setCustomAgents] = useState<CustomAgent[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [agentKey, setAgentKey] = useState<string>(DEFAULT_AGENT_KEY);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderId>(getPreferredProvider());
  const [voiceMode, setVoiceMode] = useState(false);
  const [hasElevenLabs, setHasElevenLabs] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const voice = useVoice({
    useElevenLabs: hasElevenLabs,
    onTranscript: (t) => { setInput(t); setTimeout(() => sendText(t), 100); },
  });

  useEffect(() => {
    document.title = "Kera AI — Chat";
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    fetch(STATUS_URL).then(r => r.json()).then(s => setHasElevenLabs(!!s.elevenlabs)).catch(() => {});
    // garante carregamento das vozes
    if (typeof window !== "undefined") window.speechSynthesis?.getVoices();
  }, []);

  useEffect(() => { if (userId) { loadConversations(); loadCustomAgents(); } }, [userId]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from("conversations").select("id,title,updated_at,agent_key")
      .order("updated_at", { ascending: false });
    if (error) return toast.error(error.message);
    setConversations((data || []) as Conversation[]);
    if (data && data.length && !currentId) selectConversation(data[0].id, data[0].agent_key);
  };

  const loadCustomAgents = async () => {
    const { data } = await supabase.from("agents").select("id,name,system_prompt,description");
    setCustomAgents((data || []) as CustomAgent[]);
  };

  const selectConversation = async (id: string, ak?: string) => {
    setCurrentId(id);
    if (ak) setAgentKey(ak);
    const { data, error } = await supabase
      .from("messages").select("id,role,content")
      .eq("conversation_id", id).order("created_at", { ascending: true });
    if (error) return toast.error(error.message);
    setMessages((data || []).map(m => ({ id: m.id, role: m.role as "user"|"assistant", content: m.content })));
  };

  const newConversation = async (forAgent?: string) => {
    if (!userId) return;
    const ak = forAgent || agentKey;
    const { data, error } = await supabase
      .from("conversations").insert({ user_id: userId, title: "Nova conversa", agent_key: ak })
      .select().single();
    if (error) return toast.error(error.message);
    setConversations([data as Conversation, ...conversations]);
    setCurrentId(data.id);
    setAgentKey(ak);
    setMessages([]);
  };

  const deleteConversation = async (id: string) => {
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setConversations(conversations.filter(c => c.id !== id));
    if (currentId === id) { setCurrentId(null); setMessages([]); }
  };

  const logout = async () => { await supabase.auth.signOut(); navigate("/auth"); };

  const resolveSystemPrompt = (ak: string): string | undefined => {
    const builtin = getBuiltinAgent(ak);
    if (builtin) return builtin.systemPrompt;
    const custom = customAgents.find(a => a.id === ak);
    return custom?.system_prompt;
  };

  const sendText = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || streaming || !userId) return;
    let convId = currentId;
    if (!convId) {
      const { data, error } = await supabase
        .from("conversations").insert({ user_id: userId, title: content.slice(0, 40), agent_key: agentKey })
        .select().single();
      if (error) return toast.error(error.message);
      convId = data.id;
      setCurrentId(convId);
      setConversations([data as Conversation, ...conversations]);
    }

    const userMsg: ChatMessage = { role: "user", content };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setStreaming(true);

    await supabase.from("messages").insert({
      conversation_id: convId, user_id: userId, role: "user", content: userMsg.content,
    });

    if (messages.length === 0) {
      const newTitle = content.slice(0, 50);
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
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          provider: provider === "auto" ? undefined : provider,
          systemPrompt: resolveSystemPrompt(agentKey),
        }),
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
        if (voiceMode) voice.speak(assistantText.replace(/```[\s\S]*?```/g, "(bloco de código)").replace(/[#*_`>]/g, ""));
      }
    } catch (e: any) {
      toast.error(e.message || "Erro de conexão.");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); }
  };

  const currentAgent = getBuiltinAgent(agentKey) || customAgents.find(a => a.id === agentKey);
  const currentAgentName = currentAgent?.name || "Kera";

  const Sidebar = () => (
    <aside className="h-full w-full md:w-72 panel border-r border-border flex flex-col">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <img src={keraLogo} alt="Kera AI" className="h-8" />
      </div>

      {/* Top circles */}
      <div className="p-4 grid grid-cols-2 gap-3 border-b border-border">
        <button className="flex flex-col items-center gap-1 group" onClick={() => toast.info("Galeria em breve")}>
          <div className="size-14 rounded-full bg-secondary flex items-center justify-center group-hover:bg-secondary/80 transition">
            <ImageIcon className="size-5 text-muted-foreground" />
          </div>
          <span className="text-xs">Galeria</span>
        </button>
        <button className="flex flex-col items-center gap-1 group" onClick={() => navigate("/agents")}>
          <div className="size-14 rounded-full bg-secondary flex items-center justify-center group-hover:bg-secondary/80 transition">
            <LayoutGrid className="size-5 text-muted-foreground" />
          </div>
          <span className="text-xs">Agentes</span>
        </button>
      </div>

      <ScrollArea className="flex-1">
        {/* Agentes */}
        <div className="px-3 pt-4 pb-2">
          <h3 className="font-display text-sm tracking-wide mb-2 px-1">Agentes</h3>
          <button onClick={() => navigate("/agents")}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-secondary/60 transition text-sm">
            <FolderPlus className="size-5 text-muted-foreground" /> Novo agente
          </button>
          {BUILTIN_AGENTS.map(a => {
            const Icon = a.icon;
            const active = agentKey === a.key;
            return (
              <button key={a.key}
                onClick={() => { setAgentKey(a.key); newConversation(a.key); }}
                className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition text-sm ${
                  active ? "bg-primary/10 text-primary" : "hover:bg-secondary/60"
                }`}>
                <Icon className={`size-5 ${a.iconColor}`} />
                <span className="truncate">{a.name}</span>
              </button>
            );
          })}
          {customAgents.map(a => {
            const active = agentKey === a.id;
            return (
              <button key={a.id}
                onClick={() => { setAgentKey(a.id); newConversation(a.id); }}
                className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition text-sm ${
                  active ? "bg-primary/10 text-primary" : "hover:bg-secondary/60"
                }`}>
                <Bot className="size-5 text-cyan-400" />
                <span className="truncate">{a.name}</span>
              </button>
            );
          })}
        </div>

        {/* Conversas */}
        <div className="px-3 pt-2 pb-4">
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="font-display text-sm tracking-wide">Conversas</h3>
            <button onClick={() => newConversation()} className="text-muted-foreground hover:text-primary">
              <Plus className="size-4" />
            </button>
          </div>
          <div className="space-y-1">
            {conversations.map(c => (
              <div key={c.id}
                className={`group flex items-center gap-2 rounded-lg px-2 py-2 text-sm cursor-pointer transition ${
                  currentId === c.id ? "bg-secondary text-primary border border-primary/30" : "hover:bg-secondary/60"
                }`}
                onClick={() => selectConversation(c.id, c.agent_key)}
              >
                <MessageSquare className="size-4 shrink-0 opacity-70" />
                <span className="truncate flex-1">{c.title}</span>
                <button onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            {!conversations.length && (
              <p className="text-xs text-muted-foreground text-center py-4 px-2">Sem conversas ainda.</p>
            )}
          </div>
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border space-y-1">
        <Button variant="ghost" onClick={() => navigate("/admin")} className="w-full justify-start text-muted-foreground hover:text-foreground">
          <Settings className="size-4 mr-2" /> Painel admin
        </Button>
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:bg-secondary/60 px-2 py-1 rounded-lg transition">
                <span className="size-2 rounded-full bg-primary shadow-glow animate-pulse-glow" />
                <h1 className="font-display text-base md:text-lg text-glow">{currentAgentName.toUpperCase()}</h1>
                <ChevronRight className="size-4 rotate-90 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 bg-card border-border">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Agentes prontos</DropdownMenuLabel>
              {BUILTIN_AGENTS.map(a => {
                const Icon = a.icon;
                return (
                  <DropdownMenuItem key={a.key} onClick={() => { setAgentKey(a.key); newConversation(a.key); }}>
                    <Icon className={`size-4 mr-2 ${a.iconColor}`} /> {a.name}
                  </DropdownMenuItem>
                );
              })}
              {customAgents.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Seus agentes</DropdownMenuLabel>
                  {customAgents.map(a => (
                    <DropdownMenuItem key={a.id} onClick={() => { setAgentKey(a.id); newConversation(a.id); }}>
                      <Bot className="size-4 mr-2 text-cyan-400" /> {a.name}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/agents")}>
                <Plus className="size-4 mr-2" /> Gerenciar agentes
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="ml-auto flex items-center gap-2">
            <Select value={provider} onValueChange={(v) => { setProvider(v as ProviderId); setPreferredProvider(v as ProviderId); }}>
              <SelectTrigger className="h-8 w-[120px] sm:w-[180px] text-xs bg-input/40 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map(p => (<SelectItem key={p.id} value={p.id} className="text-xs">{p.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost" size="icon"
              onClick={() => { setVoiceMode(v => !v); if (voiceMode) voice.stopSpeaking(); }}
              aria-label="Modo voz"
              className={voiceMode ? "text-primary" : ""}
            >
              {voiceMode ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            </Button>
          </div>
        </header>

        <div ref={scrollerRef} className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
            {messages.length === 0 && !streaming && (
              <div className="text-center pt-10 md:pt-20">
                <img src={keraAvatar} alt="Avatar da Kera" className="size-28 md:size-36 mx-auto rounded-full object-cover object-top border border-primary/40 shadow-glow" />
                <h2 className="font-display text-2xl md:text-3xl mt-6 text-glow">Olá, eu sou a {currentAgentName}</h2>
                <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                  {currentAgent && "description" in currentAgent ? currentAgent.description : "Sua IA truth-seeking. Direta. Honesta. Útil."}
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
            <Button
              onClick={() => voice.listening ? voice.stopListening() : voice.startListening()}
              variant={voice.listening ? "default" : "ghost"}
              size="icon"
              className={`h-12 w-12 shrink-0 ${voice.listening ? "bg-red-500 hover:bg-red-600 text-white animate-pulse" : ""}`}
              aria-label="Falar"
            >
              {voice.listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </Button>
            <Textarea
              value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey}
              placeholder={voice.listening ? "Ouvindo..." : `Pergunte algo à ${currentAgentName}...`}
              rows={1}
              className="resize-none min-h-[48px] max-h-40 bg-input/40 border-border focus-visible:ring-primary"
            />
            <Button onClick={() => sendText()} disabled={!input.trim() || streaming}
              className="bg-gradient-cyber text-primary-foreground shadow-glow hover:opacity-90 h-12 px-4">
              <Send className="size-5" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            {voiceMode ? "🔊 Modo voz ativo — respostas serão faladas" : "Kera pode cometer erros. Verifique informações importantes."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Chat;
