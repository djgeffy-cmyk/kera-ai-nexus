import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Radar, Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Target = {
  id: string;
  label: string;
  url: string;
  enabled: boolean;
};

const DEFAULT_SEED: Array<Pick<Target, "label" | "url">> = [
  { label: "Portal da Prefeitura", url: "https://www.guaramirim.sc.gov.br" },
  { label: "IPM Atende.Net", url: "https://guaramirim.atende.net" },
  { label: "Webmail (Google)", url: "https://mail.google.com" },
];

export const MonitorTargetsManager = () => {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (userId) load();
  }, [userId]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("monitor_targets")
      .select("id,label,url,enabled")
      .order("created_at", { ascending: true });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setTargets((data || []) as Target[]);
    setLoading(false);
  };

  const seedDefaults = async () => {
    if (!userId) return;
    const rows = DEFAULT_SEED.map(s => ({ ...s, user_id: userId, enabled: true }));
    const { error } = await supabase.from("monitor_targets").insert(rows);
    if (error) return toast.error(error.message);
    toast.success("URLs padrão adicionadas");
    load();
  };

  const add = async () => {
    if (!userId) return;
    const label = newLabel.trim();
    let url = newUrl.trim();
    if (!label || !url) return toast.error("Preencha rótulo e URL");
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    const { error } = await supabase
      .from("monitor_targets")
      .insert({ user_id: userId, label, url, enabled: true });
    if (error) return toast.error(error.message);
    setNewLabel("");
    setNewUrl("");
    toast.success("URL adicionada");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("monitor_targets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setTargets(prev => prev.filter(t => t.id !== id));
  };

  const toggle = async (t: Target) => {
    const { error } = await supabase
      .from("monitor_targets")
      .update({ enabled: !t.enabled })
      .eq("id", t.id);
    if (error) return toast.error(error.message);
    setTargets(prev => prev.map(x => x.id === t.id ? { ...x, enabled: !t.enabled } : x));
  };

  return (
    <section className="pt-4 border-t border-border space-y-4">
      <div className="flex items-center gap-2">
        <Radar className="size-5 text-emerald-400" />
        <h2 className="font-display text-xl text-glow">URLs do Sentinela</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Cadastre as URLs públicas que o agente <span className="text-emerald-400">Sentinela</span> deve verificar
        ao clicar em "Verificar status dos sistemas". Apenas alvos ativados são checados.
      </p>

      {loading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : targets.length === 0 ? (
        <Card className="p-4 border-dashed border-border bg-secondary/20">
          <p className="text-sm text-muted-foreground mb-3">
            Você ainda não cadastrou nenhuma URL. Quer começar com as padrão (Prefeitura + IPM + Webmail)?
          </p>
          <Button size="sm" variant="outline" onClick={seedDefaults}>
            <Plus className="size-4 mr-1" /> Adicionar URLs padrão
          </Button>
        </Card>
      ) : (
        <div className="grid gap-2">
          {targets.map(t => (
            <Card key={t.id} className="p-3 border-border flex items-center gap-3">
              <Switch checked={t.enabled} onCheckedChange={() => toggle(t)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{t.label}</p>
                <a
                  href={t.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary truncate flex items-center gap-1"
                >
                  {t.url} <ExternalLink className="size-3 shrink-0" />
                </a>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => remove(t.id)}
                className="size-8 text-muted-foreground hover:text-destructive shrink-0"
                aria-label="Remover"
              >
                <Trash2 className="size-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-3 border-border space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Adicionar nova URL</p>
        <div className="grid sm:grid-cols-[1fr_2fr_auto] gap-2">
          <Input
            placeholder="Rótulo (ex: Portal SEFAZ)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            className="bg-input/40"
          />
          <Input
            placeholder="https://exemplo.gov.br"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            className="bg-input/40"
          />
          <Button onClick={add} className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40">
            <Plus className="size-4 mr-1" /> Adicionar
          </Button>
        </div>
      </Card>
    </section>
  );
};
