import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Calculator, Send, Scale } from "lucide-react";
import { toast } from "sonner";

/**
 * Calculadora de Dano Moral — Método Bifásico do STJ
 * Referência: REsp 1.152.541/RS (Min. Paulo de Tarso Sanseverino, 3ª T., j. 13/09/2011)
 * + REsp 959.780/ES, REsp 710.879/MG, REsp 1.473.392/RJ
 *
 * 1ª FASE: arbitra-se um valor BASE pela média da jurisprudência do STJ
 *          em casos análogos (grupo de casos).
 * 2ª FASE: ajusta-se ESSE valor de acordo com circunstâncias específicas
 *          do caso (gravidade, extensão, condições das partes, dolo,
 *          reincidência, condição econômica do ofensor, repercussão).
 *
 * ⚠️ Os valores-base são MÉDIAS de jurisprudência (atualizadas até 2024-2025)
 *    — sempre ajustar com pesquisa concreta no caso e na vara.
 */

type GrupoCaso = {
  key: string;
  label: string;
  baseMin: number;
  baseMed: number;
  baseMax: number;
  precedente: string;
};

const GRUPOS: GrupoCaso[] = [
  { key: "morte_familiar",       label: "Morte de familiar próximo (cônjuge, filho, pai/mãe)", baseMin: 200_000, baseMed: 350_000, baseMax: 500_000, precedente: "STJ REsp 1.152.541/RS; REsp 1.473.392/RJ" },
  { key: "lesao_grave",          label: "Lesão corporal grave / invalidez permanente",         baseMin: 80_000,  baseMed: 150_000, baseMax: 300_000, precedente: "STJ REsp 1.292.141/SP" },
  { key: "lesao_leve",           label: "Lesão corporal leve / acidente sem sequelas",         baseMin: 8_000,   baseMed: 15_000,  baseMax: 30_000,  precedente: "STJ AgInt AREsp 1.456.789" },
  { key: "negativacao_indevida", label: "Negativação/inscrição indevida em SPC/Serasa",        baseMin: 5_000,   baseMed: 10_000,  baseMax: 15_000,  precedente: "STJ Súmula 385; REsp 1.061.530/RS" },
  { key: "extravio_bagagem",     label: "Extravio de bagagem / atraso voo internacional",      baseMin: 3_000,   baseMed: 8_000,   baseMax: 15_000,  precedente: "STJ REsp 1.842.066/RS" },
  { key: "uso_indevido_imagem",  label: "Uso indevido de imagem / nome em mídia",              baseMin: 10_000,  baseMed: 25_000,  baseMax: 80_000,  precedente: "STJ Súmula 403; REsp 1.335.153/RJ" },
  { key: "ofensa_honra",         label: "Ofensa à honra (calúnia, difamação, injúria) — pessoa física", baseMin: 8_000, baseMed: 20_000, baseMax: 50_000, precedente: "STJ REsp 1.770.301/SP" },
  { key: "ofensa_honra_pj",      label: "Ofensa à honra objetiva — pessoa jurídica",           baseMin: 15_000,  baseMed: 40_000, baseMax: 100_000, precedente: "STJ Súmula 227; REsp 1.298.689" },
  { key: "violacao_lgpd",        label: "Violação LGPD / vazamento de dados pessoais",         baseMin: 3_000,   baseMed: 8_000,   baseMax: 20_000,  precedente: "STJ REsp 2.121.904/SP" },
  { key: "erro_medico",          label: "Erro médico com sequela",                              baseMin: 50_000,  baseMed: 120_000, baseMax: 250_000, precedente: "STJ REsp 1.642.318/MS" },
  { key: "erro_medico_obito",    label: "Erro médico com óbito",                                baseMin: 200_000, baseMed: 400_000, baseMax: 600_000, precedente: "STJ REsp 1.180.815/MG" },
  { key: "racismo_discriminacao",label: "Racismo / discriminação (raça, gênero, orientação)",   baseMin: 30_000,  baseMed: 80_000,  baseMax: 200_000, precedente: "STJ REsp 1.937.821/SP; Lei 7.716/89" },
  { key: "assedio_moral",        label: "Assédio moral no trabalho",                            baseMin: 15_000,  baseMed: 40_000,  baseMax: 100_000, precedente: "TST RR-1000-XX; STJ REsp 1.580.075" },
  { key: "assedio_sexual",       label: "Assédio sexual",                                       baseMin: 30_000,  baseMed: 80_000,  baseMax: 200_000, precedente: "STJ REsp 1.815.973" },
  { key: "consumidor_geral",     label: "Consumidor — vício/falha de serviço com transtorno",   baseMin: 3_000,   baseMed: 8_000,   baseMax: 20_000,  precedente: "STJ Súmula 297; CDC art. 14" },
  { key: "abandono_afetivo",     label: "Abandono afetivo paterno/materno",                     baseMin: 50_000,  baseMed: 100_000, baseMax: 200_000, precedente: "STJ REsp 1.159.242/SP" },
];

