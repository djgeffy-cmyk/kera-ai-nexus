import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Send } from "lucide-react";
import { toast } from "sonner";

/**
 * Gerador de requerimento de ATA NOTARIAL — Provimento 100/CNJ + arts. 384 CPC e 7º, III, Lei 8.935/94.
 *
 * Monta uma minuta pronta pra protocolar no tabelionato preservando conteúdo
 * digital volátil (post, story, site, vídeo, conversa) que servirá como prova.
 */

type TipoConteudo =
  | "post_rede_social"
  | "story_efemero"
  | "video_youtube"
  | "site_pagina"
  | "conversa_whatsapp"
  | "email"
  | "comentario"
  | "outro";

const TIPOS: Record<TipoConteudo, string> = {
  post_rede_social: "Publicação em rede social (Instagram, X, Facebook, TikTok, LinkedIn)",
  story_efemero: "Story / Status efêmero (Instagram, WhatsApp)",
  video_youtube: "Vídeo (YouTube, Vimeo, TikTok, Reels)",
  site_pagina: "Página de site / blog / portal de notícias",
  conversa_whatsapp: "Conversa de WhatsApp / Telegram / Direct",
  email: "E-mail recebido / enviado",
  comentario: "Comentário em publicação alheia",
  outro: "Outro conteúdo digital",
};

const MAX_DESC = 2000;
const MAX_NOME = 200;
const MAX_FATOS = 1500;

export type AtaNotarialResult = { markdown: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendToChat?: (result: AtaNotarialResult) => void;
};

