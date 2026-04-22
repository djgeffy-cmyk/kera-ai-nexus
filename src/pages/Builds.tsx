import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ExternalLink, RefreshCw, Terminal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const GH_OWNER = "djgeffy-cmyk";
const GH_REPO = "kera-ai-nexus";
const RELEASES_API = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/releases?per_page=10`;

interface GhAsset {
  id: number;
  name: string;
  size: number;
  browser_download_url: string;
  updated_at: string;
  download_count: number;
}

interface GhRelease {
  id: number;
  name: string | null;
  tag_name: string;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  assets: GhAsset[];
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const isLinuxAsset = (name: string) =>
  /\.AppImage$|\.deb$|\.rpm$|linux/i.test(name);

type SortMode = "date" | "version";

// Parse semver-ish tag (v1.2.3, 1.2.3-beta.1, etc.) into comparable tuple
function parseVersion(tag: string): [number, number, number, number, string] {
  const clean = tag.replace(/^v/i, "").trim();
  const match = clean.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+](.+))?/);
  if (!match) return [-1, -1, -1, 1, clean];
  const [, maj, min, pat, pre] = match;
  // pre-release sorts BEFORE final (1 = stable, 0 = pre)
  return [Number(maj), Number(min), Number(pat), pre ? 0 : 1, pre || ""];
}

function compareVersions(a: string, b: string) {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  for (let i = 0; i < 4; i++) {
    if ((va[i] as number) !== (vb[i] as number)) {
      return (vb[i] as number) - (va[i] as number);
    }
  }
  // Both pre-releases: compare pre tags lexicographically (desc)
  return (vb[4] as string).localeCompare(va[4] as string);
}

export default function Builds() {
  const [releases, setReleases] = useState<GhRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("date");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(RELEASES_API, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
      const data: GhRelease[] = await res.json();
      setReleases(data.filter((r) => !r.draft));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar releases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sortedReleases = [...releases].sort((a, b) => {
    if (sortMode === "version") return compareVersions(a.tag_name, b.tag_name);
    return (
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );
  });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-4xl px-4 py-10">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              <Badge variant="secondary">Linux</Badge>
            </div>
            <h1 className="text-3xl font-bold">Últimas builds Linux</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Baixe diretamente o .AppImage da release mais recente sem precisar
              entrar na aba Actions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={sortMode}
              onValueChange={(v) => setSortMode(v as SortMode)}
            >
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Data de publicação</SelectItem>
                <SelectItem value="version">Versão (semântica)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={load}
              disabled={loading}
            >
              <RefreshCw className={loading ? "animate-spin" : ""} />
              Atualizar
            </Button>
          </div>
        </header>

        {error && (
          <Card className="mb-6 border-destructive/40">
            <CardContent className="pt-6 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        {loading && releases.length === 0 && (
          <p className="text-sm text-muted-foreground">Carregando releases…</p>
        )}

        {!loading && releases.length === 0 && !error && (
          <Card>
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Nenhuma release publicada ainda. Builds só aparecem aqui depois
              que uma tag <code className="font-mono">v*</code> é enviada e o
              workflow finaliza com sucesso.
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {sortedReleases.map((release) => {
            const linuxAssets = release.assets.filter((a) =>
              isLinuxAsset(a.name),
            );
            return (
              <Card key={release.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">
                        {release.name || release.tag_name}
                      </CardTitle>
                      <Badge variant="outline" className="font-mono text-xs">
                        {release.tag_name}
                      </Badge>
                      {release.prerelease && (
                        <Badge variant="secondary">pré-release</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(release.published_at)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  {linuxAssets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum artefato Linux nesta release.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {linuxAssets.map((asset) => (
                        <li
                          key={asset.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-mono text-sm">
                              {asset.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatBytes(asset.size)} ·{" "}
                              {asset.download_count} downloads
                            </p>
                          </div>
                          <Button asChild size="sm">
                            <a
                              href={asset.browser_download_url}
                              rel="noopener noreferrer"
                            >
                              <Download />
                              Baixar
                            </a>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4 flex justify-end">
                    <Button asChild variant="ghost" size="sm">
                      <a
                        href={release.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Ver no GitHub
                        <ExternalLink />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
}