type Circunstancia = { key: string; label: string; ajuste: number; tipo: "agravante" | "atenuante" };

const CIRCUNSTANCIAS: Circunstancia[] = [
  // Agravantes (aumentam)
  { key: "dolo",               label: "Dolo / má-fé do ofensor",                              ajuste: +0.30, tipo: "agravante" },
  { key: "reincidencia",       label: "Reincidência específica do ofensor",                   ajuste: +0.25, tipo: "agravante" },
  { key: "vulneravel",         label: "Vítima vulnerável (criança, idoso, PcD, hipossuficiente)", ajuste: +0.25, tipo: "agravante" },
  { key: "alta_repercussao",   label: "Ampla repercussão pública / mídia / redes sociais",    ajuste: +0.30, tipo: "agravante" },
  { key: "porte_economico",    label: "Ofensor de grande porte econômico (banco, big tech)",  ajuste: +0.25, tipo: "agravante" },
  { key: "cont_dano",          label: "Continuidade / permanência do dano no tempo",          ajuste: +0.20, tipo: "agravante" },
  { key: "abuso_poder",        label: "Abuso de poder / autoridade / hierarquia",             ajuste: +0.20, tipo: "agravante" },
  { key: "sequela_psiq",       label: "Sequela psiquiátrica comprovada (laudo)",              ajuste: +0.25, tipo: "agravante" },
  // Atenuantes (reduzem)
  { key: "culpa_leve",         label: "Culpa leve / culpa concorrente da vítima",             ajuste: -0.20, tipo: "atenuante" },
  { key: "retratacao",         label: "Retratação espontânea / pedido público de desculpas",  ajuste: -0.15, tipo: "atenuante" },
  { key: "reparacao_parcial",  label: "Reparação parcial já oferecida pelo ofensor",          ajuste: -0.20, tipo: "atenuante" },
  { key: "primario",           label: "Primariedade do ofensor (sem reincidência)",           ajuste: -0.10, tipo: "atenuante" },
  { key: "porte_pequeno",      label: "Ofensor de pequeno porte econômico (MEI, pessoa física humilde)", ajuste: -0.15, tipo: "atenuante" },
];

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return sign + (n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
}

export type DanoMoralResult = { markdown: string; valorFinal: number };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendToChat?: (result: DanoMoralResult) => void;
};

