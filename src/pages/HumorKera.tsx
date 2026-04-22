import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Flame, Loader2, Smile } from "lucide-react";
import { toast } from "sonner";

type Intensity = "leve" | "medio" | "pesado";

type Trigger = {
  id: string;
  name: string;
  keywords: string;
  theme: string;
  scope: string;
  intensity: Intensity;
  enabled: boolean;
  sort_order: number;
};

const INTENSITY_META: Record<Intensity, { label: string; emoji: string; className: string }> = {
  leve: { label: "Leve", emoji: "🌶️", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  medio: { label: "Médio", emoji: "🌶️🌶️", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  pesado: { label: "Pesado", emoji: "🌶️🌶️🌶️", className: "bg-red-500/15 text-red-400 border-red-500/30" },
};

/**
 * /humor — cada usuário liga/desliga as zoeiras (gatilhos) da Kera na própria conta.
 * - Lista os gatilhos cadastrados pelo admin (kera_triggers).
 * - Default = LIGADO. Quando o usuário desliga, grava `enabled=false` em
 *   user_trigger_preferences (uma linha por gatilho/conta).
 * - O backend (chat-kera) cruza isso e suprime os gatilhos desligados nessa conta.
 */
const HumorKera = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  // Set com IDs de triggers DESLIGADOS pelo usuário
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session) {
          navigate("/auth", { replace: true });
          return;
        }
        const userId = sess.session.user.id;

        // Triggers globais (admin gerencia). Visível pra qualquer authenticated? Não — RLS
        // atual da kera_triggers é admin-only. Vamos ler via edge function pública dedicada.
        const [trigRes, prefRes] = await Promise.all([
          supabase.functions.invoke("list-kera-triggers"),
          supabase
            .from("user_trigger_preferences")
            .select("trigger_id, enabled")
            .eq("user_id", userId),
        ]);

        if (cancelled) return;

        if (trigRes.error) throw trigRes.error;
        const list = (trigRes.data?.triggers || []) as Trigger[];
        setTriggers(list.sort((a, b) => a.sort_order - b.sort_order));

        if (prefRes.error) throw prefRes.error;
        const off = new Set<string>(
          (prefRes.data || [])
            .filter((p: { enabled: boolean }) => !p.enabled)
            .map((p: { trigger_id: string }) => p.trigger_id),
        );
        setDisabledIds(off);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error("Erro ao carregar humor: " + msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const totals = useMemo(() => {
    const total = triggers.length;
    const off = triggers.filter((t) => disabledIds.has(t.id)).length;
    return { total, off, on: total - off };
  }, [triggers, disabledIds]);

  const toggle = async (trigger: Trigger, enabled: boolean) => {
    setSaving(trigger.id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (!userId) throw new Error("Sessão expirada");

      const { error } = await supabase
        .from("user_trigger_preferences")
        .upsert(
          { user_id: userId, trigger_id: trigger.id, enabled },
          { onConflict: "user_id,trigger_id" },
        );
      if (error) throw error;

      setDisabledIds((prev) => {
        const next = new Set(prev);
        if (enabled) next.delete(trigger.id);
        else next.add(trigger.id);
        return next;
      });
      toast.success(enabled ? `"${trigger.name}" ligado` : `"${trigger.name}" desligado`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Erro: " + msg);
    } finally {
      setSaving(null);
    }
  };

  const toggleAll = async (enabled: boolean) => {
    setSaving("__all__");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (!userId) throw new Error("Sessão expirada");

      const rows = triggers.map((t) => ({
        user_id: userId,
        trigger_id: t.id,
        enabled,
      }));
      const { error } = await supabase
        .from("user_trigger_preferences")
        .upsert(rows, { onConflict: "user_id,trigger_id" });
      if (error) throw error;

      setDisabledIds(enabled ? new Set() : new Set(triggers.map((t) => t.id)));
      toast.success(enabled ? "Todas as zoeiras ligadas" : "Todas as zoeiras desligadas");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Erro: " + msg);
    } finally {
      setSaving(null);
    }
  };

  return (
    <main className="min-h-screen bg-background p-4 sm:p-6 max-w-3xl mx-auto">
      <header className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="font-display text-2xl text-glow flex items-center gap-2">
            <Smile className="size-6 text-primary" /> Humor da Kera
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Liga e desliga as zoeiras pessoais que aparecem nas suas conversas. Vale só pra sua conta.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <Card className="p-4 mb-4 flex items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-medium">
                {totals.on} ligadas · {totals.off} desligadas
              </div>
              <div className="text-xs text-muted-foreground">
                Total de {totals.total} zoeira{totals.total === 1 ? "" : "s"} cadastrada
                {totals.total === 1 ? "" : "s"}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={saving !== null || totals.off === 0}
                onClick={() => toggleAll(true)}
              >
                Ligar todas
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={saving !== null || totals.on === 0}
                onClick={() => toggleAll(false)}
              >
                Desligar todas
              </Button>
            </div>
          </Card>

          <div className="space-y-2">
            {triggers.length === 0 && (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma zoeira cadastrada pelo admin ainda.
              </Card>
            )}
            {triggers.map((t) => {
              const isOn = !disabledIds.has(t.id);
              const meta = INTENSITY_META[t.intensity];
              const isSaving = saving === t.id;
              return (
                <Card key={t.id} className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{t.name}</span>
                      <Badge variant="outline" className={meta.className}>
                        <Flame className="size-3 mr-1" />
                        {meta.emoji} {meta.label}
                      </Badge>
                      {t.scope !== "global" && (
                        <Badge variant="outline" className="text-xs">
                          {t.scope.replace("agent:", "")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      Palavras-chave: <span className="font-mono">{t.keywords}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isSaving && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                    <Switch
                      checked={isOn}
                      disabled={isSaving || saving === "__all__"}
                      onCheckedChange={(v) => toggle(t, v)}
                      aria-label={`Ativar zoeira ${t.name}`}
                    />
                  </div>
                </Card>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground mt-6 text-center">
            Quem cadastra as zoeiras é o admin. Aqui você só escolhe quais valem pra você.
          </p>
        </>
      )}
    </main>
  );
};

export default HumorKera;