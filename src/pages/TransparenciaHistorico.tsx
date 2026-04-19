import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, History, Loader2, ExternalLink, RefreshCw, Filter } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import keraLogo from "@/assets/kera-logo.png";

interface SnapshotRow {
  id: string;
  hash: string;
  numero: string | null;
  modalidade: string | null;
  objeto: string | null;
  status: string | null;
  data_abertura: string | null;
  data_encerramento: string | null;
  valor: string | null;
  vencedor: string | null;
  link: string | null;
  source_url: string;
  first_seen_at: string;
  last_seen_at: string;
  is_open: boolean;
}

const TransparenciaHistorico = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("licitacoes_snapshot")
        .select("*")
        .order("first_seen_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      setRows(data as SnapshotRow[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      toast.error("Falha ao carregar histórico: " + msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (onlyOpen && !r.is_open) return false;
      if (!filter.trim()) return true;
      const q = filter.toLowerCase();
      return [r.numero, r.modalidade, r.objeto, r.status, r.vencedor]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, filter, onlyOpen]);

  const stats = useMemo(() => {
    const total = rows.length;
    const abertas = rows.filter((r) => r.is_open).length;
    const today = new Date(); today.setHours(0,0,0,0);
    const novasHoje = rows.filter((r) => new Date(r.first_seen_at) >= today).length;
    return { total, abertas, novasHoje };
  }, [rows]);

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border panel flex items-center px-4 md:px-6 gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/transparencia")}>
          <ArrowLeft className="size-5" />
        </Button>
        <img src={keraLogo} alt="Kera AI" className="h-7" />
        <h1 className="font-display text-glow text-lg ml-2">HISTÓRICO · LICITAÇÕES</h1>
        <Button variant="ghost" size="icon" className="ml-auto" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        </Button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <section className="flex items-center gap-2">
          <History className="size-5 text-primary" />
          <h2 className="font-display text-xl text-glow">Snapshots persistidos</h2>
        </section>

        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Total</p>
            <p className="text-2xl font-display text-glow">{stats.total}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Abertas</p>
            <p className="text-2xl font-display text-green-500">{stats.abertas}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Novas hoje</p>
            <p className="text-2xl font-display text-primary">{stats.novasHoje}</p>
          </Card>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Filtrar por número, objeto, status..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-9"
          />
          <Button
            variant={onlyOpen ? "default" : "outline"}
            size="sm"
            onClick={() => setOnlyOpen(!onlyOpen)}
            className="h-9 shrink-0"
          >
            <Filter className="size-3 mr-1" /> Abertas
          </Button>
        </div>

        {loading && rows.length === 0 ? (
          <Card className="p-8 text-center">
            <Loader2 className="size-5 animate-spin mx-auto text-primary" />
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum snapshot ainda. Rode um scraping em /transparencia ou aguarde o cron das 6h.
            </p>
          </Card>
        ) : (
          <div className="grid gap-2">
            {filtered.map((r) => {
              const novaHoje = (Date.now() - new Date(r.first_seen_at).getTime()) < 24 * 3600 * 1000;
              const stale = (Date.now() - new Date(r.last_seen_at).getTime()) > 7 * 24 * 3600 * 1000;
              return (
                <Card key={r.id} className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.numero && <Badge variant="outline" className="font-mono text-[10px]">{r.numero}</Badge>}
                      {r.modalidade && <Badge className="bg-primary/15 text-primary border border-primary/40 text-[10px]">{r.modalidade}</Badge>}
                      {r.status && (
                        <Badge className={`text-[10px] border ${r.is_open ? "bg-green-500/15 text-green-500 border-green-500/40" : "bg-muted text-muted-foreground border-border"}`}>
                          {r.status}
                        </Badge>
                      )}
                      {novaHoje && <Badge className="bg-primary text-primary-foreground text-[10px]">NOVA</Badge>}
                      {stale && <Badge variant="outline" className="text-[10px] text-muted-foreground">não vista há 7d+</Badge>}
                    </div>
                    {r.link && (
                      <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-primary">
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                  {r.objeto && <p className="text-sm">{r.objeto}</p>}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    {r.data_abertura && <div><span className="text-foreground/70">Abertura:</span> {r.data_abertura}</div>}
                    {r.data_encerramento && <div><span className="text-foreground/70">Encerra:</span> {r.data_encerramento}</div>}
                    {r.valor && <div><span className="text-foreground/70">Valor:</span> {r.valor}</div>}
                    {r.vencedor && <div className="col-span-2"><span className="text-foreground/70">Vencedor:</span> {r.vencedor}</div>}
                    <div className="col-span-2 pt-1 border-t border-border/40 flex justify-between">
                      <span>1ª vez: {new Date(r.first_seen_at).toLocaleString("pt-BR")}</span>
                      <span>Última: {new Date(r.last_seen_at).toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default TransparenciaHistorico;
