import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  FileSearch,
  FolderKanban,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";

/**
 * Página de Processos Digitais (WPT) — integração reaproveitada do Nexus/BI.
 * Consome a edge function `atendenet-processos` que bate na API REST oficial
 * do Atende.net (NT 167/2021) com Basic Auth.
 */

const COMPRAS_LICITACOES_PRESETS = [
  {
    key: "compras",
    label: "Compras",
    match: /compra|aquisi[çc][ãa]o|dispensa|inexigibilidade|cota[çc][ãa]o|empenho|requisi[çc][ãa]o/i,
  },
  {
    key: "licitacoes",
    label: "Licitações",
    match: /licita|preg[ãa]o|concorr[êe]ncia|tomada\s*de\s*pre[çc]o|leil[ãa]o|edital|certame|conv[íi]te|crc/i,
  },
];

type Processo = {
  id: string;
  numero: string;
  ano: string;
  assunto: string;
  subassunto: string;
  requerente: string;
  situacao: string;
  situacao_codigo: string;
  data_abertura: string;
  data_atualizacao: string;
  data_encerramento: string;
  unidade_atual: string;
  responsavel: string;
  url: string;
};

function parseAtendenetDate(value?: string | null): string {
  if (!value) return "";
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}:\d{2}:\d{2})?/);
  if (m) {
    const [, dd, mm, yyyy, time] = m;
    return `${yyyy}-${mm}-${dd}${time ? `T${time}` : ""}`;
  }
  return value;
}

function extractPessoaNome(p: any): string {
  if (!p) return "";
  return p.nome || p.razaoSocial || p.nomeFantasia || p.descricao || p.cpfCnpj || "";
}

function mapApiToProcesso(item: any): Processo {
  const usuarioAtual = item.usuarioAtual || {};
  const responsavelObj = item.responsavel || {};
  const responsavelNome =
    extractPessoaNome(usuarioAtual?.pessoa) ||
    extractPessoaNome(usuarioAtual) ||
    usuarioAtual?.login ||
    extractPessoaNome(responsavelObj?.pessoa) ||
    extractPessoaNome(responsavelObj) ||
    (responsavelObj?.cpfCnpj ? `CPF ${responsavelObj.cpfCnpj}` : "") ||
    "";
  const requerentePrincipal = item.requerentes?.principal || item.requerente || {};
  const requerenteNome =
    extractPessoaNome(requerentePrincipal?.pessoa) ||
    extractPessoaNome(requerentePrincipal) ||
    (requerentePrincipal?.cpfCnpj ? `CPF ${requerentePrincipal.cpfCnpj}` : "") ||
    "";
  const setorAtual =
    item.centroCustoAtual?.descricao ||
    item.centroCusto?.descricao ||
    item.unidadeAtual?.descricao ||
    item.roteiro?.descricao ||
    "";
  return {
    id: String(item.codigo || ""),
    numero: `${item.numero || ""}/${item.ano || ""}`,
    ano: String(item.ano || ""),
    assunto: item.assunto?.descricao || "",
    subassunto: item.subassunto?.descricao || "",
    requerente: requerenteNome,
    situacao: item.situacao?.descricao || "Não informado",
    situacao_codigo: String(item.situacao?.codigo ?? ""),
    data_abertura: parseAtendenetDate(item.abertura),
    data_atualizacao: parseAtendenetDate(item.ultimoTramite || item.abertura),
    data_encerramento: parseAtendenetDate(item.encerramento),
    unidade_atual: setorAtual,
    responsavel: responsavelNome,
    url: `https://guaramirim.atende.net/atendenet/#!/processo/${item.codigo}`,
  };
}

function formatDate(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("pt-BR");
}

