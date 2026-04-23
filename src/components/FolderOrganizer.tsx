import { useEffect, useMemo, useState } from "react";
import { Sparkles, FolderOpen, Wand2, RotateCcw, Loader2, Check, Folder, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getKera } from "@/lib/keraDesktop";
import { supabase } from "@/integrations/supabase/client";

type ScannedFile = {
  name: string;
  path: string;
  ext: string;
  sizeBytes: number;
  modifiedAt: string;
};

type Suggestion = { name: string; folder: string; reason: string };

const fmtSize = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
};

export const FolderOrganizer = () => {
  const [defaults, setDefaults] = useState<{ label: string; path: string }[]>([]);
  const [rootFolder, setRootFolder] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [files, setFiles] = useState<ScannedFile[]>([]);
  const [suggestions, setSuggestions] = useState<Map<string, Suggestion>>(new Map());
  const [classifying, setClassifying] = useState(false);
  const [applying, setApplying] = useState(false);
  const [overrides, setOverrides] = useState<Map<string, string>>(new Map());
  const [authorizing, setAuthorizing] = useState(false);

  const refreshDefaults = async () => {
    const k = getKera();
    if (!k?.organizer) return;
    const d = await k.organizer.defaults();
    setDefaults(d);
    if (d[0] && !rootFolder) setRootFolder(d[0].path);
  };

  useEffect(() => {
    refreshDefaults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const authorizeAll = async () => {
    const k = getKera();
    if (!k?.organizer?.authorizeAll) return;
    setAuthorizing(true);
    try {
      const r = await k.organizer.authorizeAll();
      if (r.cancelled) return;
      if (!r.ok) {
        toast.error(r.error || "Não foi possível autorizar.");
        return;
      }
      if (r.alreadyAuthorized) {
        toast.info("Todas as suas pastas pessoais já estavam autorizadas.");
      } else {
        toast.success(`✓ ${r.added?.length ?? 0} pasta(s) autorizada(s) com sucesso!`);
      }
      await refreshDefaults();
    } finally {
      setAuthorizing(false);
    }
  };

  const scan = async (folder: string) => {
    const k = getKera();
    if (!k?.organizer) return;
    setScanning(true);
    setFiles([]);
    setSuggestions(new Map());
    setOverrides(new Map());
    try {
      const r = await k.organizer.scan(folder);
      setFiles(r.files);
      if (r.files.length === 0) toast.info("Nenhum arquivo encontrado nesta pasta.");
      else toast.success(`${r.files.length} arquivo(s) encontrado(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao escanear");
    } finally {
      setScanning(false);
    }
  };

  const classify = async () => {
    if (files.length === 0) return;
    setClassifying(true);
    try {
      const payload = {
        rootLabel: rootFolder.split(/[\\/]/).filter(Boolean).pop() || "pasta",
        files: files.map((f) => ({
          name: f.name,
          ext: f.ext,
          sizeBytes: f.sizeBytes,
          modifiedAt: f.modifiedAt,
        })),
      };
      const { data, error } = await supabase.functions.invoke("classify-files", {
        body: payload,
      });
      if (error) throw error;
      const list: Suggestion[] = data?.suggestions || [];
      const map = new Map<string, Suggestion>();
      for (const s of list) map.set(s.name, s);
      setSuggestions(map);
      if (map.size === 0) toast.error("A IA não conseguiu sugerir pastas.");
      else toast.success(`Plano gerado: ${map.size} arquivo(s) classificado(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao classificar");
    } finally {
      setClassifying(false);
    }
  };

  const grouped = useMemo(() => {
    const g = new Map<string, ScannedFile[]>();
    for (const f of files) {
      const folder = overrides.get(f.name) ?? suggestions.get(f.name)?.folder;
      if (!folder) continue;
      if (!g.has(folder)) g.set(folder, []);
      g.get(folder)!.push(f);
    }
    return [...g.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [files, suggestions, overrides]);

  const apply = async () => {
    const k = getKera();
    if (!k?.organizer) return;
    const plan = files
      .map((f) => {
        const folder = overrides.get(f.name) ?? suggestions.get(f.name)?.folder;
        return folder ? { from: f.path, folder } : null;
      })
      .filter(Boolean) as { from: string; folder: string }[];
    if (plan.length === 0) return toast.error("Nada para mover.");
    setApplying(true);
    try {
      const r = await k.organizer.apply({ rootFolder, plan });
      if (r.cancelled) return;
      if (r.ok) {
        const created = r.createdFolders?.length ?? 0;
        toast.success(
          `✓ ${r.moved} arquivo(s) organizados${created > 0 ? ` em ${created} pasta(s) nova(s)` : ""}!`
        );
        setFiles([]);
        setSuggestions(new Map());
        setOverrides(new Map());
      } else {
        toast.error(`Movidos: ${r.moved}. Erros: ${r.errors?.length ?? 0}`);
      }
    } finally {
      setApplying(false);
    }
  };

  const undo = async () => {
    const k = getKera();
    if (!k?.organizer) return;
    const r = await k.organizer.undo();
    if (r.cancelled) return;
    if (r.ok) toast.success(`↺ ${r.restored} arquivo(s) restaurados.`);
    else toast.error(r.error || `Restaurados: ${r.restored ?? 0}, erros: ${r.errors?.length ?? 0}`);
  };

  return (
    <Card className="p-4 space-y-3 border-primary/30 bg-primary/5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground">
            Organizador de pastas com IA
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={authorizeAll}
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={authorizing}
          >
            {authorizing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="size-3.5" />
            )}
            Autorizar pastas pessoais
          </Button>
          <Button onClick={undo} size="sm" variant="ghost" className="gap-2">
            <RotateCcw className="size-3.5" /> Desfazer último
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        A Kera lê os nomes dos arquivos e sugere pastas temáticas (ex.: "Notas Fiscais 2025",
        "Viagem Floripa"). Nada é movido sem sua confirmação. Você pode desfazer depois.
      </p>

      {/* Atalhos das pastas padrão */}
      <div className="flex flex-wrap gap-2">
        {defaults.map((d) => (
          <Button
            key={d.path}
            size="sm"
            variant={rootFolder === d.path ? "default" : "outline"}
            className="gap-1.5"
            onClick={() => {
              setRootFolder(d.path);
              scan(d.path);
            }}
          >
            <FolderOpen className="size-3.5" /> {d.label}
          </Button>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={rootFolder}
          onChange={(e) => setRootFolder(e.target.value)}
          placeholder="Caminho da pasta…"
          className="font-mono text-xs"
        />
        <Button onClick={() => scan(rootFolder)} size="sm" disabled={scanning || !rootFolder}>
          {scanning ? <Loader2 className="size-4 animate-spin" /> : "Escanear"}
        </Button>
      </div>

      {files.length > 0 && suggestions.size === 0 && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-secondary/40">
          <div className="text-xs">
            <strong>{files.length}</strong> arquivo(s) encontrado(s) ·{" "}
            <span className="text-muted-foreground">
              {fmtSize(files.reduce((s, f) => s + f.sizeBytes, 0))} no total
            </span>
          </div>
          <Button onClick={classify} size="sm" className="gap-2" disabled={classifying}>
            {classifying ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wand2 className="size-4" />
            )}
            {classifying ? "A Kera está pensando…" : "Sugerir pastas com IA"}
          </Button>
        </div>
      )}

      {/* Plano agrupado */}
      {grouped.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {grouped.map(([folder, items]) => (
            <div key={folder} className="rounded-lg border border-border bg-background/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Folder className="size-4 text-primary" />
                <span className="font-semibold text-sm">{folder}</span>
                <span className="text-xs text-muted-foreground">
                  ({items.length} arquivo{items.length === 1 ? "" : "s"})
                </span>
              </div>
              <ul className="space-y-1">
                {items.map((f) => (
                  <li
                    key={f.path}
                    className="flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-secondary/40"
                  >
                    <span className="font-mono truncate flex-1" title={f.name}>
                      {f.name}
                    </span>
                    <span className="text-muted-foreground shrink-0">
                      {fmtSize(f.sizeBytes)}
                    </span>
                    <Input
                      defaultValue={folder}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== folder) {
                          const next = new Map(overrides);
                          next.set(f.name, v);
                          setOverrides(next);
                        }
                      }}
                      className="h-6 w-32 text-[11px] font-mono"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="sticky bottom-0 pt-2 bg-gradient-to-t from-background to-transparent">
            <Button
              onClick={apply}
              size="lg"
              className="w-full gap-2"
              disabled={applying}
            >
              {applying ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {applying ? "Movendo…" : `Aplicar — mover ${files.length} arquivo(s)`}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default FolderOrganizer;