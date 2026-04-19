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
  Paperclip, X, FileText, ShieldCheck, Activity, Download,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import keraLogo from "@/assets/kera-logo.png";
import keraAvatar from "@/assets/kera-avatar.png";
import keraAvatarVideo from "@/assets/kera-avatar.mp4.asset.json";
import { MessageBubble, type ChatMessage } from "@/components/chat/MessageBubble";
import { PROVIDERS, getPreferredProvider, setPreferredProvider, type ProviderId } from "@/lib/providers";
import { BUILTIN_AGENTS, getBuiltinAgent, DEFAULT_AGENT_KEY } from "@/lib/agents";
import { useVoice } from "@/hooks/useVoice";
import { fileToAttachment, buildUserContent, type Attachment } from "@/lib/attachments";
import { isImageRequest, extractImagePrompt } from "@/lib/imageDetect";
import { exportConversationToPdf } from "@/lib/exportPdf";

type Conversation = { id: string; title: string; updated_at: string; agent_key: string };
type CustomAgent = { id: string; name: string; system_prompt: string; description: string | null };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-kera`;
const STATUS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/providers-status`;
const MONITOR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/monitor-urls`;
const NETTRACE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/network-trace`;
const IMAGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`;

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [provider, setProvider] = useState<ProviderId>(getPreferredProvider());
  const [voiceMode, setVoiceMode] = useState(false);
  const [hasElevenLabs, setHasElevenLabs] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const voice = useVoice({
    useElevenLabs: hasElevenLabs,
    onTranscript: (t) => { setInput(t); setTimeout(() => sendText(t), 100); },
  });

  useEffect(() => {
    document.title = "Kera AI — Chat";
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: r } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
        setIsAdmin(!!r);
      }
    });
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
    setMessages((data || []).map(m => {
      let content: ChatMessage["content"] = m.content;
      // Tenta reidratar conteúdo multimodal salvo como JSON
      if (typeof m.content === "string" && m.content.startsWith("[") && m.content.includes('"image_url"')) {
        try { content = JSON.parse(m.content); } catch { /* mantém string */ }
      }
      return { id: m.id, role: m.role as "user" | "assistant", content };
    }));
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

  const generateImageMessage = async (rawText: string) => {
    let convId = currentId;
    if (!convId) {
      const titleSeed = rawText.slice(0, 40);
      const { data, error } = await supabase
        .from("conversations").insert({ user_id: userId, title: titleSeed, agent_key: agentKey })
        .select().single();
      if (error) return toast.error(error.message);
      convId = data.id;
      setCurrentId(convId);
      setConversations([data as Conversation, ...conversations]);
    }

    const userMsg: ChatMessage = { role: "user", content: rawText };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    await supabase.from("messages").insert({
      conversation_id: convId, user_id: userId, role: "user", content: rawText,
    });
    if (messages.length === 0) {
      const newTitle = rawText.slice(0, 50);
      await supabase.from("conversations").update({ title: newTitle }).eq("id", convId);
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: newTitle } : c));
    }

    // placeholder enquanto gera
    setMessages(prev => [...prev, { role: "assistant", content: "🎨 Gerando imagem..." }]);

    try {
      const imgPrompt = extractImagePrompt(rawText);
      const { data: sess } = await supabase.auth.getSession();
      const resp = await fetch(IMAGE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sess.session ? { Authorization: `Bearer ${sess.session.access_token}` } : {}),
        },
        body: JSON.stringify({ prompt: imgPrompt }),
      });
      const j = await resp.json();
      if (!resp.ok) {
        if (resp.status === 429) toast.error("Muitas requisições. Aguarde alguns segundos.");
        else if (resp.status === 402) toast.error("Créditos de IA esgotados.");
        else toast.error(j.error || "Falha ao gerar imagem.");
        setMessages(prev => prev.slice(0, -1));
        setStreaming(false);
        return;
      }

      const imageUrl: string = j.imageUrl;
      const assistantContent = [
        { type: "text" as const, text: `Aqui está sua imagem: *${imgPrompt}*` },
        { type: "image_url" as const, image_url: { url: imageUrl } },
      ];

      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: assistantContent };
        return copy;
      });

      await supabase.from("messages").insert({
        conversation_id: convId, user_id: userId, role: "assistant",
        content: JSON.stringify(assistantContent),
      });
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar imagem.");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setStreaming(false);
    }
  };

  const handleExportPdf = async () => {
    if (!messages.length) {
      toast.error("Nada pra exportar — a conversa está vazia.");
      return;
    }
    const conv = conversations.find(c => c.id === currentId);
    toast.info("Gerando PDF...");
    try {
      await exportConversationToPdf({
        title: conv?.title || "Conversa",
        agentName: currentAgentName,
        messages,
      });
      toast.success("PDF baixado!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao exportar PDF.");
    }
  };

  const sendText = async (text?: string) => {
    const rawText = (text ?? input).trim();
    const hasAttach = attachments.length > 0;
    if ((!rawText && !hasAttach) || streaming || !userId) return;

    // 🎨 Detecção de pedido de geração de imagem (sem anexos)
    if (rawText && !hasAttach && isImageRequest(rawText)) {
      await generateImageMessage(rawText);
      return;
    }

    let convId = currentId;
    if (!convId) {
      const titleSeed = rawText || (hasAttach ? `Anexo: ${attachments[0].name}` : "Nova conversa");
      const { data, error } = await supabase
        .from("conversations").insert({ user_id: userId, title: titleSeed.slice(0, 40), agent_key: agentKey })
        .select().single();
      if (error) return toast.error(error.message);
      convId = data.id;
      setCurrentId(convId);
      setConversations([data as Conversation, ...conversations]);
    }

    const userContent = buildUserContent(rawText, attachments);
    const userMsg: ChatMessage = { role: "user", content: userContent };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setAttachments([]);
    setStreaming(true);

    // Para o DB, content é text — serializa multimodal como JSON (pra reidratar depois).
    const dbContent = typeof userContent === "string" ? userContent : JSON.stringify(userContent);
    await supabase.from("messages").insert({
      conversation_id: convId, user_id: userId, role: "user", content: dbContent,
    });

    if (messages.length === 0) {
      const newTitle = (rawText || `Anexo: ${attachments[0]?.name ?? "arquivo"}`).slice(0, 50);
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

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    for (const f of list) {
      try {
        const a = await fileToAttachment(f);
        setAttachments(prev => [...prev, a]);
      } catch (err: any) {
        toast.error(err?.message || `Falha ao anexar ${f.name}`);
      }
    }
  };

  const onPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const it of Array.from(items)) {
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      await addFiles(files);
      toast.success(`${files.length} arquivo(s) colado(s)`);
    }
  };

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const currentAgent = getBuiltinAgent(agentKey) || customAgents.find(a => a.id === agentKey);
  const currentAgentName = currentAgent?.name || "Kera";
  const isSentinela = agentKey === "kera-sentinela";

  const runSentinelaCheck = async () => {
    if (streaming) return;

    // Busca alvos cadastrados pelo usuário no admin
    const { data: targetRows, error: tErr } = await supabase
      .from("monitor_targets")
      .select("label,url,enabled")
      .eq("enabled", true);

    if (tErr) return toast.error(tErr.message);
    if (!targetRows || targetRows.length === 0) {
      toast.error("Nenhuma URL cadastrada. Vá em Painel admin → URLs do Sentinela para adicionar.");
      return;
    }

    const urls = targetRows.map(t => t.url);
    const labelByUrl = new Map(targetRows.map(t => [t.url, t.label]));

    toast.info(`🛡️ Sentinela verificando ${urls.length} sistema(s)…`);
    try {
      const resp = await fetch(MONITOR_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      const lines = data.results.map((r: { url: string; ok: boolean; status: number | null; statusText: string; latencyMs: number | null; server?: string; error?: string }) => {
        const flag = r.ok ? "🟢" : (r.status && r.status >= 500 ? "🔴" : "🟠");
        const statusInfo = r.status ? `${r.status} ${r.statusText}` : `ERRO: ${r.error ?? "sem resposta"}`;
        const label = labelByUrl.get(r.url) ?? r.url;
        return `- ${flag} **${label}** (${r.url}) → ${statusInfo} · ${r.latencyMs ?? "?"}ms${r.server ? ` · server: ${r.server}` : ""}`;
      }).join("\n");

      const report = `🛡️ **Relatório Sentinela** — ${new Date(data.summary.checkedAt).toLocaleString("pt-BR")}

