import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Plus,
  LogOut,
  Send,
  MessageSquare,
  Trash2,
  Menu,
  Settings,
  Calculator,
  Image as ImageIcon,
  LayoutGrid,
  FolderPlus,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Bot,
  ChevronRight,
  Paperclip,
  X,
  FileText,
  ShieldCheck,
  Activity,
  Download,
  Ear,
  Sun,
  Moon,
  Sparkles,
  Gem,
  PanelLeftClose,
  PanelLeftOpen,
  Camera,
  Pencil,
  Eraser,
  Monitor,
  Scale,
  Heart,
  ScrollText,
  UserCheck,
  Accessibility,
  Code2,
  Shield,
  Radar,
  Apple,
  Gamepad2,
  BookOpen,
  Wifi,
  HardDrive,
  Camera as CameraIcon,
  FileSearch,
  Bug,
  Lock,
  Dumbbell,
  Trophy,
  Languages,
   Baby,
   ShieldAlert,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import keraLogo from "@/assets/kera-logo.png";
import keraAvatar from "@/assets/kera-avatar.png";
import keraAvatarVideo from "@/assets/kera-avatar.mp4.asset.json";
import keraDevBgVideo from "@/assets/kera-dev-bg.mp4.asset.json";
import keraBgVideo from "@/assets/kera-bg.mp4.asset.json";
import keraSecBgVideo from "@/assets/kera-sec-bg.mp4.asset.json";
import keraSecurityNasaBgVideo from "@/assets/kera-security-nasa-bg.mp4.asset.json";
import keraJuridicaBgVideo from "@/assets/kera-juridica-bg.mp4.asset.json";
import keraSentinelaBgVideo from "@/assets/kera-sentinela-bg.mp4.asset.json";
import keraNutriBgVideo from "@/assets/kera-nutri-bg.mp4.asset.json";
import keraGamerBgVideo from "@/assets/kera-gamer-bg.mp4.asset.json";
import keraSpaceLogo from "@/assets/kera-spaceincloud-logo.png";

import { assetUrl } from "@/lib/assetUrl";
import { MessageBubble, type ChatMessage } from "@/components/chat/MessageBubble";
import { PROVIDERS, getPreferredProvider, setPreferredProvider, type ProviderId } from "@/lib/providers";
import { BUILTIN_AGENTS, getBuiltinAgent, DEFAULT_AGENT_KEY } from "@/lib/agents";
import { useVoice } from "@/hooks/useVoice";
import { useAlwaysListening } from "@/hooks/useAlwaysListening";
import { fileToAttachment, buildUserContent, type Attachment } from "@/lib/attachments";
import { getAvailableDesktopTools, executeDesktopTool } from "@/lib/keraTools";
import { isImageRequest, extractImagePrompt } from "@/lib/imageDetect";
import { exportConversationToPdf } from "@/lib/exportPdf";
import { VoiceStatusIndicator } from "@/components/VoiceStatusIndicator";
import { useTheme } from "@/hooks/useTheme";
import { GalleryDialog } from "@/components/GalleryDialog";
import ItcmdSCCalculator, { type ItcmdResult } from "@/components/ItcmdSCCalculator";
import DanoMoralCalculator, { type DanoMoralResult } from "@/components/DanoMoralCalculator";
import AtaNotarialGenerator, { type AtaNotarialResult } from "@/components/AtaNotarialGenerator";

