import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, FolderOpen, Power, RotateCcw, Moon, Lock, FileText, Trash2, Save, RefreshCw,
  Monitor, ShieldCheck, Plus, X, ClipboardCopy, ClipboardPaste, Camera, Terminal, Rocket, Cpu, Globe, Download,
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
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
        <Card className="max-w-2xl p-8 space-y-4 text-center">
          <Monitor className="size-12 mx-auto text-primary" />
          <h1 className="text-2xl font-display text-glow">Kera Desktop</h1>
          <p className="text-muted-foreground">
            Esta página só funciona quando você abre a Kera pelo <strong>app desktop</strong>{" "}
            (Windows/Mac/Linux). No navegador, o acesso ao sistema do PC é bloqueado.
          </p>
          <p className="text-sm text-muted-foreground/80">
            Baixe o instalador na sua área de admin e rode o <code className="text-primary">KeraDesktop.exe</code>.
          </p>
          <Link to="/">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="size-4" /> Voltar ao chat
            </Button>
          </Link>
        </Card>
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