**Resumo:** ${data.summary.up}/${data.summary.total} UP · ${data.summary.down} DOWN

${lines}

Por favor, analise estes resultados, classifique a severidade de cada item e indique ações recomendadas.`;

      await sendText(report);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "erro";
      toast.error(`Falha no monitor: ${msg}`);
    }
  };

  const runNetworkTrace = async () => {
    if (streaming) return;

    // Extrai hosts de URLs cadastradas + alvos clássicos da IPM
    const { data: targetRows } = await supabase
      .from("monitor_targets")
      .select("url,enabled")
      .eq("enabled", true);

    const hostsFromTargets = (targetRows || [])
      .map(t => t.url.replace(/^https?:\/\//, "").replace(/\/.*$/, ""));

    // Garante hosts críticos da IPM/Prefeitura no teste
    const baseHosts = ["guaramirim.atende.net", "guaramirim.sc.gov.br"];
    const hosts = Array.from(new Set([...baseHosts, ...hostsFromTargets])).slice(0, 8);

    toast.info(`📡 Análise de rede em ${hosts.length} host(s)… (5 sondagens cada)`);
    try {
      const resp = await fetch(NETTRACE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hosts, count: 5 }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      type HostRes = {
        host: string; resolvedIp?: string;
        sent: number; received: number; lossPct: number;
        minMs: number | null; avgMs: number | null; maxMs: number | null; jitterMs: number | null;
        samples: { ok: boolean; ms: number | null; status: number | null; error?: string }[];
      };

      const blocks = (data.results as HostRes[]).map((r) => {
        const lossFlag = r.lossPct === 0 ? "🟢" : r.lossPct < 20 ? "🟡" : r.lossPct < 50 ? "🟠" : "🔴";
        const jitterFlag = (r.jitterMs ?? 0) < 30 ? "🟢" : (r.jitterMs ?? 0) < 80 ? "🟡" : "🔴";
        const samplesLine = r.samples
          .map((s, i) => s.ok ? `#${i + 1}: ${s.ms}ms (HTTP ${s.status})` : `#${i + 1}: TIMEOUT/${s.error ?? "erro"}`)
          .join(" · ");
        return `### ${r.host} ${r.resolvedIp ? `(\`${r.resolvedIp}\`)` : ""}