async function buscarProcessos(params: { numero?: string; ano: string }) {
  const numero = params.numero?.trim();
  if (numero) {
    const { data, error } = await supabase.functions.invoke("atendenet-processos", {
      body: { action: "buscar", numero, ano: params.ano },
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "Falha na consulta");
    if (data.data?.code && data.data?.msg) {
      return { processos: [] as Processo[], apiMsg: `${data.data.msg} (cód ${data.data.code})` };
    }
    return { processos: (data.data?.dados || []).map(mapApiToProcesso), apiMsg: null };
  }
  // Varredura: API WPT não suporta listagem por período, então varremos protocolos.
  const { data, error } = await supabase.functions.invoke("atendenet-processos", {
    body: { action: "varrer", ano: params.ano, numeroDe: 1, numeroAte: 500, concorrencia: 25 },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Falha na varredura");
  return { processos: (data.data?.dados || []).map(mapApiToProcesso), apiMsg: null };
}

export default function Processos() {
  const currentYear = new Date().getFullYear();
  const [draftNumero, setDraftNumero] = useState("");
  const [draftAssunto, setDraftAssunto] = useState("");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [filtros, setFiltros] = useState({ numero: "", ano: String(currentYear) });

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["processos-wpt", filtros],
    queryFn: () => buscarProcessos(filtros),
    staleTime: 60_000,
  });

  const processos = useMemo(() => {
    const base = data?.processos || [];
    return base.filter((p) => {
      if (draftAssunto.trim()) {
        const needle = draftAssunto.trim().toLowerCase();
        const hay = `${p.assunto} ${p.requerente} ${p.unidade_atual} ${p.subassunto}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      const skipArea = !!draftAssunto.trim() || !!draftNumero.trim();
      if (!skipArea) {
        const hayArea = `${p.assunto} ${p.subassunto} ${p.unidade_atual}`.toLowerCase();
        if (areaFilter === "all") {
          if (!COMPRAS_LICITACOES_PRESETS.some((preset) => preset.match.test(hayArea))) return false;
        } else {
          const preset = COMPRAS_LICITACOES_PRESETS.find((p2) => p2.key === areaFilter);
          if (preset && !preset.match.test(hayArea)) return false;
        }
      }
      return true;
    });
  }, [data?.processos, draftAssunto, draftNumero, areaFilter]);

  const handleApplyFilters = () => {
    const numeroLimpo = draftNumero.trim();
    const isProtocolo = /^\d+(\s*\/\s*\d{4})?$|^\d{4}\s*\/\s*\d+$/.test(numeroLimpo);
    setFiltros({
      numero: isProtocolo ? numeroLimpo : "",
      ano: isProtocolo ? "todos" : String(currentYear),
    });
    setTimeout(() => refetch(), 0);
  };

  const handleReset = () => {
    setDraftNumero("");
    setDraftAssunto("");
    setAreaFilter("all");
    setFiltros({ numero: "", ano: String(currentYear) });
  };

  const years = Array.from({ length: 4 }, (_, i) => String(currentYear - i));

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg">
            <FolderKanban className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Processos Digitais — Compras e Licitações</h1>
            <p className="text-sm text-muted-foreground">
              Protocolos da WPT (Atende.net) — integração REST oficial NT 167/2021.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as áreas</SelectItem>
              {COMPRAS_LICITACOES_PRESETS.map((p) => (
                <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" /> Filtros
          </CardTitle>
          <CardDescription>
            Por padrão lista os protocolos do ano atual filtrando por Compras/Licitações.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero">Número / protocolo</Label>
              <Input
                id="numero"
                placeholder="Ex.: 1234/2025"
                value={draftNumero}
                onChange={(e) => setDraftNumero(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assunto">Assunto, requerente ou setor</Label>
              <Input
                id="assunto"
                placeholder="Buscar por texto"
                value={draftAssunto}
                onChange={(e) => setDraftAssunto(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select value={filtros.ano} onValueChange={(v) => setFiltros((c) => ({ ...c, ano: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleApplyFilters} className="gap-2">
              <Search className="h-4 w-4" /> Aplicar
            </Button>
            <Button variant="outline" onClick={handleReset}>Limpar</Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Falha ao carregar processos</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : "Erro inesperado."}</AlertDescription>
        </Alert>
      )}

      {data?.apiMsg && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Atende.net retornou</AlertTitle>
          <AlertDescription>{data.apiMsg}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSearch className="h-4 w-4" />
            {isLoading ? "Carregando..." : `${processos.length} protocolo(s)`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : processos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum protocolo encontrado. Tente ajustar os filtros ou busque por número direto (ex: 123/2025).
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Requerente</TableHead>
                    <TableHead>Setor atual</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Abertura</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.numero}</TableCell>
                      <TableCell className="max-w-xs truncate" title={p.assunto}>{p.assunto}</TableCell>
                      <TableCell className="max-w-[180px] truncate" title={p.requerente}>{p.requerente || "—"}</TableCell>
                      <TableCell className="max-w-[180px] truncate" title={p.unidade_atual}>{p.unidade_atual || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{p.situacao}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(p.data_abertura)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm" className="gap-1">
                          <a href={p.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3" /> Abrir
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}