function fmtDataExtenso(iso: string): string {
  if (!iso) return "___ de ____________ de 20__";
  try {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

function hojeISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function AtaNotarialGenerator({ open, onOpenChange, onSendToChat }: Props) {
  const [requerente, setRequerente] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [tipo, setTipo] = useState<TipoConteudo>("post_rede_social");
  const [url, setUrl] = useState("");
  const [autorConteudo, setAutorConteudo] = useState("");
  const [dataConstatacao, setDataConstatacao] = useState(hojeISO());
  const [descricao, setDescricao] = useState("");
  const [finalidade, setFinalidade] = useState("");
  const [tabelionato, setTabelionato] = useState("");
  const [cidade, setCidade] = useState("");
  const [presencial, setPresencial] = useState<"sim" | "nao">("nao");

  const valido = useMemo(() => {
    return requerente.trim().length > 2 && url.trim().length > 5 && descricao.trim().length > 10;
  }, [requerente, url, descricao]);

  function buildMarkdown(): string {
    const cidadeLabel = cidade || "____________________";
    const tabLabel = tabelionato || `Cartório do ___º Tabelionato de Notas de ${cidadeLabel}/SC`;
    const dataExt = fmtDataExtenso(dataConstatacao);
    const finalidadeTxt = finalidade.trim() || "instruir ação judicial de reparação de danos morais e materiais por violação a direitos da personalidade (CC arts. 11 a 21), bem como eventual ação inibitória e de remoção de conteúdo, servindo como prova pré-constituída do conteúdo no momento da constatação.";

    const modo = presencial === "sim"
      ? "presencialmente, no tabelionato, mediante exibição do conteúdo em equipamento próprio do tabelião e/ou do requerente"
      : "remotamente, nos termos do **Provimento 100/CNJ**, por videoconferência com o tabelião, com acesso simultâneo ao conteúdo digital indicado";

    return `## 📜 REQUERIMENTO DE ATA NOTARIAL — Provimento 100/CNJ

**Para pedir à Kera Personalidade:** revise o requerimento abaixo, ajuste qualificação completa e protocole no tabelionato. Cite **CPC art. 384** e **art. 7º, III, da Lei 8.935/94**.

---

**EXMO. SR. TABELIÃO DE NOTAS DO ${tabLabel.toUpperCase()}**

**${(requerente || "_________________________").toUpperCase()}**${cpfCnpj ? `, inscrito(a) no CPF/CNPJ sob o nº **${cpfCnpj}**` : ""}${endereco ? `, residente e domiciliado(a) em ${endereco}` : ""}, vem, respeitosamente, à presença de Vossa Senhoria, com fundamento no **art. 7º, inciso III, da Lei nº 8.935/1994**, no **art. 384 do Código de Processo Civil** e no **Provimento nº 100/2020 do Conselho Nacional de Justiça**, **REQUERER A LAVRATURA DE ATA NOTARIAL** com a finalidade de constatar, descrever e preservar o conteúdo digital adiante especificado, pelos motivos de fato e de direito a seguir expostos.

### I — DOS FATOS

1. O requerente tomou conhecimento da existência, na rede mundial de computadores, do seguinte conteúdo digital, cujo teor reputa **lesivo aos seus direitos da personalidade** e que carece de **preservação imediata**, sob pena de exclusão, edição ou desaparecimento espontâneo:

   - **Tipo de conteúdo:** ${TIPOS[tipo]}
   - **URL/endereço:** \`${url || "____________________"}\`
   ${autorConteudo ? `- **Suposto autor/perfil responsável:** ${autorConteudo}` : ""}
   - **Data e hora pretendidas para a constatação:** ${dataExt}, no horário a ser designado pelo tabelionato.

2. O conteúdo, conforme melhor descrição abaixo, possui natureza **volátil**, podendo ser apagado, editado ou ocultado a qualquer momento pelo seu autor ou pela plataforma hospedeira, o que justifica a **urgência** da lavratura.

### II — DESCRIÇÃO DO CONTEÚDO A SER PRESERVADO

${descricao || "_(Descreva aqui, com riqueza de detalhes, o que deve ser constatado: textos exibidos, imagens, número de curtidas/visualizações, comentários, data de publicação aparente, identificação do perfil, etc.)_"}

### III — DOS PEDIDOS À AUTORIDADE NOTARIAL

Diante do exposto, requer a Vossa Senhoria que se digne a **lavrar ata notarial** ${modo}, certificando, com fé pública (CC art. 215; Lei 8.935/94, art. 3º):

a) o **acesso à URL** indicada no item I, com registro do **endereço completo da página**, do **horário do acesso** e do **endereço IP/dispositivo** utilizado, quando aplicável;

b) a **descrição minuciosa** de todo o conteúdo visível na tela no momento do acesso — textos, imagens, vídeos, número de interações, comentários, data e hora de publicação visíveis e quaisquer elementos identificadores do(s) autor(es);

c) a **captura de tela (print) e/ou gravação de vídeo** do conteúdo, com anexação dos arquivos à ata na forma do **art. 7º, § 1º, do Provimento 100/CNJ**, preferencialmente com **hash criptográfico (SHA-256)** dos arquivos para garantia de integridade;

d) **navegação por links internos** relacionados (perfil do autor, comentários, respostas, threads), preservando-se também esse conteúdo conexo na medida do possível;

e) a **entrega de via física** e **via eletrônica assinada digitalmente** (ICP-Brasil) da ata ao requerente.

### IV — DA FINALIDADE

A presente ata destina-se a ${finalidadeTxt}

### V — DO RECOLHIMENTO

Declara o requerente estar ciente dos **emolumentos** devidos conforme a tabela vigente do TJSC para atos notariais (Lei Estadual 17.654/2018 SC e regulamentos), comprometendo-se ao seu pagamento na forma e prazo do tabelionato.

${cidadeLabel}, ${dataExt}.

\\
\\
\\
**______________________________________________**
${(requerente || "_________________________")}
${cpfCnpj ? `CPF/CNPJ: ${cpfCnpj}` : "CPF/CNPJ: ________________"}

---

> ⚠️ **Checklist antes de protocolar:**
> - [ ] Confirmar com o tabelionato se aceitam atendimento por **videoconferência** (Provimento 100/CNJ).
> - [ ] Levar **documento de identidade** original.
> - [ ] Não acessar/editar o conteúdo previamente para não alterar contadores (curtidas, visualizações).
> - [ ] Pedir **hash SHA-256** dos arquivos anexados — fortalece a prova judicial.
> - [ ] Solicitar via eletrônica assinada (ICP-Brasil) para juntar como PDF na petição inicial.

**Kera Personalidade**, com base nesta minuta: revise a qualificação, sugira **3 perguntas adicionais** que o tabelião deve constatar para esse caso específico, e indique qual **vara/competência** será mais adequada para a futura ação reparatória.`;
  }

  function handleEnviar() {
    if (!valido) {
      toast.error("Preencha ao menos requerente, URL e descrição do conteúdo.");
      return;
    }
    onSendToChat?.({ markdown: buildMarkdown() });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-rose-400" />
            Gerar Ata Notarial — Provimento 100/CNJ
          </DialogTitle>
          <DialogDescription>
            Monta requerimento ao tabelião para preservar conteúdo digital como prova (CPC art. 384; Lei 8.935/94 art. 7º, III).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Qualificação */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Requerente (nome completo / razão social)*</Label>
              <Input
                placeholder="Ex.: João da Silva"
                value={requerente}
                maxLength={MAX_NOME}
                onChange={(e) => setRequerente(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>CPF / CNPJ</Label>
              <Input
                placeholder="000.000.000-00"
                value={cpfCnpj}
                maxLength={20}
                onChange={(e) => setCpfCnpj(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Endereço</Label>
              <Input
                placeholder="Rua, nº, bairro, cidade/UF"
                value={endereco}
                maxLength={MAX_NOME}
                onChange={(e) => setEndereco(e.target.value)}
              />
            </div>
          </div>

          {/* Conteúdo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo de conteúdo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoConteudo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPOS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data da constatação*</Label>
              <Input
                type="date"
                value={dataConstatacao}
                onChange={(e) => setDataConstatacao(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>URL / endereço completo*</Label>
              <Input
                placeholder="https://..."
                value={url}
                maxLength={1000}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Suposto autor / perfil responsável</Label>
              <Input
                placeholder="@perfil_no_instagram, nome do canal, etc."
                value={autorConteudo}
                maxLength={MAX_NOME}
                onChange={(e) => setAutorConteudo(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição detalhada do conteúdo a preservar*</Label>
            <Textarea
              placeholder="Ex.: Publicação contendo a frase '...' acompanhada de fotografia do requerente sem autorização, com 1.234 curtidas e 87 comentários, datada de 10/04/2026..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value.slice(0, MAX_DESC))}
              maxLength={MAX_DESC}
              rows={5}
            />
            <p className="text-[11px] text-muted-foreground">{descricao.length}/{MAX_DESC} caracteres</p>
          </div>

          <div className="space-y-1.5">
            <Label>Finalidade da ata (opcional)</Label>
            <Textarea
              placeholder="Padrão: instruir ação de reparação por danos morais e materiais. Personalize se for outro fim (ação penal privada, queixa-crime, ação inibitória, etc.)"
              value={finalidade}
              onChange={(e) => setFinalidade(e.target.value.slice(0, MAX_FATOS))}
              maxLength={MAX_FATOS}
              rows={2}
            />
          </div>

          {/* Tabelionato */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Tabelionato (opcional)</Label>
              <Input
                placeholder="Ex.: 1º Tabelionato de Notas de Florianópolis"
                value={tabelionato}
                maxLength={MAX_NOME}
                onChange={(e) => setTabelionato(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade/UF</Label>
              <Input
                placeholder="Florianópolis/SC"
                value={cidade}
                maxLength={100}
                onChange={(e) => setCidade(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 md:col-span-3">
              <Label>Modalidade</Label>
              <Select value={presencial} onValueChange={(v) => setPresencial(v as "sim" | "nao")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao">Remota — videoconferência (Provimento 100/CNJ)</SelectItem>
                  <SelectItem value="sim">Presencial — comparecimento ao tabelionato</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            ⚠️ A ata notarial é prova pré-constituída (CPC art. 384). Não acesse/edite o conteúdo antes da lavratura — qualquer interação altera contadores e pode comprometer a prova. Solicite hash SHA-256 dos anexos.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={handleEnviar} disabled={!valido} className="gap-2 bg-rose-400 hover:bg-rose-500 text-white">
            <Send className="size-4" />
            Enviar minuta pra Kera Personalidade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
