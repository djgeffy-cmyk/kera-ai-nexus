import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Calculator, Send } from "lucide-react";
import { toast } from "sonner";

/**
 * Calculadora ITCMD/SC — Lei Estadual 13.136/2004
 *
 * Alíquotas progressivas vigentes em SC (causa mortis e doação),
 * conforme Lei 13.136/2004 art. 9º (com redação dada por leis posteriores):
 *   • até R$ 20.000           → 1%
 *   • R$ 20.001 a R$ 50.000   → 3%
 *   • R$ 50.001 a R$ 150.000  → 5%
 *   • R$ 150.001 a R$ 500.000 → 7%
 *   • acima de R$ 500.000     → 8%
 *
 * ⚠️ Confirme alíquotas e isenções vigentes no portal da SEF/SC antes de protocolar.
 */

type Bem = {
  id: string;
  descricao: string;
  valor: number; // R$
};

type Herdeiro = {
  id: string;
  nome: string;
  cota: number; // fração (0..1)
};

type TipoTransmissao = "causa_mortis" | "doacao";

type Faixa = { ate: number; aliquota: number };

const FAIXAS_SC: Faixa[] = [
  { ate: 20_000, aliquota: 0.01 },
  { ate: 50_000, aliquota: 0.03 },
  { ate: 150_000, aliquota: 0.05 },
  { ate: 500_000, aliquota: 0.07 },
  { ate: Infinity, aliquota: 0.08 },
];

function aliquotaPorBase(base: number): number {
  for (const f of FAIXAS_SC) {
    if (base <= f.ate) return f.aliquota;
  }
  return 0.08;
}

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPct(n: number): string {
  return (n * 100).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + "%";
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Limites defensivos contra entrada abusiva
const MAX_DESC = 200;
const MAX_NOME = 120;
const MAX_VALOR = 1_000_000_000_000; // R$ 1 trilhão
const MAX_LINHAS = 60;

export type ItcmdResult = { markdown: string; total: number };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** callback opcional pra injetar o resultado como mensagem no chat */
  onSendToChat?: (result: ItcmdResult) => void;
};

