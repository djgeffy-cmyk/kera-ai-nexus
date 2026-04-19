import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Mic2, Plus, Trash2, Volume2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Fix = {
  id: string;
  word: string;
  replacement: string;
  case_sensitive: boolean;
  whole_word: boolean;
  enabled: boolean;
  notes: string | null;
};

const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts-kera`;

export function PronunciationFixesManager() {
  const [fixes, setFixes] = useState<Fix[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [form, setForm] = useState({
    word: "",
    replacement: "",
    case_sensitive: false,
    whole_word: true,
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pronunciation_fixes")
      .select("*")
      .order("word", { ascending: true });
    if (error) toast.error("Falha ao carregar correções: " + error.message);
    else setFixes((data || []) as Fix[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.word.trim() || !form.replacement.trim()) {
      toast.error("Palavra e grafia fonética são obrigatórias.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("pronunciation_fixes").insert({
      word: form.word.trim(),
      replacement: form.replacement.trim(),
      case_sensitive: form.case_sensitive,
      whole_word: form.whole_word,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Correção adicionada.");
    setForm({ word: "", replacement: "", case_sensitive: false, whole_word: true, notes: "" });
    load();
  };

  const toggle = async (id: string, enabled: boolean) => {
    const { error } = await supabase.from("pronunciation_fixes").update({ enabled }).eq("id", id);
    if (error) toast.error(error.message);
    else setFixes(prev => prev.map(f => f.id === id ? { ...f, enabled } : f));
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta correção?")) return;
    const { error } = await supabase.from("pronunciation_fixes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setFixes(prev => prev.filter(f => f.id !== id));
    toast.success("Removida.");
  };

  const preview = async (text: string, id: string) => {
    setPreviewing(id);
    try {
      const r = await fetch(TTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (e) {
      toast.error("Falha ao pré-ouvir: " + (e instanceof Error ? e.message : "erro"));
    } finally {
      setPreviewing(null);
    }
  };

  return (
    <section className="pt-4 border-t border-border space-y-4">
      <div className="flex items-center gap-2">
        <Mic2 className="size-5 text-primary" />
        <h2 className="font-display text-xl text-glow">Correções de pronúncia (TTS)</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        A Kera substitui essas palavras por suas grafias fonéticas <strong>antes</strong> de enviar pro TTS.
        Útil pra nomes que o sintetizador erra (ex: <code className="text-primary">Geverson → Guêverson</code>).
      </p>

      <Card className="p-4 space-y-3 border-border">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="pf-word">Palavra original</Label>
            <Input
              id="pf-word"
              placeholder="Geverson"
              value={form.word}
              onChange={e => setForm({ ...form, word: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pf-rep">Grafia fonética</Label>
            <Input
              id="pf-rep"
              placeholder="Guêverson"
              value={form.replacement}
              onChange={e => setForm({ ...form, replacement: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="pf-notes">Anotações (opcional)</Label>
          <Textarea
            id="pf-notes"
            rows={2}
            placeholder="Por que essa correção existe?"
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={form.whole_word}
              onCheckedChange={v => setForm({ ...form, whole_word: v })}
            />
            Palavra inteira
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={form.case_sensitive}
              onCheckedChange={v => setForm({ ...form, case_sensitive: v })}
            />
            Diferenciar maiúsc./minúsc.
          </label>
          <Button onClick={add} disabled={saving} className="ml-auto">
            <Plus className="size-4 mr-1" /> Adicionar
          </Button>
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : fixes.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Nenhuma correção cadastrada.</p>
      ) : (
        <div className="grid gap-2">
          {fixes.map(f => (
            <Card key={f.id} className="p-3 border-border flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm">{f.word}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-mono text-sm text-primary">{f.replacement}</span>
                  {f.whole_word && <Badge variant="outline" className="text-[10px]">palavra inteira</Badge>}
                  {f.case_sensitive && <Badge variant="outline" className="text-[10px]">case-sensitive</Badge>}
                </div>
                {f.notes && <p className="text-xs text-muted-foreground mt-1">{f.notes}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => preview(`Teste: ${f.word}`, f.id)}
                  disabled={previewing === f.id}
                  aria-label="Pré-ouvir"
                >
                  {previewing === f.id ? <Loader2 className="size-4 animate-spin" /> : <Volume2 className="size-4" />}
                </Button>
                <Switch checked={f.enabled} onCheckedChange={v => toggle(f.id, v)} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive"
                  onClick={() => remove(f.id)}
                  aria-label="Remover"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
