import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Brain, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

export const KeraPromptEditor = () => {
  const [prompt, setPrompt] = useState("");
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("kera_settings")
        .select("system_prompt")
        .eq("singleton", true)
        .maybeSingle();
      if (error) {
        toast.error("Erro ao carregar prompt: " + error.message);
      } else {
        const p = data?.system_prompt ?? "";
        setPrompt(p);
        setOriginal(p);
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("kera_settings")
      .update({ system_prompt: prompt, updated_by: userData.user?.id ?? null })
      .eq("singleton", true);
    setSaving(false);
    if (error) {
      toast.error("Falha ao salvar: " + error.message);
      return;
    }
    setOriginal(prompt);
    toast.success("Prompt da Kera atualizado.");
  };

  const restoreDefault = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("kera_settings")
      .update({ system_prompt: "" })
      .eq("singleton", true);
    setSaving(false);
    if (error) {
      toast.error("Falha ao restaurar: " + error.message);
      return;
    }
    setPrompt("");
    setOriginal("");
    toast.success("Prompt restaurado para o padrão do código.");
  };

  const dirty = prompt !== original;

  return (
    <section className="pt-4 border-t border-border space-y-3">
      <div className="flex items-center gap-2">
        <Brain className="size-5 text-primary" />
        <h2 className="font-display text-xl text-glow">Personalidade da Kera</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        System prompt usado em todas as conversas. Deixe vazio para usar o padrão do código (Kera mal-humorada).
        Mudanças entram em vigor na próxima mensagem enviada.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <Card className="p-3 space-y-3">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Vazio = usa o prompt padrão do código (Kera mal-humorada com regras + ferramenta ipm_query)."
            className="min-h-[280px] font-mono text-xs leading-relaxed"
            disabled={saving}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {prompt.length.toLocaleString("pt-BR")} caracteres
              {dirty && <span className="ml-2 text-primary">• não salvo</span>}
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={restoreDefault}
                disabled={saving || (prompt === "" && original === "")}
              >
                <RotateCcw className="size-4 mr-1" /> Usar padrão do código
              </Button>
              <Button size="sm" onClick={save} disabled={saving || !dirty}>
                <Save className="size-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </section>
  );
};
