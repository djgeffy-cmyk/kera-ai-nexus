import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, KeyRound, Plus, Trash2, Save, Database } from "lucide-react";
import { toast } from "sonner";

type Kind = "public" | "authenticated" | "transparency";
type AuthType = "none" | "bearer" | "apikey" | "basic";

interface IpmEndpoint {
  id: string;
  label: string;
  base_url: string;
  kind: Kind;
  auth_type: AuthType;
  token: string | null;
  notes: string | null;
  enabled: boolean;
}

const PRESETS: Array<Omit<IpmEndpoint, "id">> = [
  {
    label: "Guaramirim · atende.net (público)",
    base_url: "https://guaramirim.atende.net",
    kind: "public",
    auth_type: "none",
    token: null,
    notes: "Portal IPM público da Prefeitura de Guaramirim. Use para protocolos, licitações, transparência.",
    enabled: true,
  },
  {
    label: "Portal Transparência Guaramirim",
    base_url: "https://guaramirim.atende.net/transparencia",
    kind: "transparency",
    auth_type: "none",
    token: null,
    notes: "Receitas, despesas, folha, licitações, contratos. Sem autenticação.",
    enabled: true,
  },
];

export const IpmEndpointsManager = () => {
  const [items, setItems] = useState<IpmEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Omit<IpmEndpoint, "id">>({
    label: "",
    base_url: "",
    kind: "public",
    auth_type: "none",
    token: null,
    notes: null,
    enabled: true,
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ipm_endpoints")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar: " + error.message);
    else setItems((data ?? []) as IpmEndpoint[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async (payload: Omit<IpmEndpoint, "id">) => {
    if (!payload.label.trim() || !payload.base_url.trim()) {
      toast.error("Label e URL base são obrigatórios");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("ipm_endpoints").insert({
      ...payload,
      token: payload.auth_type === "none" ? null : payload.token,
      created_by: userData.user?.id ?? null,
    });
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Endpoint adicionado");
    setDraft({ label: "", base_url: "", kind: "public", auth_type: "none", token: null, notes: null, enabled: true });
    load();
  };

  const update = async (id: string, patch: Partial<IpmEndpoint>) => {
    const { error } = await supabase.from("ipm_endpoints").update(patch).eq("id", id);
    if (error) return toast.error("Erro: " + error.message);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este endpoint?")) return;
    const { error } = await supabase.from("ipm_endpoints").delete().eq("id", id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Removido");
    load();
  };

  const seedPreset = async (preset: Omit<IpmEndpoint, "id">) => {
    await create(preset);
  };

  return (
    <section className="pt-4 border-t border-border space-y-4">
      <div className="flex items-center gap-2">
        <Database className="size-5 text-primary" />
        <h2 className="font-display text-xl text-glow">APIs IPM / atende.net</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Cadastre as URLs base e (quando necessário) tokens das APIs da IPM Sistemas.
        A Kera pode consultar protocolos, licitações e dados de transparência usando esses endpoints.
      </p>

      {items.length === 0 && !loading && (
        <Card className="p-4 border-dashed">
          <p className="text-sm font-medium mb-2">Sugestões prontas pra Guaramirim:</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button key={p.label} size="sm" variant="outline" onClick={() => seedPreset(p)}>
                <Plus className="size-3 mr-1" /> {p.label}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {/* Lista */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid gap-3">
          {items.map((it) => (
            <Card key={it.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Globe className="size-4 text-primary shrink-0" />
                    <Input
                      value={it.label}
                      onChange={(e) => setItems((arr) => arr.map(x => x.id === it.id ? { ...x, label: e.target.value } : x))}
                      onBlur={(e) => update(it.id, { label: e.target.value })}
                      className="h-8 text-sm font-medium flex-1 min-w-0"
                    />
                    <Badge variant={it.kind === "transparency" ? "secondary" : "outline"} className="text-[10px]">
                      {it.kind}
                    </Badge>
                    {it.auth_type !== "none" && (
                      <Badge className="bg-primary/15 text-primary border border-primary/40 text-[10px]">
                        <KeyRound className="size-2.5 mr-1" /> {it.auth_type}
                      </Badge>
                    )}
                  </div>
                  <Input
                    value={it.base_url}
                    onChange={(e) => setItems((arr) => arr.map(x => x.id === it.id ? { ...x, base_url: e.target.value } : x))}
                    onBlur={(e) => update(it.id, { base_url: e.target.value })}
                    className="h-8 text-xs mt-2 font-mono"
                    placeholder="https://..."
                  />
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Switch
                    checked={it.enabled}
                    onCheckedChange={(v) => update(it.id, { enabled: v })}
                  />
                  <Button size="icon" variant="ghost" onClick={() => remove(it.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={it.kind} onValueChange={(v: Kind) => update(it.id, { kind: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Público</SelectItem>
                      <SelectItem value="authenticated">Autenticado</SelectItem>
                      <SelectItem value="transparency">Transparência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Autenticação</Label>
                  <Select value={it.auth_type} onValueChange={(v: AuthType) => update(it.id, { auth_type: v, token: v === "none" ? null : it.token })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      <SelectItem value="bearer">Bearer Token</SelectItem>
                      <SelectItem value="apikey">API Key</SelectItem>
                      <SelectItem value="basic">Basic Auth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {it.auth_type !== "none" && (
                <div>
                  <Label className="text-xs">
                    Token / Chave {it.auth_type === "basic" && "(formato user:senha)"}
                  </Label>
                  <Input
                    type="password"
                    value={it.token ?? ""}
                    onChange={(e) => setItems((arr) => arr.map(x => x.id === it.id ? { ...x, token: e.target.value } : x))}
                    onBlur={(e) => update(it.id, { token: e.target.value })}
                    className="h-8 text-xs font-mono"
                    placeholder="Cole o token aqui..."
                  />
                </div>
              )}

              <div>
                <Label className="text-xs">Notas</Label>
                <Textarea
                  value={it.notes ?? ""}
                  onChange={(e) => setItems((arr) => arr.map(x => x.id === it.id ? { ...x, notes: e.target.value } : x))}
                  onBlur={(e) => update(it.id, { notes: e.target.value })}
                  className="min-h-[60px] text-xs"
                  placeholder="Endpoints específicos, escopo, etc."
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Form novo */}
      <Card className="p-4 border-primary/30 space-y-3">
        <div className="flex items-center gap-2">
          <Plus className="size-4 text-primary" />
          <h3 className="font-medium text-sm">Adicionar novo endpoint</h3>
        </div>
        <div className="grid gap-2">
          <Input
            placeholder="Label (ex: API Protocolos Guaramirim)"
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            className="h-9"
          />
          <Input
            placeholder="https://guaramirim.atende.net/api/..."
            value={draft.base_url}
            onChange={(e) => setDraft({ ...draft, base_url: e.target.value })}
            className="h-9 font-mono text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <Select value={draft.kind} onValueChange={(v: Kind) => setDraft({ ...draft, kind: v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Público</SelectItem>
                <SelectItem value="authenticated">Autenticado</SelectItem>
                <SelectItem value="transparency">Transparência</SelectItem>
              </SelectContent>
            </Select>
            <Select value={draft.auth_type} onValueChange={(v: AuthType) => setDraft({ ...draft, auth_type: v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Auth" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem autenticação</SelectItem>
                <SelectItem value="bearer">Bearer Token</SelectItem>
                <SelectItem value="apikey">API Key</SelectItem>
                <SelectItem value="basic">Basic Auth</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {draft.auth_type !== "none" && (
            <Input
              type="password"
              placeholder="Token / Chave"
              value={draft.token ?? ""}
              onChange={(e) => setDraft({ ...draft, token: e.target.value })}
              className="h-9 font-mono text-xs"
            />
          )}
          <Textarea
            placeholder="Notas (opcional): endpoints específicos, escopo da chave, etc."
            value={draft.notes ?? ""}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            className="min-h-[60px] text-xs"
          />
          <Button onClick={() => create(draft)} className="w-full">
            <Save className="size-4 mr-2" /> Salvar endpoint
          </Button>
        </div>
      </Card>
    </section>
  );
};