export default function ItcmdSCCalculator({ open, onOpenChange, onSendToChat }: Props) {
  const [tipo, setTipo] = useState<TipoTransmissao>("causa_mortis");
  const [meacao, setMeacao] = useState<boolean>(false); // true = abater 50% do monte (cônjuge meeiro em comunhão)
  const [bens, setBens] = useState<Bem[]>([{ id: newId(), descricao: "", valor: 0 }]);
  const [herdeiros, setHerdeiros] = useState<Herdeiro[]>([
    { id: newId(), nome: "", cota: 1 },
  ]);

  const monteMor = useMemo(() => bens.reduce((s, b) => s + (Number.isFinite(b.valor) ? b.valor : 0), 0), [bens]);
  const baseTributavel = useMemo(() => (meacao ? monteMor / 2 : monteMor), [monteMor, meacao]);
  const somaCotas = useMemo(() => herdeiros.reduce((s, h) => s + (Number.isFinite(h.cota) ? h.cota : 0), 0), [herdeiros]);

  const linhas = useMemo(() => {
    return herdeiros.map((h) => {
      const fracao = somaCotas > 0 ? h.cota / somaCotas : 0;
      const quinhao = baseTributavel * fracao;
      const aliq = aliquotaPorBase(quinhao);
      const imposto = quinhao * aliq;
      return { ...h, fracao, quinhao, aliq, imposto };
    });
  }, [herdeiros, baseTributavel, somaCotas]);

  const totalImposto = useMemo(() => linhas.reduce((s, l) => s + l.imposto, 0), [linhas]);

  function addBem() {
    if (bens.length >= MAX_LINHAS) {
      toast.error(`Máximo de ${MAX_LINHAS} bens.`);
      return;
    }
    setBens((prev) => [...prev, { id: newId(), descricao: "", valor: 0 }]);
  }
  function rmBem(id: string) {
    setBens((prev) => (prev.length > 1 ? prev.filter((b) => b.id !== id) : prev));
  }
  function updBem(id: string, patch: Partial<Bem>) {
    setBens((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const next = { ...b, ...patch };
        if (typeof next.descricao === "string") next.descricao = next.descricao.slice(0, MAX_DESC);
        if (typeof next.valor === "number") {
          if (!Number.isFinite(next.valor) || next.valor < 0) next.valor = 0;
          if (next.valor > MAX_VALOR) next.valor = MAX_VALOR;
        }
        return next;
      }),
    );
  }

  function addHerdeiro() {
    if (herdeiros.length >= MAX_LINHAS) {
      toast.error(`Máximo de ${MAX_LINHAS} herdeiros.`);
      return;
    }
    setHerdeiros((prev) => [...prev, { id: newId(), nome: "", cota: 1 }]);
  }
  function rmHerdeiro(id: string) {
    setHerdeiros((prev) => (prev.length > 1 ? prev.filter((h) => h.id !== id) : prev));
  }
  function updHerdeiro(id: string, patch: Partial<Herdeiro>) {
    setHerdeiros((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const next = { ...h, ...patch };
        if (typeof next.nome === "string") next.nome = next.nome.slice(0, MAX_NOME);
        if (typeof next.cota === "number") {
          if (!Number.isFinite(next.cota) || next.cota < 0) next.cota = 0;
          if (next.cota > 1_000_000) next.cota = 1_000_000;
        }
        return next;
      }),
    );
  }

  function buildMarkdown(): string {
    const tipoLabel = tipo === "causa_mortis" ? "Causa mortis (inventário)" : "Doação inter vivos";
    const linhasMd = linhas
      .map((l, i) => {
        const nome = (l.nome || `Herdeiro ${i + 1}`).replace(/\|/g, "\\|");
        return `| ${nome} | ${fmtPct(l.fracao)} | ${fmtBRL(l.quinhao)} | ${fmtPct(l.aliq)} | **${fmtBRL(l.imposto)}** |`;
      })
      .join("\n");

    const bensMd = bens
      .filter((b) => (b.descricao || "").trim() || b.valor > 0)
      .map((b, i) => {
        const desc = (b.descricao || `Bem ${i + 1}`).replace(/\|/g, "\\|");
        return `| ${desc} | ${fmtBRL(b.valor)} |`;
      })
      .join("\n");

    return `## 🧮 Cálculo ITCMD/SC — ${tipoLabel}

**Base normativa:** Lei Estadual 13.136/2004 (SC), art. 9º — alíquotas progressivas. CTN art. 35+ (causa mortis) / art. 38 (doação).

### Bens declarados
| Descrição | Valor |
|---|---:|
${bensMd || "| _(nenhum bem informado)_ | — |"}

- **Monte-mor:** ${fmtBRL(monteMor)}
- **Meação do cônjuge:** ${meacao ? "sim — abatidos 50%" : "não aplicada"}
- **Base tributável:** ${fmtBRL(baseTributavel)}

### Partilha e ITCMD por herdeiro
| Herdeiro | Fração | Quinhão | Alíquota | ITCMD devido |
|---|---:|---:|---:|---:|
${linhasMd}

### Totais
- **ITCMD total estimado:** **${fmtBRL(totalImposto)}**
- **Carga efetiva sobre a base:** ${baseTributavel > 0 ? fmtPct(totalImposto / baseTributavel) : "—"}

> ⚠️ Cálculo estimativo. Confirme alíquotas, isenções (CC art. 1.711 — bem de família, EPD, valor de pequena monta), eventual redutor por doações anteriores e o **prazo de 60 dias** para abertura do inventário (CPC art. 611) no portal da **SEF/SC**. Deve ser revisado por advogado(a) e contador.

Kera Sucessões, com base nesse quadro: avalie viabilidade de **inventário extrajudicial** (Provimento 149/CNJ), proponha **estratégia de pagamento do ITCMD** (à vista × parcelado × bem entregue em pagamento) e aponte se há **doações em vida a colacionar** (CC art. 2.002).`;
  }

  function handleEnviar() {
    if (monteMor <= 0) {
      toast.error("Informe ao menos um bem com valor maior que zero.");
      return;
    }
    if (somaCotas <= 0) {
      toast.error("Informe ao menos um herdeiro com cota maior que zero.");
      return;
    }
    const md = buildMarkdown();
    onSendToChat?.({ markdown: md, total: totalImposto });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="size-5 text-yellow-500" />
            Calculadora ITCMD/SC
          </DialogTitle>
          <DialogDescription>
            Lei Estadual 13.136/2004 — alíquotas progressivas (1% a 8%). Estimativa para apoio à Kera Sucessões.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Tipo + meação */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo de transmissão</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoTransmissao)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="causa_mortis">Causa mortis (inventário)</SelectItem>
                  <SelectItem value="doacao">Doação inter vivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cônjuge/companheiro meeiro?</Label>
              <Select value={meacao ? "sim" : "nao"} onValueChange={(v) => setMeacao(v === "sim")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao">Não — base = monte-mor</SelectItem>
                  <SelectItem value="sim">Sim — abater 50% (meação)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Bens do espólio / da doação</h3>
              <Button type="button" variant="outline" size="sm" onClick={addBem}>
                <Plus className="size-4 mr-1" /> Bem
              </Button>
            </div>
            <div className="space-y-2">
              {bens.map((b, i) => (
                <div key={b.id} className="grid grid-cols-12 gap-2 items-center">
                  <Input
                    className="col-span-7"
                    placeholder={`Descrição (ex.: Imóvel matr. 1234, Veículo, Conta CEF)`}
                    value={b.descricao}
                    maxLength={MAX_DESC}
                    onChange={(e) => updBem(b.id, { descricao: e.target.value })}
                  />
                  <Input
                    className="col-span-4"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder="Valor (R$)"
                    value={b.valor || ""}
                    onChange={(e) => updBem(b.id, { valor: parseFloat(e.target.value) || 0 })}
                  />
                  <Button
                    type="button" variant="ghost" size="icon"
                    className="col-span-1 text-destructive hover:text-destructive"
                    onClick={() => rmBem(b.id)}
                    disabled={bens.length <= 1}
                    aria-label={`Remover bem ${i + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Monte-mor: <strong>{fmtBRL(monteMor)}</strong> · Base tributável: <strong>{fmtBRL(baseTributavel)}</strong>
            </div>
          </div>

          {/* Herdeiros */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Herdeiros / donatários</h3>
              <Button type="button" variant="outline" size="sm" onClick={addHerdeiro}>
                <Plus className="size-4 mr-1" /> Herdeiro
              </Button>
            </div>
            <div className="space-y-2">
              {herdeiros.map((h, i) => (
                <div key={h.id} className="grid grid-cols-12 gap-2 items-center">
                  <Input
                    className="col-span-8"
                    placeholder={`Nome do herdeiro ${i + 1}`}
                    value={h.nome}
                    maxLength={MAX_NOME}
                    onChange={(e) => updHerdeiro(h.id, { nome: e.target.value })}
                  />
                  <Input
                    className="col-span-3"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder="Cota (peso)"
                    value={h.cota || ""}
                    onChange={(e) => updHerdeiro(h.id, { cota: parseFloat(e.target.value) || 0 })}
                  />
                  <Button
                    type="button" variant="ghost" size="icon"
                    className="col-span-1 text-destructive hover:text-destructive"
                    onClick={() => rmHerdeiro(h.id)}
                    disabled={herdeiros.length <= 1}
                    aria-label={`Remover herdeiro ${i + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Cotas são pesos relativos (ex.: 1, 1, 2 = 25% / 25% / 50%). Soma atual: {somaCotas.toLocaleString("pt-BR")}
            </div>
          </div>

          {/* Resultado */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <h3 className="font-semibold text-sm mb-2">Resultado preliminar</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Herdeiro</TableHead>
                  <TableHead className="text-right">Fração</TableHead>
                  <TableHead className="text-right">Quinhão</TableHead>
                  <TableHead className="text-right">Alíquota</TableHead>
                  <TableHead className="text-right">ITCMD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l, i) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.nome || `Herdeiro ${i + 1}`}</TableCell>
                    <TableCell className="text-right">{fmtPct(l.fracao)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(l.quinhao)}</TableCell>
                    <TableCell className="text-right">{fmtPct(l.aliq)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtBRL(l.imposto)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end mt-3 text-sm">
              <span className="text-muted-foreground mr-2">ITCMD total estimado:</span>
              <strong className="text-yellow-500">{fmtBRL(totalImposto)}</strong>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            ⚠️ Estimativa. Lei 13.136/2004 SC art. 9º. Confirme isenções, redutores e prazo de 60 dias (CPC art. 611) no portal da SEF/SC. Revisar com advogado(a) e contador.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={handleEnviar} className="gap-2">
            <Send className="size-4" />
            Enviar pra Kera Sucessões analisar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}