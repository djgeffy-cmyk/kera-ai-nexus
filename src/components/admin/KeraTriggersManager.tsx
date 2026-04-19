import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Plus, Trash2, Save, X, Power, FlaskConical, ChevronDown, ChevronUp, Flame } from "lucide-react";
import { toast } from "sonner";

type Intensity = "leve" | "medio" | "pesado";
const INTENSITY_META: Record<Intensity, { label: string; emoji: string; className: string }> = {
  leve: { label: "Leve", emoji: "🌶️", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  medio: { label: "Médio", emoji: "🌶️🌶️", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  pesado: { label: "Pesado", emoji: "🌶️🌶️🌶️", className: "bg-red-500/15 text-red-400 border-red-500/30" },
};

// Mesma lógica do edge function chat-kera (mantém em sincronia)
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const buildTriggerRegex = (t: { keywords: string; regex_pattern: string | null }): RegExp | null => {
  try {
    if (t.regex_pattern && t.regex_pattern.trim()) return new RegExp(t.regex_pattern, "i");
    const parts = t.keywords
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(escapeRegExp);
    if (!parts.length) return null;
    return new RegExp(`\\b(?:${parts.join("|")})\\b`, "i");
  } catch {
    return null;
  }
};

type Trigger = {
  id: string;
  name: string;
  keywords: string;
  regex_pattern: string | null;
  theme: string;
  scope: string;
  excluded_emails: string[];
  enabled: boolean;
  sort_order: number;
};

type Draft = Omit<Trigger, "id"> & { id?: string };

const emptyDraft = (): Draft => ({
  name: "",
  keywords: "",
  regex_pattern: "",
  theme: "",
  scope: "global",
  excluded_emails: [],
  enabled: true,
  sort_order: 100,
});

export const KeraTriggersManager = () => {
  const [items, setItems] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  // ---- Tester ----
  const [testOpen, setTestOpen] = useState(false);
  const [testText, setTestText] = useState("");
  const [testScope, setTestScope] = useState("global");
  const [testEmail, setTestEmail] = useState("");

  const testMatches = (() => {
    if (!testText.trim()) return [] as Array<{ trigger: Trigger; regexSrc: string }>;
    const email = testEmail.trim().toLowerCase();
    const out: Array<{ trigger: Trigger; regexSrc: string }> = [];
    for (const t of items) {
      if (!t.enabled) continue;
      if (t.scope !== "global" && t.scope !== testScope) continue;
      if (email && (t.excluded_emails ?? []).includes(email)) continue;
      const re = buildTriggerRegex(t);
      if (!re) continue;
      if (re.test(testText)) {
        out.push({ trigger: t, regexSrc: re.source });
      }
    }
    return out;
  })();

  const finalPromptInjection = testMatches.length
    ? `[INSTRUÇÕES DINÂMICAS — gatilhos disparados para esta mensagem]\n\n${testMatches
        .map(({ trigger }) => `### ${trigger.name}\n${trigger.theme}`)
        .join("\n\n---\n\n")}`
    : "";

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("kera_triggers")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar gatilhos: " + error.message);
    } else {
      setItems((data ?? []) as Trigger[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (t: Trigger) => {
    setEditingId(t.id);
    setDraft({
      id: t.id,
      name: t.name,
      keywords: t.keywords,
      regex_pattern: t.regex_pattern ?? "",
      theme: t.theme,
      scope: t.scope,
      excluded_emails: t.excluded_emails ?? [],
      enabled: t.enabled,
      sort_order: t.sort_order,
    });
  };

  const startNew = () => {
    setEditingId("new");
    setDraft(emptyDraft());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(emptyDraft());
  };

  const save = async () => {
    if (!draft.name.trim()) return toast.error("Nome é obrigatório.");
    if (!draft.keywords.trim()) return toast.error("Palavras-chave obrigatórias.");
    if (!draft.theme.trim()) return toast.error("Tema/instrução é obrigatório.");
    if (draft.regex_pattern && draft.regex_pattern.trim().length > 0) {
      try {
        new RegExp(draft.regex_pattern, "i");
      } catch (e) {
        return toast.error("Regex inválido: " + (e instanceof Error ? e.message : ""));
      }
    }

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      name: draft.name.trim(),
      keywords: draft.keywords.trim(),
      regex_pattern: draft.regex_pattern?.trim() || null,
      theme: draft.theme.trim(),
      scope: draft.scope.trim() || "global",
      excluded_emails: draft.excluded_emails ?? [],
      enabled: draft.enabled,
      sort_order: draft.sort_order || 100,
      updated_by: userData.user?.id ?? null,
    };

    let error;
    if (editingId === "new") {
      ({ error } = await supabase.from("kera_triggers").insert(payload));
    } else {
      ({ error } = await supabase
        .from("kera_triggers")
        .update(payload)
        .eq("id", editingId!));
    }
    setSaving(false);
    if (error) return toast.error("Falha ao salvar: " + error.message);
    toast.success(editingId === "new" ? "Gatilho criado." : "Gatilho atualizado.");
    cancelEdit();
    load();
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Remover gatilho "${name}"?`)) return;
    const { error } = await supabase.from("kera_triggers").delete().eq("id", id);
    if (error) return toast.error("Falha ao remover: " + error.message);
    toast.success("Gatilho removido.");
    load();
  };

  const toggleEnabled = async (t: Trigger) => {
    const { error } = await supabase
      .from("kera_triggers")
      .update({ enabled: !t.enabled })
      .eq("id", t.id);
    if (error) return toast.error("Falha: " + error.message);
    load();
  };

  const editingDraft = editingId !== null;

  return (
    <section className="pt-4 border-t border-border space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target className="size-5 text-primary" />
          <h2 className="font-display text-xl text-glow">Gatilhos da Kera</h2>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={testOpen ? "secondary" : "outline"}
            onClick={() => setTestOpen((v) => !v)}
          >
            <FlaskConical className="size-4 mr-1" />
            Testar
            {testOpen ? <ChevronUp className="size-3 ml-1" /> : <ChevronDown className="size-3 ml-1" />}
          </Button>
          {!editingDraft && (
            <Button size="sm" onClick={startNew}>
              <Plus className="size-4 mr-1" /> Novo gatilho
            </Button>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Quando alguma palavra-chave aparece numa mensagem do usuário, a Kera injeta o tema (zoeira) na resposta.
        Use <code className="text-xs">scope=global</code> pra valer em qualquer chat, ou <code className="text-xs">agent:kera-nutri</code> pra restringir a um agente.
      </p>

      {testOpen && (
        <Card className="p-4 space-y-3 border-accent/40 bg-accent/5">
          <div className="flex items-center gap-2">
            <FlaskConical className="size-4 text-accent" />
            <h3 className="font-medium text-sm">Simulador de gatilhos</h3>
          </div>
          <div>
            <Label className="text-xs">Frase do usuário</Label>
            <Textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Ex: o que você acha do rodrigo? e da tania regina?"
              className="min-h-[60px]"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Escopo simulado</Label>
              <Input
                value={testScope}
                onChange={(e) => setTestScope(e.target.value)}
                placeholder="global  ou  agent:kera-nutri"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Gatilhos <code>global</code> sempre entram. Os de outro escopo só batem se igualar aqui.
              </p>
            </div>
            <div>
              <Label className="text-xs">Email do usuário (opcional)</Label>
              <Input
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="fulano@guaramirim.sc.gov.br"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se o email estiver na lista de excluídos do gatilho, ele não dispara.
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">
                Gatilhos disparados:{" "}
                <Badge variant={testMatches.length ? "default" : "outline"}>
                  {testMatches.length}
                </Badge>
              </Label>
            </div>
            {testText.trim() && testMatches.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                Nenhum gatilho deu match com essa frase.
              </p>
            )}
            {testMatches.map(({ trigger, regexSrc }) => (
              <Card key={trigger.id} className="p-3 border-primary/30 bg-primary/5">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge>{trigger.name}</Badge>
                  <Badge variant="outline" className="text-xs">{trigger.scope}</Badge>
                </div>
                <p className="text-xs font-mono text-muted-foreground break-all">
                  /{regexSrc}/i
                </p>
                <p className="text-xs mt-2 line-clamp-3 whitespace-pre-wrap">
                  {trigger.theme}
                </p>
              </Card>
            ))}
          </div>

          {finalPromptInjection && (
            <div>
              <Label className="text-xs">Trecho injetado no system prompt</Label>
              <Textarea
                readOnly
                value={finalPromptInjection}
                className="min-h-[160px] font-mono text-xs leading-relaxed bg-background"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Esse bloco é anexado ao system prompt da Kera quando essa frase chega.
              </p>
            </div>
          )}
        </Card>
      )}
      <p className="text-sm text-muted-foreground">
        Quando alguma palavra-chave aparece numa mensagem do usuário, a Kera injeta o tema (zoeira) na resposta.
        Use <code className="text-xs">scope=global</code> pra valer em qualquer chat, ou <code className="text-xs">agent:kera-nutri</code> pra restringir a um agente.
      </p>

      {editingDraft && (
        <Card className="p-4 space-y-3 border-primary/40">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ex: Rodrigo"
              />
            </div>
            <div>
              <Label className="text-xs">Ordem (sort)</Label>
              <Input
                type="number"
                value={draft.sort_order}
                onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Palavras-chave (separadas por vírgula)</Label>
            <Input
              value={draft.keywords}
              onChange={(e) => setDraft({ ...draft, keywords: e.target.value })}
              placeholder="rodrigo, professor linguiça"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Match de palavra inteira, case-insensitive. Se preencher regex abaixo, este campo vira só referência.
            </p>
          </div>

          <div>
            <Label className="text-xs">Regex avançado (opcional, sem barras)</Label>
            <Input
              className="font-mono text-xs"
              value={draft.regex_pattern ?? ""}
              onChange={(e) => setDraft({ ...draft, regex_pattern: e.target.value })}
              placeholder="\brodrig[oa]\b|\bprofessor linguiç?a\b"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Vazio = usa as palavras-chave acima. Flags fixas: <code>i</code>.
            </p>
          </div>

          <div>
            <Label className="text-xs">Tema / instrução enviada pra Kera</Label>
            <Textarea
              value={draft.theme}
              onChange={(e) => setDraft({ ...draft, theme: e.target.value })}
              placeholder="**TEMA-CHAVE:** ... &#10;Inspirações:&#10;- frase 1&#10;- frase 2"
              className="min-h-[160px] font-mono text-xs leading-relaxed"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Markdown. Use <strong>TEMA-CHAVE</strong> + lista de inspirações (a Kera varia automaticamente).
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Escopo</Label>
              <Input
                value={draft.scope}
                onChange={(e) => setDraft({ ...draft, scope: e.target.value })}
                placeholder="global  ou  agent:kera-nutri"
              />
            </div>
            <div>
              <Label className="text-xs">Emails excluídos (separados por vírgula)</Label>
              <Input
                value={(draft.excluded_emails ?? []).join(", ")}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    excluded_emails: e.target.value
                      .split(",")
                      .map((s) => s.trim().toLowerCase())
                      .filter(Boolean),
                  })
                }
                placeholder="dj.geffy@gmail.com"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={draft.enabled}
              onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
            />
            <Label className="text-xs">Ativo</Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
              <X className="size-4 mr-1" /> Cancelar
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              <Save className="size-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Nenhum gatilho cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {items.map((t) => (
            <Card key={t.id} className={`p-3 ${!t.enabled ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium">{t.name}</h3>
                    <Badge variant="outline" className="text-xs">{t.scope}</Badge>
                    {!t.enabled && <Badge variant="secondary" className="text-xs">desativado</Badge>}
                    {t.excluded_emails?.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        excl: {t.excluded_emails.length}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    <span className="text-foreground/70">keywords:</span> {t.keywords}
                  </p>
                  {t.regex_pattern && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate font-mono">
                      <span className="text-foreground/70">regex:</span> {t.regex_pattern}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {t.theme.replace(/[*#`]/g, "")}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => toggleEnabled(t)}
                    title={t.enabled ? "Desativar" : "Ativar"}
                    className="size-8"
                  >
                    <Power className={`size-4 ${t.enabled ? "text-primary" : "text-muted-foreground"}`} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(t)}>
                    Editar
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(t.id, t.name)}
                    className="size-8 text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
};