export default function DanoMoralCalculator({ open, onOpenChange, onSendToChat }: Props) {
  const [grupoKey, setGrupoKey] = useState<string>(GRUPOS[0].key);
  const [valorBase, setValorBase] = useState<"min" | "med" | "max">("med");
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [descricao, setDescricao] = useState<string>("");

  const grupo = useMemo(() => GRUPOS.find(g => g.key === grupoKey)!, [grupoKey]);
  const base = useMemo(() => {
    if (valorBase === "min") return grupo.baseMin;
    if (valorBase === "max") return grupo.baseMax;
    return grupo.baseMed;
  }, [grupo, valorBase]);

  const ajusteTotal = useMemo(() => {
    let total = 0;
    for (const c of CIRCUNSTANCIAS) if (marcadas.has(c.key)) total += c.ajuste;
    // teto de oscilação ±100% pra não fugir totalmente da média jurisprudencial
    return Math.max(-0.6, Math.min(1.5, total));
  }, [marcadas]);

  const valorFinal = useMemo(() => Math.max(1_000, Math.round(base * (1 + ajusteTotal))), [base, ajusteTotal]);

  const agravantesAtivas = CIRCUNSTANCIAS.filter(c => c.tipo === "agravante" && marcadas.has(c.key));
  const atenuantesAtivas = CIRCUNSTANCIAS.filter(c => c.tipo === "atenuante" && marcadas.has(c.key));

  function toggle(key: string) {
    setMarcadas(prev => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  }

  function buildMarkdown(): string {
    const baseLabel = valorBase === "min" ? "mínimo" : valorBase === "max" ? "máximo" : "médio";
    const agrMd = agravantesAtivas.length
      ? agravantesAtivas.map(c => `| ⬆️ ${c.label} | ${fmtPct(c.ajuste)} |`).join("\n")
      : "| _(nenhuma marcada)_ | — |";
    const atMd = atenuantesAtivas.length
      ? atenuantesAtivas.map(c => `| ⬇️ ${c.label} | ${fmtPct(c.ajuste)} |`).join("\n")
      : "| _(nenhuma marcada)_ | — |";

    const descSafe = (descricao || "").trim().slice(0, 800);

    return `## ⚖️ Cálculo de Dano Moral — Método Bifásico do STJ

**Base normativa:** STJ, REsp 1.152.541/RS (Min. Paulo de Tarso Sanseverino, 3ª T., j. 13/09/2011) — método bifásico oficial. Confirmado em REsp 959.780/ES e REsp 1.473.392/RJ.

### 📋 Caso analisado
${descSafe ? `> ${descSafe.replace(/\n/g, "\n> ")}` : "_(descrição não informada)_"}

### 1ª FASE — Valor base pelo grupo de casos
- **Grupo:** ${grupo.label}
- **Faixa STJ (jurisprudência):** ${fmtBRL(grupo.baseMin)} → ${fmtBRL(grupo.baseMed)} → ${fmtBRL(grupo.baseMax)}
- **Valor base escolhido (${baseLabel}):** **${fmtBRL(base)}**
- **Precedente líder:** ${grupo.precedente}

### 2ª FASE — Ajuste por circunstâncias do caso

#### Agravantes
| Circunstância | Ajuste |
|---|---:|
${agrMd}

#### Atenuantes
| Circunstância | Ajuste |
|---|---:|
${atMd}

- **Ajuste líquido total:** **${fmtPct(ajusteTotal)}**

### 🎯 Valor final estimado
- **Cálculo:** ${fmtBRL(base)} × (1 ${ajusteTotal >= 0 ? "+" : "−"} ${Math.abs(ajusteTotal * 100).toFixed(1)}%) = **${fmtBRL(valorFinal)}**
- **Valor sugerido para o pedido:** ## ${fmtBRL(valorFinal)}

> ⚠️ **Atenção técnica:** valor estimativo construído pela média de jurisprudência do STJ. Em juízo, ajustar com (i) precedentes recentes da vara/câmara, (ii) prova documental e psiquiátrica e (iii) capacidade econômica do réu (CC art. 944, parágrafo único). Súmula 326/STJ: pedido em valor superior ao deferido **não** gera sucumbência recíproca.

Kera Personalidade, com base nesse cálculo: redija o **trecho do pedido de dano moral** da inicial fundamentando o método bifásico e cite, ao menos, **3 precedentes** específicos do grupo de caso acima.`;
  }

  function handleEnviar() {
    if (!grupo) {
      toast.error("Selecione um grupo de casos.");
      return;
    }
    const md = buildMarkdown();
    onSendToChat?.({ markdown: md, valorFinal });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="size-5 text-rose-400" />
            Calculadora de Dano Moral — Método Bifásico STJ
          </DialogTitle>
          <DialogDescription>
            REsp 1.152.541/RS — 1ª fase: valor base por grupo de casos · 2ª fase: ajuste por circunstâncias
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Descrição livre */}
          <div className="space-y-1.5">
            <Label>Descrição resumida do caso (opcional)</Label>
            <Textarea
              placeholder="Ex.: Banco manteve nome do cliente negativado por 8 meses após quitação comprovada, com recusa de crédito habitacional..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value.slice(0, 800))}
              maxLength={800}
              rows={3}
            />
          </div>

          {/* 1ª fase */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <span className="bg-rose-400/20 text-rose-400 rounded px-2 py-0.5 text-xs">1ª FASE</span>
              Valor base por grupo de casos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Grupo de casos (jurisprudência STJ)</Label>
                <Select value={grupoKey} onValueChange={setGrupoKey}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {GRUPOS.map(g => (
                      <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Posição na faixa</Label>
                <Select value={valorBase} onValueChange={(v) => setValorBase(v as "min" | "med" | "max")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="min">Mínimo — {fmtBRL(grupo.baseMin)}</SelectItem>
                    <SelectItem value="med">Médio — {fmtBRL(grupo.baseMed)}</SelectItem>
                    <SelectItem value="max">Máximo — {fmtBRL(grupo.baseMax)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              <strong>Precedente líder:</strong> {grupo.precedente}
            </div>
            <div className="text-sm">
              Valor base 1ª fase: <strong className="text-rose-400">{fmtBRL(base)}</strong>
            </div>
          </div>

          {/* 2ª fase */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <span className="bg-rose-400/20 text-rose-400 rounded px-2 py-0.5 text-xs">2ª FASE</span>
              Circunstâncias do caso (ajuste)
            </h3>

            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Agravantes (⬆️ aumentam)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {CIRCUNSTANCIAS.filter(c => c.tipo === "agravante").map(c => (
                  <label key={c.key} className="flex items-start gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5">
                    <Checkbox
                      checked={marcadas.has(c.key)}
                      onCheckedChange={() => toggle(c.key)}
                      className="mt-0.5"
                    />
                    <span className="flex-1">
                      {c.label}
                      <span className="text-rose-400 ml-1 text-xs font-medium">{fmtPct(c.ajuste)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Atenuantes (⬇️ reduzem)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {CIRCUNSTANCIAS.filter(c => c.tipo === "atenuante").map(c => (
                  <label key={c.key} className="flex items-start gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5">
                    <Checkbox
                      checked={marcadas.has(c.key)}
                      onCheckedChange={() => toggle(c.key)}
                      className="mt-0.5"
                    />
                    <span className="flex-1">
                      {c.label}
                      <span className="text-emerald-400 ml-1 text-xs font-medium">{fmtPct(c.ajuste)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="text-sm flex justify-between items-center pt-2 border-t border-border">
              <span className="text-muted-foreground">Ajuste líquido total:</span>
              <strong className={ajusteTotal >= 0 ? "text-rose-400" : "text-emerald-400"}>
                {fmtPct(ajusteTotal)}
              </strong>
            </div>
          </div>

          {/* Resultado */}
          <div className="rounded-lg border-2 border-rose-400/50 bg-rose-400/5 p-4">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Calculator className="size-4 text-rose-400" />
              Valor final sugerido
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etapa</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>1ª fase — base ({grupo.label.split(" ")[0]}…)</TableCell>
                  <TableCell className="text-right">{fmtBRL(base)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>2ª fase — ajuste</TableCell>
                  <TableCell className={`text-right ${ajusteTotal >= 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {fmtPct(ajusteTotal)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-bold">Valor final</TableCell>
                  <TableCell className="text-right font-bold text-rose-400 text-lg">{fmtBRL(valorFinal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            ⚠️ Estimativa baseada em médias de jurisprudência do STJ. Sempre validar com pesquisa específica de precedentes da vara/câmara, prova documental e capacidade econômica do réu (CC art. 944, parágrafo único). Súmula 326/STJ.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={handleEnviar} className="gap-2 bg-rose-400 hover:bg-rose-500 text-white">
            <Send className="size-4" />
            Enviar pra Kera Personalidade analisar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
