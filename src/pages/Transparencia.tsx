import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, FileSearch, Loader2, Gavel, FileText, FileSignature, RefreshCw, ExternalLink, History } from "lucide-react";
import { toast } from "sonner";
import keraLogo from "@/assets/kera-logo.png";

const SCRAPE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transparencia-scrape`;

type Tipo = "licitacoes" | "protocolos" | "contratos";

interface Item {
  numero?: string;
  modalidade?: string;
  objeto?: string;
  status?: string;
  data_abertura?: string;
  data_encerramento?: string;
  valor?: string;
  secretaria?: string;
  tempo_aberto?: string;
  vencedor?: string;
  link?: string;
  [k: string]: unknown;
}

interface Result {
  tipo: string;
  label: string;
  url: string;
  scraped_at: string;
  items: Item[];
  total: number;
  observacoes: string | null;
  markdown_preview: string;
  snapshot_stats?: { novas: number; atualizadas: number; total: number } | null;
}

const TIPOS: Array<{ id: Tipo; label: string; icon: typeof Gavel; desc: string }> = [
  { id: "licitacoes", label: "Licitações", icon: Gavel, desc: "Em andamento, abertas e homologadas" },
  { id: "protocolos", label: "Protocolos", icon: FileText, desc: "Atendimentos e tempo em aberto" },
  { id: "contratos", label: "Contratos", icon: FileSignature, desc: "Vigentes e vencedores" },
];

const Transparencia = () => {
  const navigate = useNavigate();
  const [tipo, setTipo] = useState<Tipo>("licitacoes");
  const [customUrl, setCustomUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [filter, setFilter] = useState("");

  const run = async (override?: { url?: string; tipo?: Tipo }) => {
    setLoading(true);
    setResult(null);
    try {
      const body: Record<string, unknown> = {};
      if (override?.url || customUrl) {
        body.url = override?.url || customUrl;
      } else {
        body.tipo = override?.tipo || tipo;
      }
      const resp = await fetch(SCRAPE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok || data.success === false) {
        throw new Error(data.error || `HTTP ${resp.status}`);
      }
      setResult(data);
      const snap = data.snapshot_stats;
      if (snap) {
        toast.success(`${data.total} item(ns) · ${snap.novas} nova(s), ${snap.atualizadas} atualizada(s) no histórico`);
      } else {
        toast.success(`${data.total} item(ns) extraído(s)`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      toast.error("Falha ao raspar: " + msg);
    } finally {
      setLoading(false);
    }
  };

  const filtered = result?.items.filter((it) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return JSON.stringify(it).toLowerCase().includes(q);
  }) ?? [];

  const isAberta = (status?: string) => {
    if (!status) return false;
    const s = status.toLowerCase();
    return s.includes("abert") || s.includes("andament") || s.includes("ativ") || s.includes("vigent");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border panel flex items-center px-4 md:px-6 gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="size-5" />
        </Button>
        <img src={keraLogo} alt="Kera AI" className="h-7" />
        <h1 className="font-display text-glow text-lg ml-2">TRANSPARÊNCIA</h1>
        <Button variant="ghost" size="sm" className="ml-auto gap-1" onClick={() => navigate("/transparencia/historico")}>
          <History className="size-4" /> Histórico
        </Button>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <section>
          <div className="flex items-center gap-2 mb-2">
            <FileSearch className="size-5 text-primary" />
            <h2 className="font-display text-xl text-glow">Portal Transparência · Guaramirim</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Scraping em tempo real do <code className="text-primary text-xs">guaramirim.atende.net</code> via Firecrawl.
            Extrai dados estruturados com IA.
          </p>
        </section>

        {/* Tipo */}
        <div className="grid grid-cols-3 gap-2">
          {TIPOS.map((t) => {
            const Icon = t.icon;
            const selected = tipo === t.id;
            return (
              <Card
                key={t.id}
                onClick={() => setTipo(t.id)}
                className={`p-3 cursor-pointer transition border ${
                  selected ? "border-primary shadow-glow bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                <Icon className={`size-5 mb-1 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{t.desc}</p>
              </Card>
            );
          })}
        </div>

        <div className="space-y-2">
          <Input
            placeholder="(opcional) URL customizada do portal pra raspar"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            className="h-9 font-mono text-xs"
          />
          <Button onClick={() => run()} disabled={loading} className="w-full">
            {loading ? <><Loader2 className="size-4 mr-2 animate-spin" /> Raspando...</> : <><RefreshCw className="size-4 mr-2" /> Buscar dados</>}
          </Button>
        </div>

        {/* Resultados */}
        {result && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm font-medium">{result.label}</p>
                <p className="text-xs text-muted-foreground">
                  {result.total} item(ns) · {new Date(result.scraped_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                Fonte <ExternalLink className="size-3" />
              </a>
            </div>

            {result.observacoes && (
              <Card className="p-3 bg-muted/30 border-dashed">
                <p className="text-xs text-muted-foreground">{result.observacoes}</p>
              </Card>
            )}

            <Input
              placeholder="Filtrar resultados..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-9"
            />

            {filtered.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhum item estruturado extraído. Veja o preview do markdown abaixo.
                </p>
              </Card>
            ) : (
              <div className="grid gap-2">
                {filtered.map((it, i) => (
                  <Card key={i} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {it.numero && <Badge variant="outline" className="font-mono text-[10px]">{it.numero}</Badge>}
                        {it.modalidade && <Badge className="bg-primary/15 text-primary border border-primary/40 text-[10px]">{it.modalidade}</Badge>}
                        {it.status && (
                          <Badge className={`text-[10px] border ${isAberta(it.status) ? "bg-green-500/15 text-green-500 border-green-500/40" : "bg-muted text-muted-foreground border-border"}`}>
                            {it.status}
                          </Badge>
                        )}
                      </div>
                      {it.link && (
                        <a href={it.link} target="_blank" rel="noopener noreferrer" className="text-primary">
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                    {it.objeto && <p className="text-sm">{it.objeto}</p>}
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                      {it.data_abertura && <div><span className="text-foreground/70">Abertura:</span> {it.data_abertura}</div>}
                      {it.data_encerramento && <div><span className="text-foreground/70">Encerra:</span> {it.data_encerramento}</div>}
                      {it.valor && <div><span className="text-foreground/70">Valor:</span> {it.valor}</div>}
                      {it.secretaria && <div><span className="text-foreground/70">Secretaria:</span> {it.secretaria}</div>}
                      {it.tempo_aberto && <div><span className="text-foreground/70">Em aberto:</span> {it.tempo_aberto}</div>}
                      {it.vencedor && <div className="col-span-2"><span className="text-foreground/70">Vencedor:</span> {it.vencedor}</div>}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {result.markdown_preview && filtered.length === 0 && (
              <Card className="p-3">
                <p className="text-xs font-medium mb-2 text-muted-foreground">Preview bruto:</p>
                <pre className="text-[10px] whitespace-pre-wrap max-h-64 overflow-auto opacity-70">
                  {result.markdown_preview}
                </pre>
              </Card>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default Transparencia;