type Conversation = { id: string; title: string; updated_at: string; agent_key: string };
type CustomAgent = { id: string; name: string; system_prompt: string; description: string | null };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-kera`;
const STATUS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/providers-status`;
const MONITOR_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/monitor-urls`;
const NETTRACE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/network-trace`;
const IMAGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`;

// Sugestões de boas-vindas específicas por agente
const AGENT_SUGGESTIONS: Record<string, Array<{ q: string; icon: typeof Sparkles }>> = {
  kera: [
    { q: "Quais são suas capacidades?", icon: Sparkles },
    { q: "Gere uma imagem de um pôr-do-sol cyberpunk.", icon: Camera },
    { q: "Me explica o que é a Lei 14.133 em 5 linhas.", icon: ScrollText },
    { q: "Bora trocar uma ideia sobre IA hoje.", icon: Bot },
  ],
  "kera-dev": [
    { q: "Revisa esse código e me aponta bugs.", icon: Bug },
    { q: "Como estruturar uma API REST escalável?", icon: Code2 },
    { q: "Diferença entre useMemo e useCallback no React.", icon: Sparkles },
    { q: "Me ensina padrões SOLID com exemplos.", icon: FileText },
  ],
   "kera-sec": [
     { q: "Abrir o Kera Security NASA (Análise Senior).", icon: ShieldAlert },
     { q: "Explica OWASP Top 10 com exemplos práticos.", icon: Shield },
     { q: "Como fazer hardening de servidor Linux?", icon: Lock },
     { q: "Analisa esse log e identifica ameaças.", icon: FileSearch },
     { q: "Roteiro de pentest para uma aplicação web.", icon: Bug },
   ],
  "kera-security-nasa": [
    { q: "Quais linguagens de código você analisa?", icon: Code2 },
    { q: "Análise de segurança nível NASA neste código Python.", icon: FileSearch },
    { q: "Revisa este C/C++ com MISRA-C + Power of 10 (NASA/JPL).", icon: ShieldAlert },
    { q: "Auditoria OWASP Top 10 + CWE neste código JavaScript.", icon: Shield },
    { q: "Detecta SQL Injection nesta query SQL.", icon: Bug },
    { q: "Verifica buffer overflow e memory safety neste código C.", icon: Lock },
  ],
  "kera-juridica": [
    { q: "Explica a Lei 14.133/21 em pontos-chave.", icon: Scale },
    { q: "Cláusulas obrigatórias num contrato de TI.", icon: ScrollText },
    { q: "LGPD: o que minha empresa precisa fazer?", icon: ShieldCheck },
    { q: "Modelo de Termo de Referência para software.", icon: FileText },
  ],
  "kera-sentinela": [
    { q: "Verifica o status dos portais da Prefeitura.", icon: Radar },
    { q: "Esse e-mail é phishing? Vou colar o cabeçalho.", icon: ShieldCheck },
    { q: "Gerar relatório de rede da última hora.", icon: Activity },
    { q: "O que checar num incidente de segurança?", icon: Bug },
  ],
  "kera-nutri": [
    { q: "Calcula meus macros pra hipertrofia.", icon: Apple },
    { q: "Treino ABC pra ganhar massa em 12 semanas.", icon: Dumbbell },
    { q: "Suplementação básica que vale a pena.", icon: Heart },
    { q: "Como o Denis tá indo no treino hoje?", icon: Sparkles },
  ],
  "kera-gamer": [
    { q: "Build pra Elden Ring DEX iniciante.", icon: Gamepad2 },
    { q: "Como pegar a platina de Spider-Man 2?", icon: Trophy },
    { q: "Estratégia pro Malenia (Elden Ring).", icon: Sparkles },
    { q: "Melhores jogos exclusivos do PS5 em 2025.", icon: Gamepad2 },
  ],
  "kera-tradutora": [
    { q: "Traduz esse trecho de livro pro PT-BR.", icon: Languages },
    { q: "Como adaptar gírias americanas em diálogos?", icon: BookOpen },
    { q: "Diferença entre tradução literal e literária.", icon: FileText },
    { q: "Glossário de termos pra série de fantasia.", icon: BookOpen },
  ],
  "kera-familia": [
    { q: "Como funciona partilha em comunhão parcial?", icon: Heart },
    { q: "Pensão alimentícia: como calcular?", icon: Scale },
    { q: "Inventário extrajudicial: passo a passo.", icon: ScrollText },
    { q: "Guarda compartilhada: direitos e deveres.", icon: Baby },
  ],
};

const Chat = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [customAgents, setCustomAgents] = useState<CustomAgent[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [agentKey, setAgentKey] = useState<string>(DEFAULT_AGENT_KEY);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const agentBgVideos = useMemo<Record<string, string>>(() => ({
    "kera": assetUrl(keraBgVideo),
    "kera-dev": assetUrl(keraDevBgVideo),
    "kera-sec": assetUrl(keraSecBgVideo),
    "kera-security-nasa": assetUrl(keraSecurityNasaBgVideo),
    "kera-juridica": assetUrl(keraJuridicaBgVideo),
    "kera-sentinela": assetUrl(keraSentinelaBgVideo),
     "kera-nutri": assetUrl(keraNutriBgVideo),
      "kera-gamer": assetUrl(keraGamerBgVideo),
      "kera-curatela": assetUrl(keraJuridicaBgVideo),
      "kera-familia": assetUrl(keraJuridicaBgVideo),
      "kera-sucessoes": assetUrl(keraJuridicaBgVideo),
      "kera-personalidade": assetUrl(keraJuridicaBgVideo),
    }), []);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [itcmdOpen, setItcmdOpen] = useState(false);
  const [danoMoralOpen, setDanoMoralOpen] = useState(false);
  const [ataNotarialOpen, setAtaNotarialOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [provider, setProvider] = useState<ProviderId>(getPreferredProvider());
  // Modo voz NÃO persiste — sempre começa desligado a cada sessão para evitar
  // que a Kera fale sozinha sem o usuário pedir.
  const [voiceMode, setVoiceMode] = useState<boolean>(false);
  useEffect(() => {
    try { localStorage.removeItem("kera:voiceMode"); } catch {}
  }, []);
  // Texto da última resposta — usado pelo avatar 3D pra detectar emoção e animar boca
  const lastAssistantTextRef = useRef<string>("");
  const [lastAssistantText, setLastAssistantText] = useState<string>("");
  const [hasRemoteTTS, setHasRemoteTTS] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    try { return localStorage.getItem("kera:sidebarOpen") !== "0"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem("kera:sidebarOpen", sidebarOpen ? "1" : "0"); } catch {}
  }, [sidebarOpen]);
  // Expõe a largura da sidebar como CSS var para que elementos fixos (ex.: Footer)
  // possam ficar centralizados em relação à área do chat, e não da viewport inteira.
  useEffect(() => {
    const apply = () => {
      const isDesktop = window.matchMedia("(min-width: 768px)").matches;
      const w = isDesktop && sidebarOpen ? "20rem" : "0px";
      document.documentElement.style.setProperty("--chat-sidebar-w", w);
    };
    apply();
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      document.documentElement.style.removeProperty("--chat-sidebar-w");
    };
  }, [sidebarOpen]);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const handsFreeRef = useRef(false);
  const lastInputViaVoiceRef = useRef(false);

  const voice = useVoice({
    useRemoteTTS: hasRemoteTTS,
    onTranscript: (t) => { lastInputViaVoiceRef.current = true; setInput(t); setTimeout(() => sendText(t), 100); },
  });

  // Modo "sempre escutando" estilo Grok/Hey Google — mic aberto, dispara só quando ouve "Kera"
  const alwaysListen = useAlwaysListening({
    onCommand: (text) => {
      lastInputViaVoiceRef.current = true;
      setInput(text);
      setTimeout(() => sendText(text), 50);
    },
    onError: (msg) => toast.error(msg),
  });

  // Hands-free: quando a Kera termina de falar, reabre o microfone automaticamente
  useEffect(() => {
    if (!handsFreeRef.current) return;
    if (voice.speaking || voice.listening || streaming) return;
    if (!lastInputViaVoiceRef.current) return;
    const t = setTimeout(() => {
      if (handsFreeRef.current && !voice.listening && !voice.speaking) {
        try { voice.startListening(); } catch {}
      }
    }, 600);
    return () => clearTimeout(t);
  }, [voice.speaking, voice.listening, streaming, voice]);

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
    fetch(STATUS_URL).then(r => r.json()).then(s => setHasRemoteTTS(!!(s.tts ?? s.openai ?? s.elevenlabs))).catch(() => {});
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

  const renameConversation = async (id: string, currentTitle: string) => {
    const next = window.prompt("Renomear conversa:", currentTitle);
    if (next == null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === currentTitle) return;
    const { error } = await supabase.from("conversations").update({ title: trimmed.slice(0, 80) }).eq("id", id);
    if (error) return toast.error(error.message);
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: trimmed.slice(0, 80) } : c));
    toast.success("Conversa renomeada");
  };

  const clearEmptyConversations = async () => {
    if (!userId) return;
    // Busca contagem de mensagens por conversa do usuário
    const { data: msgs, error: msgErr } = await supabase
      .from("messages")
      .select("conversation_id")
      .eq("user_id", userId);
    if (msgErr) return toast.error(msgErr.message);
    const withMsgs = new Set((msgs ?? []).map(m => m.conversation_id));
    const emptyIds = conversations
      .filter(c => !withMsgs.has(c.id) && (c.title === "Nova conversa" || c.title.trim() === ""))
      .map(c => c.id);
    if (emptyIds.length === 0) {
      toast.info("Nenhuma conversa vazia para limpar.");
      return;
    }
    const ok = window.confirm(`Excluir ${emptyIds.length} conversa(s) vazia(s)?`);
    if (!ok) return;
    const { error } = await supabase.from("conversations").delete().in("id", emptyIds);
    if (error) return toast.error(error.message);
    setConversations(prev => prev.filter(c => !emptyIds.includes(c.id)));
    if (currentId && emptyIds.includes(currentId)) { setCurrentId(null); setMessages([]); }
    toast.success(`${emptyIds.length} conversa(s) vazia(s) removida(s).`);
  };

  const logout = async () => { await supabase.auth.signOut(); navigate("/auth"); };

  // Auto-prefill via URL: /chat?ask=<frase> → preenche input e envia automaticamente.
  // Usado pelos atalhos da página /desktop ("Status do PC", "Tirar print", etc.).
  // Aguarda userId pra garantir que a sessão está pronta antes de enviar.
  const askFiredRef = useRef(false);
  useEffect(() => {
    if (askFiredRef.current || !userId) return;
    const ask = searchParams.get("ask");
    if (!ask) return;
    askFiredRef.current = true;
    const frase = ask.slice(0, 500);
    setInput(frase);
    // Limpa o ?ask= da URL pra não reenviar em F5
    const next = new URLSearchParams(searchParams);
    next.delete("ask");
    setSearchParams(next, { replace: true });
    // Pequeno delay pra estado/render estabilizar antes de disparar
    setTimeout(() => sendText(frase), 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);


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
      const desktopTools = getAvailableDesktopTools();

      // Histórico enviado à edge function. Pode crescer no loop de tool-calling.
      let history = next.map(m => ({ role: m.role, content: m.content })) as any[];
      const MAX_TOOL_ROUNDS = 5;

      // Loop de tool-calling: enquanto a edge function retornar JSON com tool_calls desktop,
      // executamos no Electron e reenviamos. Na última iteração (sem tool_calls) vem o stream.
      let round = 0;
      while (round < MAX_TOOL_ROUNDS) {
        round++;
        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(sess.session ? { Authorization: `Bearer ${sess.session.access_token}` } : {}),
          },
          body: JSON.stringify({
            messages: history,
            provider: provider === "auto" ? undefined : provider,
            systemPrompt: resolveSystemPrompt(agentKey),
            agentKey,
            desktopTools: desktopTools ?? undefined,
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

        // Resposta JSON (não stream) = tool_calls desktop pra executar no Electron.
        const ctype = resp.headers.get("content-type") || "";
        if (ctype.includes("application/json")) {
          const payload = await resp.json();
          if (payload?.kind === "desktop_tool_calls") {
            const { assistant_message, desktop_tool_calls, server_tool_results } = payload;
            // Mostra na bolha "Usando ferramentas: …" pra o usuário saber o que tá rolando.
            const toolNames = (desktop_tool_calls as any[]).map((c) => c.name).join(", ");
            setMessages(prev => {
              const copy = [...prev];
              copy[copy.length - 1] = {
                role: "assistant",
                content: `🔧 Usando: ${toolNames}…`,
              };
              return copy;
            });

            // Executa cada tool desktop (cada uma pode abrir diálogo nativo de confirmação)
            const desktopResults: Array<{ role: string; tool_call_id: string; content: string }> = [];
            for (const call of desktop_tool_calls as any[]) {
              const result = await executeDesktopTool(call.name, call.arguments || {});
              desktopResults.push({ role: "tool", tool_call_id: call.id, content: result });
            }

            // Monta histórico pro próximo round: assistant (com tool_calls) + todos os tool results
            history = [
              ...history,
              assistant_message,
              ...(server_tool_results ?? []),
              ...desktopResults,
            ];
            continue; // próxima iteração — edge function vai gerar resposta final (stream)
          }
          // JSON sem tool_calls = erro inesperado
          toast.error(payload?.error || "Resposta inesperada");
          setMessages(prev => prev.slice(0, -1));
          setStreaming(false);
          return;
        }

        // Resposta streaming normal — consome SSE até [DONE]
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
        break; // stream consumido — sai do loop de rounds
      }

      if (assistantText) {
        await supabase.from("messages").insert({
          conversation_id: convId, user_id: userId, role: "assistant", content: assistantText,
        });
        await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
        // Atualiza o texto pro avatar 3D detectar emoção / sincronizar boca
        lastAssistantTextRef.current = assistantText;
        setLastAssistantText(assistantText);
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
  const isTradutora = agentKey === "kera-tradutora";

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

  // Agrupa conversas por período (Hoje / Ontem / Anteriores)
  const groupedConversations = (() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const groups: { label: string; items: Conversation[] }[] = [
      { label: "Hoje", items: [] },
      { label: "Ontem", items: [] },
      { label: "Anteriores", items: [] },
    ];
    for (const c of conversations) {
      const t = new Date(c.updated_at).getTime();
      if (t >= startOfToday) groups[0].items.push(c);
      else if (t >= startOfYesterday) groups[1].items.push(c);
      else groups[2].items.push(c);
    }
    return groups.filter(g => g.items.length > 0);
  })();

   const Sidebar = () => (
     <aside className="h-full w-full md:w-80 bg-background/95 backdrop-blur-2xl border-r border-white/5 flex flex-col shadow-2xl">
       {/* Topo: avatar minimalista */}
       <div className="px-6 pt-8 pb-6 flex items-center gap-3">
         <div className="relative group">
           <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
           <div className="relative w-10 h-10 rounded-xl overflow-hidden ring-1 ring-white/10 bg-black/20 flex items-center justify-center">
             <img src={keraLogo} alt="Kera AI" className="w-8 h-8 object-contain transition-transform duration-500 group-hover:scale-110" />
           </div>
         </div>
         <div>
           <span className="font-display text-base font-black tracking-widest text-white/90">KERA</span>
           <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] -mt-1 font-semibold opacity-60">Intelligence</p>
         </div>
       </div>
 
       {/* Ações principais — estilo moderno */}
       <nav className="px-4 space-y-1">
         <button
           onClick={() => newConversation()}
           className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all duration-300 text-sm font-semibold group"
         >
           <Plus className="size-4 transition-transform group-hover:rotate-90" />
           <span>Novo Chat</span>
         </button>
         <div className="grid grid-cols-2 gap-1 pt-1">
           <button
             onClick={() => navigate("/agents")}
             className="flex items-center justify-center gap-2 py-2.5 rounded-xl hover:bg-white/5 transition-all text-xs font-medium text-muted-foreground hover:text-white"
           >
             <LayoutGrid className="size-3.5" />
             <span>Agentes</span>
           </button>
           <button
             onClick={() => setGalleryOpen(true)}
             className="flex items-center justify-center gap-2 py-2.5 rounded-xl hover:bg-white/5 transition-all text-xs font-medium text-muted-foreground hover:text-white"
           >
             <ImageIcon className="size-3.5" />
             <span>Galeria</span>
           </button>
         </div>
       </nav>

      <ScrollArea className="flex-1">

        {/* Histórico agrupado */}
         <div className="px-4 pt-6 pb-6">
           <div className="flex items-center justify-between px-3 mb-4">
             <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">Histórico</h3>
             {conversations.length > 0 && (
               <button
                 onClick={clearEmptyConversations}
                 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 hover:text-primary transition-colors flex items-center gap-1.5 group"
                 title="Excluir conversas vazias"
               >
                 <Eraser className="size-3 transition-transform group-hover:-rotate-12" />
                 Limpar
               </button>
             )}
           </div>
           {groupedConversations.length === 0 && (
             <p className="text-[11px] text-muted-foreground/30 text-center py-8 font-medium">O silêncio é uma tela em branco.</p>
           )}
           {groupedConversations.map(group => (
             <div key={group.label} className="mt-4">
               <div className="text-[10px] font-bold uppercase tracking-widest text-primary/40 px-3 mb-2 flex items-center gap-2">
                 <span className="w-1 h-1 rounded-full bg-primary/40 block" />
                 {group.label}
               </div>
               <div className="space-y-0.5">
                 {group.items.map(c => (
                   <div
                     key={c.id}
                     className={`group relative flex items-start gap-3 rounded-xl px-4 py-2.5 text-xs font-medium cursor-pointer transition-all duration-300 ${
                       currentId === c.id 
                         ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20" 
                         : "hover:bg-white/5 text-muted-foreground hover:text-white"
                     }`}
                     onClick={() => selectConversation(c.id, c.agent_key)}
                   >
                     <span className="flex-1 min-w-0 leading-relaxed line-clamp-1">{c.title || "Sem título"}</span>
                     <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button
                         onClick={(e) => { e.stopPropagation(); renameConversation(c.id, c.title); }}
                         className="p-1 text-muted-foreground/50 hover:text-primary hover:bg-primary/10 rounded-md transition-all"
                         aria-label="Renomear"
                       >
                         <Pencil className="size-3" />
                       </button>
                       <button
                         onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                         className="p-1 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-md transition-all"
                         aria-label="Excluir"
                       >
                         <Trash2 className="size-3" />
                       </button>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           ))}
         </div>
      </ScrollArea>

      <div className="p-3 border-t border-border space-y-1">
        {typeof window !== "undefined" && (window as unknown as { kera?: { isDesktop: boolean } }).kera?.isDesktop && (
          <Button variant="ghost" onClick={() => navigate("/desktop")} className="w-full justify-start text-primary hover:text-primary">
            <Monitor className="size-4 mr-2" /> Kera Desktop (PC)
          </Button>
        )}
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
      <div
        className={`hidden md:flex transition-all duration-300 ease-in-out overflow-hidden ${
          sidebarOpen ? "w-80 opacity-100" : "w-0 opacity-0 pointer-events-none"
        }`}
      >
        <Sidebar />
      </div>
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
        {agentBgVideos[agentKey] && (
          <div
            key={agentKey}
            className="absolute inset-0 z-0 overflow-hidden pointer-events-none animate-[fade-in_800ms_ease-out]"
          >
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover opacity-45 mix-blend-screen [.light_&]:opacity-100 [.light_&]:mix-blend-normal [.light_&]:[filter:brightness(0.9)_contrast(1.1)]"
            >
                <source src={agentBgVideos[agentKey]} type="video/mp4" />
            </video>
            {/* Overlay padrão (modo escuro) */}
            <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/35 to-background/75 [.light_&]:hidden" />
            {/* Overlay leitoso modo claro: branco translúcido top/bottom, transparente no centro */}
            <div className="absolute inset-0 hidden [.light_&]:block [.light_&]:bg-[linear-gradient(to_bottom,hsl(var(--background)/0.55)_0%,transparent_45%,transparent_55%,hsl(var(--background)/0.55)_100%)] pointer-events-none" />
          </div>
        )}

        {dragging && (
          <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center bg-primary/10 backdrop-blur-sm border-4 border-dashed border-primary rounded-lg m-2">
            <div className="text-center">
              <Paperclip className="size-12 mx-auto text-primary animate-pulse" />
              <p className="mt-3 font-display text-xl text-glow text-primary">Solte aqui para anexar</p>
              <p className="text-xs text-muted-foreground mt-1">Imagens, prints ou arquivos de texto/código</p>
            </div>
          </div>
        )}
         <header className="relative z-40 h-16 md:h-20 border-b border-white/5 bg-background/40 backdrop-blur-xl flex items-center px-4 md:px-8 gap-3 md:gap-4 overflow-hidden transition-all duration-300 shadow-sm">
           {/* Botão para ocultar/mostrar a sidebar (desktop) */}
           <Button
             variant="ghost"
             size="icon"
             className="hidden md:inline-flex shrink-0 h-10 w-10 hover:bg-white/5 rounded-xl transition-all active:scale-95"
             onClick={() => setSidebarOpen((v) => !v)}
             aria-label={sidebarOpen ? "Ocultar menu lateral" : "Mostrar menu lateral"}
           >
             {sidebarOpen ? <PanelLeftClose className="size-5.5" /> : <PanelLeftOpen className="size-5.5" />}
           </Button>
           <Sheet>
             <SheetTrigger asChild>
               <Button variant="ghost" size="icon" className="md:hidden shrink-0 h-10 w-10 hover:bg-white/5 rounded-xl"><Menu className="size-5.5" /></Button>
             </SheetTrigger>
             <SheetContent side="left" className="p-0 w-80 bg-background/95 backdrop-blur-2xl border-r border-white/5 shadow-2xl"><Sidebar /></SheetContent>
           </Sheet>
 
           <div className="h-8 w-px bg-white/10 hidden md:block mx-1" />
 
           <DropdownMenu>
             <DropdownMenuTrigger asChild>
               <button className="flex items-center gap-2.5 hover:bg-white/5 px-3 py-1.5 rounded-xl transition-all min-w-0 group">
                 <div className="relative">
                   <span className="size-2.5 rounded-full bg-primary shadow-glow animate-pulse-glow block" />
                   <span className="absolute inset-0 size-2.5 rounded-full bg-primary animate-ping opacity-20" />
                 </div>
                 <h1 className="font-display text-sm md:text-base font-bold tracking-wider text-glow truncate group-hover:text-primary transition-colors">{currentAgentName.toUpperCase()}</h1>
                 <ChevronRight className="size-4 rotate-90 text-muted-foreground opacity-50 group-hover:opacity-100 transition-all shrink-0" />
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
            onClick={handleExportPdf}
            aria-label="Exportar conversa em PDF"
            title="Exportar PDF"
            disabled={!messages.length || streaming}
            className="text-muted-foreground hover:text-primary shrink-0 h-9 w-9"
          >
            <Download className="size-5" />
          </Button>

          <div className="ml-auto flex items-center gap-1.5 md:gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost" size="icon"
                  aria-label="Trocar tema"
                  title={`Tema: ${theme === "dark" ? "Escuro" : theme === "light" ? "Claro" : theme === "kera" ? "Kera Mode" : "Kera Premium"}`}
                  className="text-muted-foreground hover:text-primary shrink-0 h-9 w-9"
                >
                  {theme === "dark" && <Moon className="size-5" />}
                  {theme === "light" && <Sun className="size-5" />}
                  {theme === "kera" && <Sparkles className="size-5 text-primary" />}
                  {theme === "kera-premium" && <Gem className="size-5 text-primary" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Tema</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTheme("dark")} className="gap-2">
                  <Moon className="size-4" /> Escuro {theme === "dark" && <span className="ml-auto text-primary">●</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("light")} className="gap-2">
                  <Sun className="size-4" /> Claro {theme === "light" && <span className="ml-auto text-primary">●</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("kera")} className="gap-2">
                  <Sparkles className="size-4" /> Kera Mode {theme === "kera" && <span className="ml-auto text-primary">●</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("kera-premium")} className="gap-2">
                  <Gem className="size-4" /> Kera Premium {theme === "kera-premium" && <span className="ml-auto text-primary">●</span>}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Select value={provider} onValueChange={(v) => { setProvider(v as ProviderId); setPreferredProvider(v as ProviderId); }}>
              <SelectTrigger className="h-8 w-[92px] sm:w-[140px] md:w-[180px] text-xs bg-input/40 border-border px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map(p => (<SelectItem key={p.id} value={p.id} className="text-xs">{p.label}</SelectItem>))}
              </SelectContent>
            </Select>
            {agentKey === "kera-sucessoes" && (
              <Button
                variant="ghost" size="icon"
                onClick={() => setItcmdOpen(true)}
                aria-label="Calculadora ITCMD/SC"
                title="Calculadora ITCMD/SC (Lei 13.136/2004)"
                className="text-yellow-500 hover:text-yellow-400 shrink-0 h-9 w-9"
              >
                <Calculator className="size-5" />
              </Button>
            )}
            {agentKey === "kera-personalidade" && (
              <Button
                variant="ghost" size="icon"
                onClick={() => setDanoMoralOpen(true)}
                aria-label="Calculadora de Dano Moral"
                title="Calculadora de Dano Moral — Método Bifásico STJ (REsp 1.152.541/RS)"
                className="text-rose-400 hover:text-rose-300 shrink-0 h-9 w-9"
              >
                <Scale className="size-5" />
              </Button>
            )}
            {agentKey === "kera-personalidade" && (
              <Button
                variant="ghost" size="icon"
                onClick={() => setAtaNotarialOpen(true)}
                aria-label="Gerar Ata Notarial"
                title="Gerar Ata Notarial — Provimento 100/CNJ"
                className="text-rose-400 hover:text-rose-300 shrink-0 h-9 w-9"
              >
                <FileText className="size-5" />
              </Button>
            )}
            <Button
              variant="ghost" size="icon"
              onClick={() => {
                const next = !voiceMode;
                setVoiceMode(next);
                try { localStorage.setItem("kera:voiceMode", next ? "1" : "0"); } catch {}
                if (next) {
                  voice.warmUpTTS();
                  toast.success("Modo voz ativado — Kera vai falar as respostas");
                } else {
                  voice.stopSpeaking();
                }
              }}
              aria-label="Modo voz"
              className={`shrink-0 h-9 w-9 ${voiceMode ? "text-primary" : ""}`}
            >
              {voiceMode ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            </Button>
          </div>
        </header>

        {/* Sub-seletor de ÁREA JURÍDICA — só quando o agente atual é uma das Keras jurídicas */}
        {(() => {
          const JURIDICOS = [
            { key: "kera-juridica",     label: "Geral",         Icon: Scale,         color: "text-purple-400", ring: "ring-purple-400/60" },
            { key: "kera-familia",      label: "Família",       Icon: Heart,         color: "text-pink-400",   ring: "ring-pink-400/60" },
            { key: "kera-sucessoes",    label: "Sucessões",     Icon: ScrollText,    color: "text-yellow-500", ring: "ring-yellow-500/60" },
            { key: "kera-personalidade",label: "Personalidade", Icon: UserCheck,     color: "text-rose-400",   ring: "ring-rose-400/60" },
            { key: "kera-curatela",     label: "Curatela",      Icon: Accessibility, color: "text-cyan-400",   ring: "ring-cyan-400/60" },
          ];
          const isJuridico = JURIDICOS.some(j => j.key === agentKey);
          if (!isJuridico) return null;
          return (
            <div className="relative z-10 border-b border-border bg-background/40 backdrop-blur-sm">
              <div className="max-w-6xl mx-auto px-4 md:px-10 py-2 flex items-center gap-2 overflow-x-auto scrollbar-thin">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground shrink-0 mr-1">Área:</span>
                {JURIDICOS.map(({ key, label, Icon, color, ring }) => {
                  const active = agentKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (key === agentKey) return;
                        setAgentKey(key);
                        newConversation(key);
                      }}
                      title={`Trocar para ${label}`}
                      className={`flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1 text-xs transition ${
                        active
                          ? `bg-secondary border-border ring-2 ${ring} text-foreground`
                          : "bg-transparent border-border/60 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                      }`}
                    >
                      <Icon className={`size-3.5 ${color}`} />
                      <span className="font-medium">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

         <div ref={scrollerRef} className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin pb-32">
           <div className="max-w-5xl mx-auto px-6 md:px-10 py-10 md:py-16 space-y-8 [.light_&]:[text-shadow:0_1px_2px_hsl(var(--background)/0.8)]">
             {messages.length === 0 && !streaming && (
               <div className="text-center animate-in fade-in zoom-in-95 duration-1000">
                 <div className="relative group inline-block">
                   <div className="absolute inset-0 bg-primary/20 blur-[60px] animate-pulse rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                   <video
                     src={assetUrl(keraAvatarVideo)}
                     poster={keraAvatar}
                     autoPlay
                     loop
                     muted
                     playsInline
                     aria-label="Avatar animado da Kera"
                     className="size-32 md:size-48 mx-auto rounded-[2.5rem] object-cover object-top border border-white/10 shadow-glow bg-black/40 backdrop-blur-md transform transition-transform duration-500 group-hover:scale-105"
                   />
                 </div>
                 <h2 className="font-display text-3xl md:text-5xl mt-10 font-black tracking-tighter uppercase leading-tight">
                   Olá, eu sou a <span className="kera-gradient-text">{currentAgentName}</span>
                 </h2>
                 <p className="text-sm md:text-lg text-muted-foreground mt-4 max-w-lg mx-auto font-medium opacity-80 leading-relaxed">
                   {currentAgent && "description" in currentAgent ? currentAgent.description : "Sua assistente de inteligência avançada. Em que posso ser útil hoje?"}
                 </p>
 
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl mx-auto mt-12 px-4">
                    {(AGENT_SUGGESTIONS[agentKey] ?? AGENT_SUGGESTIONS.kera).map(({ q, icon: Icon }) => (
                      <button
                        key={q}
                        onClick={() => { setInput(q); setTimeout(() => sendText(q), 50); }}
                        className="flex items-center gap-4 text-left px-6 py-4.5 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 group shadow-sm active:scale-95"
                      >
                       <div className="size-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors shadow-inner">
                         <Icon className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                       </div>
                       <span className="text-muted-foreground group-hover:text-foreground transition-colors font-semibold text-sm">{q}</span>
                     </button>
                   ))}
                 </div>
               </div>
             )}
             {messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              return (
                <MessageBubble
                  key={m.id ?? i}
                  msg={m}
                  streaming={streaming && isLast && m.role === "assistant"}
                  onSpeak={(t) => {
                    voice.warmUpTTS();
                    if (voice.pendingPlay) {
                      void voice.resumePendingPlay();
                      return;
                    }
                    void voice.speak(t);
                  }}
                  onStopSpeak={voice.stopSpeaking}
                  isSpeaking={voice.speaking && isLast && m.role === "assistant"}
                  showSwitchToKera={agentKey !== DEFAULT_AGENT_KEY}
                  onSwitchToKera={async () => {
                    // Mantém a conversa atual — só troca o agente, pra Kera continuar de onde parou
                    setAgentKey(DEFAULT_AGENT_KEY);
                    if (currentId) {
                      const { error } = await supabase
                        .from("conversations")
                        .update({ agent_key: DEFAULT_AGENT_KEY })
                        .eq("id", currentId);
                      if (error) {
                        toast.error("Não rolou trocar de agente: " + error.message);
                        return;
                      }
                      setConversations(prev =>
                        prev.map(c => (c.id === currentId ? { ...c, agent_key: DEFAULT_AGENT_KEY } : c))
                      );
                    }
                    toast.success("Kera assumiu — continua mandando que ela pega o fio da meada");
                  }}
                />
              );
            })}
          </div>
        </div>

        <div className="relative z-10 border-t border-border panel p-3 md:p-4 pb-28 md:pb-32">
          <div className="max-w-6xl mx-auto space-y-2">
             {isSentinela && (
               <div className="flex flex-wrap justify-center gap-3 animate-in slide-in-from-bottom-2 duration-500">
                 <Button
                   onClick={runSentinelaCheck}
                   disabled={streaming}
                   variant="outline"
                   size="sm"
                   className="h-9 px-4 rounded-xl border-emerald-500/30 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/15 hover:border-emerald-500/50 hover:text-emerald-300 gap-2.5 shadow-sm active:scale-95 transition-all"
                 >
                   <ShieldCheck className="size-4" />
                   <span className="text-xs font-bold uppercase tracking-wider">Monitor Sentinela</span>
                 </Button>
                 <Button
                   onClick={runNetworkTrace}
                   disabled={streaming}
                   variant="outline"
                   size="sm"
                   className="h-9 px-4 rounded-xl border-cyan-500/30 text-cyan-400 bg-cyan-500/5 hover:bg-cyan-500/15 hover:border-cyan-500/50 hover:text-cyan-300 gap-2.5 shadow-sm active:scale-95 transition-all"
                 >
                   <Activity className="size-4" />
                   <span className="text-xs font-bold uppercase tracking-wider">Trace de Rede</span>
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
            <div
              className={`group relative rounded-2xl border bg-input/30 backdrop-blur-sm transition-all
                ${streaming ? "border-primary/30" : "border-border/60 hover:border-border focus-within:border-primary/60 focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]"}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.txt,.md,.json,.csv,.log,.yml,.yaml,.html,.xml,.css,.js,.jsx,.ts,.tsx,.py,.sql,.env,.sh"
                className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
              />

              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                onPaste={onPaste}
                placeholder={
                  alwaysListen.status === "heard-wake"
                    ? "✨ Captou! processando..."
                    : alwaysListen.status === "listening"
                      ? `👂 Escutando... diga "Kera"${alwaysListen.partial ? ` — "${alwaysListen.partial}"` : ""}`
                      : voice.listening
                        ? "Ouvindo..."
                        : `Pergunte algo à ${currentAgentName}...`
                }
                rows={1}
                className="resize-none min-h-[56px] max-h-44 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-4 pt-3.5 pb-12 text-base md:text-sm placeholder:text-muted-foreground/60"
              />

              {/* Toolbar inferior: ações à esquerda, enviar à direita */}
              <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 pointer-events-none">
                <div className="flex items-center gap-0.5 pointer-events-auto">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    aria-label="Anexar arquivo"
                    disabled={streaming}
                  >
                    <Paperclip className="size-4" />
                  </Button>
                  <Button
                    onClick={() => cameraInputRef.current?.click()}
                    variant="ghost"
                    size="icon"
                    className="md:hidden h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    aria-label="Tirar foto com a câmera"
                    title="Tirar foto"
                    disabled={streaming}
                  >
                    <Camera className="size-4" />
                  </Button>
                  <Button
                    onClick={() => {
                      if (alwaysListen.isActive) {
                        alwaysListen.stop();
                        handsFreeRef.current = false;
                      } else {
                        if (!voiceMode) {
                          setVoiceMode(true);
                          try { localStorage.setItem("kera:voiceMode", "1"); } catch {}
                          voice.warmUpTTS();
                        }
                        alwaysListen.start();
                      }
                    }}
                    variant="ghost"
                    size="icon"
                    className={`h-9 w-9 rounded-full transition ${
                      alwaysListen.status === "heard-wake"
                        ? "bg-primary text-primary-foreground animate-pulse shadow-glow"
                        : alwaysListen.status === "listening"
                          ? "bg-accent/30 text-accent-foreground"
                          : alwaysListen.status === "connecting"
                            ? "opacity-70"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                    aria-label="Modo sempre escutando"
                    title="Modo sempre escutando — diga &quot;Kera&quot; pra ativar"
                    disabled={alwaysListen.status === "connecting"}
                  >
                    <Ear className="size-4" />
                  </Button>
                  <Button
                    onClick={() => {
                      if (voice.listening) {
                        handsFreeRef.current = false;
                        lastInputViaVoiceRef.current = false;
                        voice.stopListening();
                        voice.stopSpeaking();
                      } else {
                        if (!voiceMode) {
                          setVoiceMode(true);
                          try { localStorage.setItem("kera:voiceMode", "1"); } catch {}
                          voice.warmUpTTS();
                        }
                        handsFreeRef.current = true;
                        voice.startListening();
                      }
                    }}
                    variant="ghost"
                    size="icon"
                    className={`h-9 w-9 rounded-full transition ${
                      voice.listening
                        ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground animate-pulse"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                    aria-label="Falar"
                  >
                    {voice.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  </Button>
                </div>

                <Button
                  onClick={() => sendText()}
                  disabled={(!input.trim() && attachments.length === 0) || streaming}
                  size="icon"
                  className="pointer-events-auto h-9 w-9 rounded-full bg-gradient-cyber text-primary-foreground shadow-glow hover:opacity-90 disabled:opacity-40 disabled:shadow-none transition"
                  aria-label="Enviar mensagem"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </div>
          {(alwaysListen.isActive || voiceMode) && (
            <div className="flex justify-center mt-2">
              <p className="text-[11px] text-muted-foreground/90 text-center px-3 py-1 rounded-full bg-background/60 backdrop-blur-sm border border-border/40">
                {alwaysListen.isActive
                  ? '👂 Modo sempre escutando ativo — diga "Kera" + sua pergunta'
                  : "🔊 Modo voz ativo — respostas serão faladas"}
              </p>
            </div>
          )}
        </div>
      </div>
      {voiceMode && (
        <VoiceStatusIndicator
          listening={voice.listening}
          thinking={streaming && !voice.speaking}
          speaking={voice.speaking}
        />
      )}
      <GalleryDialog open={galleryOpen} onOpenChange={setGalleryOpen} userId={userId} />
      <ItcmdSCCalculator
        open={itcmdOpen}
        onOpenChange={setItcmdOpen}
        onSendToChat={(r: ItcmdResult) => {
          // Garante que o agente Kera Sucessões receba o cálculo
          if (agentKey !== "kera-sucessoes") setAgentKey("kera-sucessoes");
          setInput(r.markdown);
          setTimeout(() => sendText(r.markdown), 80);
          toast.success(`Cálculo enviado — ITCMD total estimado: ${r.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
        }}
      />
      <DanoMoralCalculator
        open={danoMoralOpen}
        onOpenChange={setDanoMoralOpen}
        onSendToChat={(r: DanoMoralResult) => {
          if (agentKey !== "kera-personalidade") setAgentKey("kera-personalidade");
          setInput(r.markdown);
          setTimeout(() => sendText(r.markdown), 80);
          toast.success(`Cálculo enviado — Dano moral sugerido: ${r.valorFinal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
        }}
      />
      <AtaNotarialGenerator
        open={ataNotarialOpen}
        onOpenChange={setAtaNotarialOpen}
        onSendToChat={(r: AtaNotarialResult) => {
          if (agentKey !== "kera-personalidade") setAgentKey("kera-personalidade");
          setInput(r.markdown);
          setTimeout(() => sendText(r.markdown), 80);
          toast.success("Minuta de ata notarial enviada pra Kera Personalidade revisar");
        }}
      />
    </div>
  );
};

export default Chat;
