import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { HardHat, Plus, Trash2, Save, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Municipio {
  id: string;
  nome: string;
  uf: string;
  cidade_id: number;
  slug: string | null;
  notes: string | null;
  enabled: boolean;
}

/** Sugestões iniciais a partir dos municípios já encontrados no portal-gevo. */
const PRESETS: Array<Omit<Municipio, "id">> = [
  { nome: "Massaranduba", uf: "SC", cidade_id: 4900, slug: "massaranduba", notes: "Portal GEVO público.", enabled: true },
  { nome: "Jaraguá do Sul", uf: "SC", cidade_id: 4938, slug: "jaragua", notes: "Portal GEVO público.", enabled: true },
  { nome: "Pato Branco", uf: "PR", cidade_id: 4520, slug: "pato-branco", notes: "Portal GEVO público.", enabled: true },
];

const PORTAL_URL = (cidadeId: number) =>
  `https://www.engegov.net.br/portal-gevo/dashboard.xhtml?cidade=${cidadeId}`;

export const EngegovMunicipiosManager = () => {
  const [items, setItems] = useState<Municipio[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<Municipio, "id">>({
    nome: "",
    uf: "",
    cidade_id: 0,
    slug: null,
    notes: null,
    enabled: true,
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("engegov_municipios")
      .select("*")
      .order("nome", { ascending: true });
    if (error) toast.error("Erro ao carregar: " + error.message);
    else setItems((data ?? []) as Municipio[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async (payload: Omit<Municipio, "id">) => {
    if (!payload.nome.trim() || !payload.uf.trim() || !payload.cidade_id) {
      toast.error("Nome, UF e cidade_id são obrigatórios");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("engegov_municipios").insert({
      ...payload,
      uf: payload.uf.toUpperCase(),
      created_by: userData.user?.id ?? null,
    });
    if (error) return toast.error("Erro: " + error.message);
    toast.success(`${payload.nome}/${payload.uf} cadastrado`);
    setDraft({ nome: "", uf: "", cidade_id: 0, slug: null, notes: null, enabled: true });
    load();
  };

  const update = async (id: string, patch: Partial<Municipio>) => {
    const { error } = await supabase.from("engegov_municipios").update(patch).eq("id", id);
    if (error) return toast.error("Erro: " + error.message);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este município?")) return;
    const { error } = await supabase.from("engegov_municipios").delete().eq("id", id);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Removido");
    load();
  };

  const testar = async (m: Municipio) => {
    setTesting(m.id);
    try {
      const { data, error } = await supabase.functions.invoke("engegov-query", {
        body: { tipo: "lista", cidade_id: m.cidade_id, force_refresh: true },
      });
      if (error) throw error;
      const obras = (data as { links_obras?: string[] })?.links_obras?.length ?? 0;
      toast.success(`${m.nome}: ${obras} link(s) de obras encontrados`);
    } catch (e: unknown) {
      toast.error("Falha: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setTesting(null);
    }
  };

  return (
    <section className="pt-4 border-t border-border space-y-4">
      <div className="flex items-center gap-2">
        <HardHat className="size-5 text-primary" />
        <h2 className="font-display text-xl text-glow">EngeGov — Municípios</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Cadastre as cidades atendidas pelo portal <code className="text-primary">engegov.net.br/portal-gevo</code>.
        A <span className="text-primary">Kera EngeGov</span> consulta obras (lista e detalhes) por nome do município.
        O <code>cidade_id</code> aparece no final da URL do dashboard (ex.: <code>?cidade=4900</code>).
      </p>

      {items.length === 0 && !loading && (
        <Card className="p-4 border-dashed">
          <p className="text-sm font-medium mb-2">Sugestões prontas:</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button key={p.cidade_id} size="sm" variant="outline" onClick={() => create(p)}>
                <Plus className="size-3 mr-1" /> {p.nome}/{p.uf}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid gap-3">
          {items.map((it) => (
            <Card key={it.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <HardHat className="size-4 text-primary shrink-0" />
                    <Input
                      value={it.nome}
                      onChange={(e) => setItems((arr) => arr.map(x => x.id === it.id ? { ...x, nome: e.target.value } : x))}
                      onBlur={(e) => update(it.id, { nome: e.target.value })}
                      className="h-8 text-sm font-medium flex-1 min-w-0"
                    />
                    <Badge variant="outline" className="text-[10px]">{it.uf}</Badge>
                    <Badge className="bg-primary/15 text-primary border border-primary/40 text-[10px]">
                      cidade={it.cidade_id}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={PORTAL_URL(it.cidade_id)}
                      target="_blank" rel="noreferrer"
                      className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                    >
                      <ExternalLink className="size-3" /> Abrir portal
                    </a>
                    <Button
                      size="sm" variant="outline" className="h-7 text-xs"
                      onClick={() => testar(it)} disabled={testing === it.id}
                    >
                      <RefreshCw className={`size-3 mr-1 ${testing === it.id ? "animate-spin" : ""}`} />
                      Testar consulta
                    </Button>
                  </div>
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
              <div>
                <Label className="text-xs">Notas</Label>
                <Textarea
                  value={it.notes ?? ""}
                  onChange={(e) => setItems((arr) => arr.map(x => x.id === it.id ? { ...x, notes: e.target.value } : x))}
                  onBlur={(e) => update(it.id, { notes: e.target.value })}
                  className="min-h-[50px] text-xs"
                  placeholder="Observações internas"
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-4 border-primary/30 space-y-3">
        <div className="flex items-center gap-2">
          <Plus className="size-4 text-primary" />
          <h3 className="font-medium text-sm">Adicionar novo município</h3>
        </div>
        <div className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Nome (ex: Guaramirim)"
              value={draft.nome}
              onChange={(e) => setDraft({ ...draft, nome: e.target.value })}
              className="h-9"
            />
            <Input
              placeholder="UF"
              maxLength={2}
              value={draft.uf}
              onChange={(e) => setDraft({ ...draft, uf: e.target.value.toUpperCase() })}
              className="h-9 uppercase"
            />
          </div>
          <Input
            type="number"
            placeholder="cidade_id (ex: 4900) — pega no final da URL do portal"
            value={draft.cidade_id || ""}
            onChange={(e) => setDraft({ ...draft, cidade_id: parseInt(e.target.value) || 0 })}
            className="h-9 font-mono"
          />
          <Textarea
            placeholder="Notas (opcional)"
            value={draft.notes ?? ""}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            className="min-h-[50px] text-xs"
          />
          <Button onClick={() => create(draft)} className="w-full">
            <Save className="size-4 mr-2" /> Salvar município
          </Button>
        </div>
      </Card>
    </section>
  );
};