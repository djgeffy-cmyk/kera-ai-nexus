import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, FolderOpen, Power, RotateCcw, Moon, Lock, FileText, Trash2, Save, RefreshCw,
  Monitor, ShieldCheck, Plus, X, ClipboardCopy, ClipboardPaste, Camera, Terminal, Rocket, Cpu, Globe, Download,
  Sparkles, MessageSquare, Apple,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  isKeraDesktop, getKera,
  type KeraFsEntry, type KeraPlatformInfo, type KeraSystemStatus, type KeraExecResult,
} from "@/lib/keraDesktop";

const KeraDesktopPage = () => {
  const navigate = useNavigate();
  const [info, setInfo] = useState<KeraPlatformInfo | null>(null);
  const [cwd, setCwd] = useState<string>("");
  const [entries, setEntries] = useState<KeraFsEntry[]>([]);
  const [selected, setSelected] = useState<KeraFsEntry | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const desktop = isKeraDesktop();

  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [clip, setClip] = useState("");
  const [shot, setShot] = useState<string | null>(null);
  const [sysStatus, setSysStatus] = useState<KeraSystemStatus | null>(null);
  const [openTarget, setOpenTarget] = useState("");
  const [appName, setAppName] = useState("");
  const [cmd, setCmd] = useState("");
  const [execResult, setExecResult] = useState<KeraExecResult | null>(null);
  const [updateStatus, setUpdateStatus] = useState<{ state: string; version?: string; percent?: number; message?: string } | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [videosStatus, setVideosStatus] = useState<{ cached: string[]; missing: string[]; total: number; dir: string } | null>(null);
  const [videosDownloading, setVideosDownloading] = useState(false);
  const [videosProgress, setVideosProgress] = useState<{ name: string; received: number; total: number } | null>(null);
  const [mascotVisible, setMascotVisible] = useState(false);

  useEffect(() => {
    const k = getKera();
    if (!k) return;
    const off = k.update.onStatus((payload) => setUpdateStatus(payload));
    const offV = k.videos.onProgress((p) => setVideosProgress(p));
    k.videos.status().then((s) =>
      setVideosStatus({ cached: s.cached, missing: s.missing, total: s.total, dir: s.dir }),
    ).catch(() => undefined);
    k.mascot?.status().then((s) => setMascotVisible(s.visible)).catch(() => undefined);
    return () => { off?.(); offV?.(); };
  }, []);

  const checkUpdate = async () => {
    const k = getKera(); if (!k) return;
    setCheckingUpdate(true);
    setUpdateStatus({ state: "checking" });
    try {
      const r = await k.update.check();
      if (r.skipped) {
        toast.info(`Auto-update desativado (${r.reason || "modo dev"})`);
        setUpdateStatus({ state: "skipped", message: r.reason });
      } else if (!r.ok) {
        toast.error(r.error || "Falha ao verificar");
      } else if (r.updateInfo?.version) {
        toast.success(`Atualização disponível: v${r.updateInfo.version}`);
      } else {
        toast.success("Você está na versão mais recente");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao verificar");
    } finally {
      setCheckingUpdate(false);
    }
  };

  const installUpdate = async () => {
    const k = getKera(); if (!k) return;
    await k.update.install();
  };

  const refreshVideos = async () => {
    const k = getKera(); if (!k) return;
    const s = await k.videos.status();
    setVideosStatus({ cached: s.cached, missing: s.missing, total: s.total, dir: s.dir });
  };

  const downloadVideos = async () => {
    const k = getKera(); if (!k) return;
    setVideosDownloading(true);
    setVideosProgress(null);
    try {
      const r = await k.videos.download();
      if (r.ok) toast.success("Vídeos baixados! Modo offline ativo.");
      else toast.error(`Falha em ${r.errors.length} vídeo(s): ${r.errors[0]?.error || ""}`);
      // Recarrega para o assetUrl pegar o cache novo (mais simples e seguro).
      await refreshVideos();
      setTimeout(() => window.location.reload(), 600);
    } finally {
      setVideosDownloading(false);
      setVideosProgress(null);
    }
  };

  const clearVideos = async () => {
    const k = getKera(); if (!k) return;
    if (!confirm("Apagar vídeos baixados? Eles voltarão a carregar pela internet.")) return;
    await k.videos.clear();
    await refreshVideos();
    toast.success("Cache de vídeos apagado.");
    setTimeout(() => window.location.reload(), 400);
  };

  const refreshAllowlist = async () => {
    const k = getKera();
    if (!k) return;
    setAllowlist(await k.allowlist.get());
  };

  useEffect(() => {
    const k = getKera();
    if (!k) return;
    k.platform().then(setInfo);
    refreshAllowlist();
  }, []);

  useEffect(() => {
    if (cwd) load(cwd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd]);

  const load = async (p: string) => {
    const k = getKera();
    if (!k) return;
    setLoading(true);
    try {
      const list = await k.fs.list(p);
      setEntries(list.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao listar");
    } finally {
      setLoading(false);
    }
  };

  const openFile = async (e: KeraFsEntry) => {
    const k = getKera();
    if (!k) return;
    if (e.isDir) {
      setCwd(e.path);
      setSelected(null);
      setContent("");
      return;
    }
    try {
      const data = await k.fs.read(e.path);
      setSelected(e);
      setContent(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao abrir");
    }
  };

  const save = async () => {
    const k = getKera();
    if (!k || !selected) return;
    try {
      await k.fs.write(selected.path, content);
      toast.success("Arquivo salvo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  };

  const del = async () => {
    const k = getKera();
    if (!k || !selected) return;
    const r = await k.fs.delete(selected.path);
    if (r.cancelled) return;
    if (r.ok) {
      toast.success("Excluído");
      setSelected(null);
      setContent("");
      load(cwd);
    }
  };

  const pickFolder = async () => {
    const k = getKera();
    if (!k) return;
    const f = await k.fs.pickFolder();
    if (f) setCwd(f);
  };

  const addAllowed = async () => {
    const k = getKera();
    if (!k) return;
    const r = await k.allowlist.add();
    if (r.cancelled) return;
    if (r.ok) {
      toast.success("Pasta autorizada");
      await refreshAllowlist();
    }
  };

  const removeAllowed = async (folder: string) => {
    const k = getKera();
    if (!k) return;
    const r = await k.allowlist.remove(folder);
    setAllowlist(r.list);
    if (cwd === folder) {
      setCwd("");
      setEntries([]);
      setSelected(null);
      setContent("");
    }
    toast.success("Pasta removida");
  };

  const readClip = async () => {
    const k = getKera(); if (!k) return;
    const t = await k.clipboard.read();
    setClip(t);
    toast.success("Clipboard lido");
  };
  const writeClip = async () => {
    const k = getKera(); if (!k) return;
    await k.clipboard.write(clip);
    toast.success("Copiado para a área de transferência");
  };

  const takeShot = async () => {
    const k = getKera(); if (!k) return;
    const r = await k.screenshot();
    if (r.cancelled) return;
    if (r.ok && r.dataUrl) { setShot(r.dataUrl); toast.success("Captura feita"); }
    else toast.error(r.error || "Falha ao capturar");
  };

  const loadStatus = async () => {
    const k = getKera(); if (!k) return;
    setSysStatus(await k.system.status());
  };

  const openPath = async () => {
    const k = getKera(); if (!k || !openTarget.trim()) return;
    const r = await k.open.path(openTarget.trim());
    if (r.cancelled) return;
    if (r.ok) toast.success("Abrindo…");
    else toast.error(r.error || "Falha ao abrir");
  };

  const openApp = async () => {
    const k = getKera(); if (!k || !appName.trim()) return;
    const r = await k.open.app(appName.trim());
    if (r.cancelled) return;
    if (r.ok) toast.success(`Abrindo ${appName}`);
    else toast.error(r.error || "Falha ao abrir");
  };

  const runCmd = async () => {
    const k = getKera(); if (!k || !cmd.trim()) return;
    setExecResult(null);
    const r = await k.exec(cmd);
    setExecResult(r);
    if (r.cancelled) return;
    if (r.ok) toast.success("Comando executado");
    else toast.error(r.error || "Falha no comando");
  };

  const power = async (kind: "shutdown" | "restart" | "hibernate" | "lock") => {
    const k = getKera();
    if (!k) return;
    const r = await k.power[kind]();
    if (r.cancelled) return;
    if (r.ok) toast.success(`Comando enviado: ${kind}`);
    else toast.error(r.error || "Falha");
  };

  if (!desktop) {
    // Releases publicados pelo electron-builder no GitHub. A URL "latest/download"
    // sempre redireciona para o último release publicado — não precisa atualizar
    // a versão aqui quando sair uma nova build.
    const GH_OWNER = "djgeffy-cmyk";
    const GH_REPO = "kera-ai-nexus";
    const releasesBase = `https://github.com/${GH_OWNER}/${GH_REPO}/releases/latest/download`;
    const downloads = [
      {
        os: "Windows",
        icon: Monitor,
        // Nome definido em electron-builder.config.cjs (win.artifactName)
        // KeraDesktop-Setup-${version}.exe — usamos a tag /releases/latest e
        // listamos pelo padrão. Como o nome inclui versão, apontamos para a
        // página de releases para o usuário pegar o .exe.
        href: `https://github.com/${GH_OWNER}/${GH_REPO}/releases/latest`,
        ext: ".exe",
        hint: "Windows 10/11",
      },
      {
        os: "macOS",
        icon: Apple,
        href: `https://github.com/${GH_OWNER}/${GH_REPO}/releases/latest`,
        ext: ".dmg",
        hint: "Intel & Apple Silicon",
      },
      {
        os: "Linux",
        icon: Terminal,
        href: `https://github.com/${GH_OWNER}/${GH_REPO}/releases/latest`,
        ext: ".AppImage",
        hint: "Ubuntu, Fedora, Arch…",
      },
    ];

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
        <div className="w-full max-w-2xl space-y-4">
          <Card className="p-8 space-y-4 text-center">
            <Monitor className="size-12 mx-auto text-primary" />
            <h1 className="text-2xl font-display text-glow">Kera Desktop</h1>
            <p className="text-muted-foreground">
              Esta página só funciona quando você abre a Kera pelo <strong>app desktop</strong>{" "}
              (Windows/Mac/Linux). No navegador, o acesso ao sistema do PC é bloqueado.
            </p>
            <Link to="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="size-4" /> Voltar ao chat
              </Button>
            </Link>
          </Card>

          {/* DOWNLOADS — instaladores diretos do GitHub Releases */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Download className="size-4 text-primary" />
              <h2 className="text-sm uppercase tracking-wider text-muted-foreground">
                Baixar instalador
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Escolha seu sistema. Você será levado à página da última versão publicada no GitHub —
              baixe o arquivo correspondente e abra para instalar.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {downloads.map((d) => {
                const Icon = d.icon;
                return (
                  <a
                    key={d.os}
                    href={d.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary/60 hover:bg-primary/5 transition-all"
                  >
                    <Icon className="size-8 text-primary group-hover:scale-110 transition-transform" />
                    <div className="text-sm font-semibold text-foreground">{d.os}</div>
                    <div className="text-[11px] text-muted-foreground">{d.hint}</div>
                    <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary font-mono">
                      <Download className="size-3" />
                      {d.ext}
                    </div>
                  </a>
                );
              })}
            </div>
            <div className="text-[11px] text-muted-foreground/70 italic border-t border-border/50 pt-2">
              ⚠️ macOS e Windows podem mostrar aviso de "desenvolvedor não verificado" no primeiro
              uso. É normal — o app é assinado pelo nosso domínio mas não tem certificado pago de
              loja oficial. Em macOS: <em>Configurações → Privacidade & Segurança → Abrir mesmo assim</em>.
              Em Windows: <em>Mais informações → Executar mesmo assim</em>.
            </div>
          </Card>

          {/* ATUALIZAÇÕES — preview desabilitado no navegador */}
          <Card className="p-4 space-y-3 opacity-70">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Download className="size-4 text-primary" />
                <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Atualizações</h2>
              </div>
              <Button size="sm" variant="outline" className="gap-2" disabled>
                <RefreshCw className="size-4" /> Verificar atualizações
              </Button>
            </div>
            <div className="text-xs px-3 py-2 rounded-md bg-secondary/40 text-muted-foreground italic">
              Disponível apenas no Kera Desktop. Abra o app instalado para verificar e instalar atualizações automaticamente.
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="size-4" /> Chat
              </Button>
            </Link>
            <h1 className="font-display text-xl md:text-2xl text-glow">Kera Desktop</h1>
          </div>
          {info && (
            <div className="text-xs text-muted-foreground">
              {info.platform} · {info.arch} · {info.hostname}
            </div>
          )}
        </div>

        {/* EXEMPLOS DO QUE PEDIR — atalhos pro chat */}
        <Card className="p-4 space-y-3 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Exemplos do que pedir pra Kera no chat</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Clique em um atalho — ele abre o chat e envia a frase automaticamente. A Kera vai usar as ferramentas do desktop pra executar.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { label: "Status do PC", icon: Cpu, ask: "Mostra o status do meu PC (CPU, RAM, disco e uptime)." },
              { label: "Tirar print", icon: Camera, ask: "Tira um print da minha tela." },
              { label: "Abrir Firefox", icon: Globe, ask: "Abre o Firefox pra mim." },
              { label: "Abrir VSCode", icon: Terminal, ask: "Abre o VSCode pra mim." },
              { label: "Listar Downloads", icon: FolderOpen, ask: "Lista os arquivos da minha pasta Downloads." },
              { label: "Espaço em disco", icon: Cpu, ask: "Quanto espaço livre eu tenho no disco?" },
              { label: "Copiar pro clipboard", icon: ClipboardCopy, ask: "Copia o texto 'Olá da Kera' pra área de transferência." },
              { label: "Instalar Spotify", icon: Rocket, ask: "Instala o Spotify aqui no meu PC via Flatpak." },
              { label: "Buscar app no Flathub", icon: Globe, ask: "Procura o app Discord no Flathub e me diz o ID." },
            ].map((ex) => {
              const Icon = ex.icon;
              return (
                <Button
                  key={ex.label}
                  variant="outline"
                  size="sm"
                  className="gap-2 justify-start text-left h-auto py-2 hover:bg-primary/10 hover:border-primary/50"
                  onClick={() => navigate(`/chat?agent=kera&ask=${encodeURIComponent(ex.ask)}`)}
                >
                  <Icon className="size-3.5 shrink-0 text-primary" />
                  <span className="text-xs truncate">{ex.label}</span>
                </Button>
              );
            })}
          </div>
          <div className="text-[11px] text-muted-foreground/80 italic pt-1">
            💡 Dica: você também pode digitar livremente no chat — tipo "lista os PDFs do meu Documentos" ou "cria um arquivo notas.txt em /home/usuario/Documentos com a frase 'lembrete'".
          </div>
        </Card>

        {/* CONTROLES DE ENERGIA */}
        <Card className="p-4 space-y-3">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Controle de energia</h2>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => power("shutdown")} variant="destructive" size="sm" className="gap-2">
              <Power className="size-4" /> Desligar
            </Button>
            <Button onClick={() => power("restart")} variant="outline" size="sm" className="gap-2">
              <RotateCcw className="size-4" /> Reiniciar
            </Button>
            <Button onClick={() => power("hibernate")} variant="outline" size="sm" className="gap-2">
              <Moon className="size-4" /> Hibernar
            </Button>
            <Button onClick={() => power("lock")} variant="outline" size="sm" className="gap-2">
              <Lock className="size-4" /> Bloquear
            </Button>
          </div>
        </Card>

        {/* MASCOTE — Kera flutuante no desktop */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Mascote da Kera</h2>
            </div>
            <Button
              size="sm"
              variant={mascotVisible ? "default" : "outline"}
              className="gap-2"
              onClick={async () => {
                const k = getKera(); if (!k?.mascot) return;
                if (mascotVisible) { await k.mascot.hide(); setMascotVisible(false); toast.success("Mascote escondido"); }
                else { await k.mascot.show(); setMascotVisible(true); toast.success("Mascote ativado — diga \"Kera\" pra me chamar"); }
              }}
            >
              <Sparkles className="size-4" /> {mascotVisible ? "Esconder mascote" : "Mostrar mascote"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Janela transparente sempre no topo. A Kera anda sozinha pela tela e fica escutando — fale <span className="text-primary font-medium">"Kera"</span> e ela abre o chat. Hands-free.
          </p>
        </Card>

        {/* ATUALIZAÇÕES */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Download className="size-4 text-primary" />
              <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Atualizações</h2>
            </div>
            <div className="flex gap-2">
              <Button onClick={checkUpdate} size="sm" variant="outline" className="gap-2" disabled={checkingUpdate}>
                <RefreshCw className={`size-4 ${checkingUpdate ? "animate-spin" : ""}`} /> Verificar atualizações
              </Button>
              {updateStatus?.state === "downloaded" && (
                <Button onClick={installUpdate} size="sm" className="gap-2">
                  <Download className="size-4" /> Reiniciar e instalar
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Versão atual: <span className="font-mono text-foreground">v{info?.version || "—"}</span>. Atualizações são baixadas automaticamente em background.
          </p>
          {updateStatus && (
            <div className="text-xs font-mono px-3 py-2 rounded-md bg-secondary/40">
              {updateStatus.state === "checking" && "Verificando..."}
              {updateStatus.state === "available" && `📦 Disponível: v${updateStatus.version} — baixando…`}
              {updateStatus.state === "downloading" && `⬇ Baixando: ${updateStatus.percent ?? 0}%`}
              {updateStatus.state === "downloaded" && `✅ v${updateStatus.version} pronta. Reinicie pra instalar.`}
              {updateStatus.state === "up-to-date" && "✓ Você está na versão mais recente."}
              {updateStatus.state === "skipped" && `⚠ Auto-update desativado (${updateStatus.message || "dev"}).`}
              {updateStatus.state === "error" && `✗ Erro: ${updateStatus.message}`}
            </div>
          )}
        </Card>

        {/* VÍDEOS OFFLINE */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Download className="size-4 text-primary" />
              <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Vídeos offline</h2>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={downloadVideos}
                size="sm"
                className="gap-2"
                disabled={videosDownloading || (videosStatus?.missing.length === 0)}
              >
                <Download className={`size-4 ${videosDownloading ? "animate-pulse" : ""}`} />
                {videosStatus?.missing.length === 0 ? "Tudo baixado" : `Baixar (${videosStatus?.missing.length ?? "?"})`}
              </Button>
              {videosStatus && videosStatus.cached.length > 0 && (
                <Button onClick={clearVideos} size="sm" variant="outline" className="gap-2" disabled={videosDownloading}>
                  <Trash2 className="size-4" /> Limpar cache
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Baixa os vídeos de fundo dos agentes uma única vez (~250 MB) para funcionar 100% sem internet.
          </p>
          {videosStatus && (
            <div className="text-xs font-mono px-3 py-2 rounded-md bg-secondary/40 space-y-1">
              <div>
                ✅ Cacheados: <span className="text-foreground">{videosStatus.cached.length}/{videosStatus.total}</span>
                {videosStatus.missing.length > 0 && (
                  <> &nbsp;•&nbsp; Faltando: <span className="text-foreground">{videosStatus.missing.length}</span></>
                )}
              </div>
              {videosDownloading && videosProgress && (
                <div>
                  ⬇ {videosProgress.name}:{" "}
                  {videosProgress.total
                    ? `${Math.round((videosProgress.received / videosProgress.total) * 100)}%`
                    : `${(videosProgress.received / 1024 / 1024).toFixed(1)} MB`}
                </div>
              )}
              <div className="text-muted-foreground truncate" title={videosStatus.dir}>
                📁 {videosStatus.dir}
              </div>
            </div>
          )}
        </Card>

        {/* PASTAS AUTORIZADAS — allow-list de segurança */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Pastas autorizadas</h2>
            </div>
            <Button onClick={addAllowed} size="sm" className="gap-2">
              <Plus className="size-4" /> Autorizar pasta
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A Kera só pode ler, escrever ou apagar arquivos dentro destas pastas. Cada escrita ou exclusão ainda pede confirmação.
          </p>
          {allowlist.length === 0 ? (
            <div className="text-xs text-muted-foreground italic border border-dashed border-border rounded-md p-3">
              Nenhuma pasta autorizada. Clique em "Autorizar pasta" para liberar acesso.
            </div>
          ) : (
            <ul className="space-y-1">
              {allowlist.map((p) => (
                <li
                  key={p}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-md bg-secondary/40 text-xs font-mono"
                >
                  <button onClick={() => setCwd(p)} className="truncate text-left hover:text-primary transition flex-1">
                    {p}
                  </button>
                  <Button
                    onClick={() => removeAllowed(p)}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    title="Revogar"
                  >
                    <X className="size-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* STATUS DO SISTEMA */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Cpu className="size-4 text-primary" />
              <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Status do sistema</h2>
            </div>
            <Button onClick={loadStatus} size="sm" variant="outline" className="gap-2">
              <RefreshCw className="size-4" /> Atualizar
            </Button>
          </div>
          {sysStatus ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div><div className="text-muted-foreground">CPU</div><div className="font-mono truncate" title={sysStatus.cpuModel}>{sysStatus.cpuModel}</div></div>
              <div><div className="text-muted-foreground">Núcleos</div><div className="font-mono">{sysStatus.cpuCount}</div></div>
              <div><div className="text-muted-foreground">Load (1/5/15m)</div><div className="font-mono">{sysStatus.loadAvg.map(n => n.toFixed(2)).join(" / ")}</div></div>
              <div><div className="text-muted-foreground">RAM usada</div><div className="font-mono">{sysStatus.memUsedPct}%</div></div>
              <div><div className="text-muted-foreground">RAM total</div><div className="font-mono">{(sysStatus.memTotalBytes / 1024 ** 3).toFixed(1)} GB</div></div>
              <div><div className="text-muted-foreground">Uptime</div><div className="font-mono">{Math.floor(sysStatus.uptimeSec / 3600)}h {Math.floor((sysStatus.uptimeSec % 3600) / 60)}m</div></div>
              {sysStatus.homeDiskRaw && (
                <div className="col-span-2 md:col-span-3"><div className="text-muted-foreground">Disco (home)</div><div className="font-mono text-[10px] truncate" title={sysStatus.homeDiskRaw}>{sysStatus.homeDiskRaw}</div></div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Clique em Atualizar para ver o status do seu PC.</p>
          )}
        </Card>

        {/* CLIPBOARD */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardCopy className="size-4 text-primary" />
            <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Área de transferência</h2>
          </div>
          <Textarea value={clip} onChange={(e) => setClip(e.target.value)} rows={3} className="font-mono text-xs" placeholder="Conteúdo do clipboard…" />
          <div className="flex gap-2">
            <Button onClick={readClip} size="sm" variant="outline" className="gap-2"><ClipboardPaste className="size-4" /> Ler do clipboard</Button>
            <Button onClick={writeClip} size="sm" className="gap-2" disabled={!clip.trim()}><ClipboardCopy className="size-4" /> Copiar p/ clipboard</Button>
          </div>
        </Card>

        {/* SCREENSHOT */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Camera className="size-4 text-primary" />
              <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Captura de tela</h2>
            </div>
            <Button onClick={takeShot} size="sm" className="gap-2"><Camera className="size-4" /> Capturar</Button>
          </div>
          {shot && (
            <img src={shot} alt="Captura de tela" className="w-full rounded-md border border-border" />
          )}
        </Card>

        {/* ABRIR PROGRAMAS / ARQUIVOS / URLs */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Rocket className="size-4 text-primary" />
            <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Abrir programas e arquivos</h2>
          </div>
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Abrir arquivo/pasta/URL com app padrão</div>
            <div className="flex gap-2">
              <Input value={openTarget} onChange={(e) => setOpenTarget(e.target.value)} placeholder="/home/usuario/arquivo.pdf  ou  https://google.com" className="text-xs font-mono" />
              <Button onClick={openPath} size="sm" className="gap-2" disabled={!openTarget.trim()}><Globe className="size-4" /> Abrir</Button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Abrir programa pelo nome (ex: firefox, code, gedit)</div>
            <div className="flex gap-2">
              <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="firefox" className="text-xs font-mono" />
              <Button onClick={openApp} size="sm" variant="outline" className="gap-2" disabled={!appName.trim()}><Rocket className="size-4" /> Executar</Button>
            </div>
          </div>
        </Card>

        {/* TERMINAL */}
        <Card className="p-4 space-y-3 border-destructive/30">
          <div className="flex items-center gap-2">
            <Terminal className="size-4 text-destructive" />
            <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Terminal (avançado)</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            ⚠️ Poderoso e arriscado. Cada comando pede confirmação. Timeout 30s. Saída limitada a 20k caracteres.
          </p>
          <Textarea value={cmd} onChange={(e) => setCmd(e.target.value)} rows={2} className="font-mono text-xs" placeholder='ls -la  |  df -h  |  git status' />
          <Button onClick={runCmd} size="sm" variant="destructive" className="gap-2" disabled={!cmd.trim()}>
            <Terminal className="size-4" /> Executar comando
          </Button>
          {execResult && (
            <div className="space-y-1 text-xs">
              <div className={execResult.ok ? "text-primary" : "text-destructive"}>
                {execResult.ok ? "✓ sucesso" : `✗ ${execResult.error || "falha"}`}
              </div>
              {execResult.stdout && (
                <pre className="bg-background/60 border border-border rounded-md p-2 overflow-auto max-h-48 font-mono text-[11px] whitespace-pre-wrap">{execResult.stdout}</pre>
              )}
              {execResult.stderr && (
                <pre className="bg-destructive/10 border border-destructive/30 rounded-md p-2 overflow-auto max-h-32 font-mono text-[11px] whitespace-pre-wrap text-destructive">{execResult.stderr}</pre>
              )}
            </div>
          )}
        </Card>

        {/* EXPLORADOR DE ARQUIVOS */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Arquivos</h2>
            <div className="flex gap-2">
              <Button onClick={pickFolder} variant="outline" size="sm" className="gap-2">
                <FolderOpen className="size-4" /> Escolher pasta
              </Button>
              <Button onClick={() => load(cwd)} variant="ghost" size="sm" className="gap-2" disabled={loading}>
                <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
          <Input
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(cwd)}
            placeholder="Caminho da pasta"
            className="text-xs font-mono"
          />
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-3">
            <div className="border border-border rounded-md max-h-96 overflow-auto bg-background/40">
              {entries.map((e) => (
                <button
                  key={e.path}
                  onClick={() => openFile(e)}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-secondary/60 transition flex items-center gap-2 ${
                    selected?.path === e.path ? "bg-secondary" : ""
                  }`}
                >
                  {e.isDir ? "📁" : "📄"} <span className="truncate">{e.name}</span>
                </button>
              ))}
              {entries.length === 0 && !loading && (
                <p className="text-xs text-muted-foreground p-3">Pasta vazia</p>
              )}
            </div>
            <div className="space-y-2">
              {selected ? (
                <>
                  <div className="text-xs font-mono text-muted-foreground truncate">{selected.path}</div>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={14}
                    className="font-mono text-xs"
                  />
                  <div className="flex gap-2">
                    <Button onClick={save} size="sm" className="gap-2">
                      <Save className="size-4" /> Salvar
                    </Button>
                    <Button onClick={del} variant="destructive" size="sm" className="gap-2">
                      <Trash2 className="size-4" /> Excluir
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm border border-dashed border-border rounded-md p-8">
                  <FileText className="size-4 mr-2" /> Selecione um arquivo
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default KeraDesktopPage;