- **Pacotes:** ${r.received}/${r.sent} recebidos · perda **${lossFlag} ${r.lossPct}%**
- **Latência:** min ${r.minMs ?? "?"}ms · avg **${r.avgMs ?? "?"}ms** · max ${r.maxMs ?? "?"}ms
- **Jitter:** ${jitterFlag} ${r.jitterMs ?? "?"}ms
- **Amostras:** ${samplesLine}`;
      }).join("\n\n");

      const report = `📡 **Análise de Rede — Sentinela** — ${new Date(data.summary.checkedAt).toLocaleString("pt-BR")}

**Método:** sondagem HTTPS HEAD x${data.summary.probesPerHost} por host (equivalente funcional a ping para serviços web).
**Origem da medição:** ${data.summary.origin}

> ⚠️ Esta medição parte da edge da Lovable Cloud, **não da rede interna da Prefeitura**. Para diagnóstico definitivo de perda de pacote da PMG → IPM, rode \`mtr -rwc 100 guaramirim.atende.net\` ou \`pathping\` num desktop dentro da rede municipal e cole o resultado aqui.

${blocks}

Por favor, analise: há perda de pacote? jitter alto sugere instabilidade de rota? alguma latência fora do padrão para um datacenter brasileiro? Sugira os próximos passos de diagnóstico.`;

      await sendText(report);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "erro";
      toast.error(`Falha na análise de rede: ${msg}`);
    }
  };

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
        <Button variant="ghost" onClick={() => navigate("/security")} className="w-full justify-start text-muted-foreground hover:text-foreground">
          <ShieldCheck className="size-4 mr-2" /> Segurança (2FA)
        </Button>
        {isAdmin && (
          <Button variant="ghost" onClick={() => navigate("/admin")} className="w-full justify-start text-muted-foreground hover:text-foreground">
            <Settings className="size-4 mr-2" /> Painel admin
          </Button>
        )}
        <Button variant="ghost" onClick={logout} className="w-full justify-start text-muted-foreground hover:text-foreground">
          <LogOut className="size-4 mr-2" /> Sair
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="h-screen flex">
      <div className="hidden md:flex"><Sidebar /></div>

      <div
        className="flex-1 flex flex-col min-w-0 relative"
        onDragEnter={(e) => {
          if (!e.dataTransfer?.types?.includes("Files")) return;
          e.preventDefault();
          dragCounter.current += 1;
          setDragging(true);
        }}
        onDragOver={(e) => {
          if (e.dataTransfer?.types?.includes("Files")) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          dragCounter.current -= 1;
          if (dragCounter.current <= 0) {
            dragCounter.current = 0;
            setDragging(false);
          }
        }}
        onDrop={async (e) => {
          e.preventDefault();
          dragCounter.current = 0;
          setDragging(false);
          const files = e.dataTransfer?.files;
          if (files && files.length) {
            await addFiles(files);
            toast.success(`${files.length} arquivo(s) anexado(s)`);
          }
        }}
      >
        {dragging && (
          <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center bg-primary/10 backdrop-blur-sm border-4 border-dashed border-primary rounded-lg m-2">
            <div className="text-center">
              <Paperclip className="size-12 mx-auto text-primary animate-pulse" />
              <p className="mt-3 font-display text-xl text-glow text-primary">Solte aqui para anexar</p>
              <p className="text-xs text-muted-foreground mt-1">Imagens, prints ou arquivos de texto/código</p>
            </div>
          </div>
        )}
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

          <Button
            variant="ghost" size="icon"
            onClick={() => newConversation()}
            aria-label="Nova conversa"
            title="Nova conversa"
            className="text-muted-foreground hover:text-primary"
          >
            <Plus className="size-5" />
          </Button>

          <Button
            variant="ghost" size="icon"
            onClick={handleExportPdf}
            aria-label="Exportar conversa em PDF"
            title="Exportar PDF"
            disabled={!messages.length || streaming}
            className="text-muted-foreground hover:text-primary"
          >
            <Download className="size-5" />
          </Button>

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
                <video
                  src={keraAvatarVideo.url}
                  poster={keraAvatar}
                  autoPlay
                  loop
                  muted
                  playsInline
                  aria-label="Avatar animado da Kera"
                  className="size-28 md:size-36 mx-auto rounded-full object-cover object-top border border-primary/40 shadow-glow bg-background"
                />
                <h2 className="font-display text-2xl md:text-3xl mt-6 text-glow">Olá, eu sou a {currentAgentName}</h2>
                <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                  {currentAgent && "description" in currentAgent ? currentAgent.description : "Sua IA truth-seeking. Direta. Honesta. Útil."}
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <MessageBubble key={m.id ?? i} msg={m} streaming={streaming && i === messages.length - 1 && m.role === "assistant"} />
            ))}
          </div>
        </div>

        <div className="border-t border-border panel p-3 md:p-4">
          <div className="max-w-3xl mx-auto space-y-2">
            {isSentinela && (
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  onClick={runSentinelaCheck}
                  disabled={streaming}
                  variant="outline"
                  size="sm"
                  className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 gap-2"
                >
                  <ShieldCheck className="size-4" />
                  Verificar status (HTTP)
                </Button>
                <Button
                  onClick={runNetworkTrace}
                  disabled={streaming}
                  variant="outline"
                  size="sm"
                  className="border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 gap-2"
                >
                  <Activity className="size-4" />
                  Análise de rede (ping/jitter/perda)
                </Button>
              </div>
            )}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <div key={i} className="relative group">
                    {a.kind === "image" ? (
                      <div className="size-16 rounded-lg overflow-hidden border border-border">
                        <img src={a.dataUrl} alt={a.name} className="size-full object-cover" />
                      </div>
                    ) : (
                      <div className="h-16 px-3 flex items-center gap-2 rounded-lg border border-border bg-background/50">
                        <FileText className="size-4 text-primary shrink-0" />
                        <span className="text-xs max-w-[120px] truncate">{a.name}</span>
                      </div>
                    )}
                    <button
                      onClick={() => removeAttachment(i)}
                      className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:scale-110 transition"
                      aria-label="Remover anexo"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 items-end">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.txt,.md,.json,.csv,.log,.yml,.yaml,.html,.xml,.css,.js,.jsx,.ts,.tsx,.py,.sql,.env,.sh"
                className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="ghost"
                size="icon"
                className="h-12 w-12 shrink-0"
                aria-label="Anexar arquivo"
                disabled={streaming}
              >
                <Paperclip className="size-5" />
              </Button>
              <Button
                onClick={() => voice.listening ? voice.stopListening() : voice.startListening()}
                variant={voice.listening ? "default" : "ghost"}
                size="icon"
                className={`h-12 w-12 shrink-0 ${voice.listening ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground animate-pulse" : ""}`}
                aria-label="Falar"
              >
                {voice.listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                onPaste={onPaste}
                placeholder={voice.listening ? "Ouvindo..." : `Pergunte algo à ${currentAgentName}... (cole um print com Ctrl+V)`}
                rows={1}
                className="resize-none min-h-[48px] max-h-40 bg-input/40 border-border focus-visible:ring-primary"
              />
              <Button
                onClick={() => sendText()}
                disabled={(!input.trim() && attachments.length === 0) || streaming}
                className="bg-gradient-cyber text-primary-foreground shadow-glow hover:opacity-90 h-12 px-4"
              >
                <Send className="size-5" />
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            {voiceMode ? "🔊 Modo voz ativo — respostas serão faladas" : "Anexe imagens (PNG/JPG) ou arquivos de texto · Cole prints com Ctrl+V"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Chat;
