import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mic, Play, Save, Square } from "lucide-react";
import { toast } from "sonner";

// Vozes femininas pré-definidas da ElevenLabs (PT-BR friendly)
const PRESET_VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", desc: "Jovem, calorosa, natural" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", desc: "Doce, suave, juvenil" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", desc: "Confiante, articulada" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", desc: "Madura, expressiva" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", desc: "Energética, moderna" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", desc: "Profissional, clara" },
  { id: "SAz9YHcvj6GT2YYXdXww", name: "River", desc: "Andrógina, calma" },
];

// Vozes temáticas / personagens (Voice Library oficial da ElevenLabs)
const CHARACTER_VOICES = [
  { id: "kPtEHAvRnjUJFv7SK9WI", emoji: "👾", name: "Glitch", desc: "Robô futurista, estilo cyberpunk" },
  { id: "e79twtVS2278lVZZQiAD", emoji: "🧝", name: "The Elf", desc: "Élfica mística, fantasia/anime" },
  { id: "h6u4tPKmcPlxUdZOaVpH", emoji: "🦌", name: "The Reindeer", desc: "Doce e infantil, fofa" },
  { id: "SAhdygBsjizE9aIj39dz", emoji: "🤶", name: "Mrs Claus", desc: "Acolhedora, maternal" },
  { id: "MDLAMJ0jxkpYkjXbmG4t", emoji: "🎅", name: "Santa", desc: "Grave, alegre, narrador" },
  { id: "iP95p4xoKVk53GoZ742B", emoji: "🎙️", name: "Chris", desc: "Narrador americano sério" },
  { id: "nPczCjzI2devNBz1zQrb", emoji: "📻", name: "Brian", desc: "Locutor profundo, documentário" },
  { id: "cjVigY5qzO86Huf0OWal", emoji: "🕴️", name: "Eric", desc: "Vilão calmo, suspense" },
];

const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts-kera`;
const SAMPLE_TEXT =
  "Oi, eu sou a Kera. Essa é a minha voz agora. Se não gostar, me troca aí no painel.";

export const KeraVoiceSelector = () => {
  const [savedId, setSavedId] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [customId, setCustomId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("kera_settings")
        .select("voice_id")
        .eq("singleton", true)
        .maybeSingle();
      if (error) toast.error("Erro ao carregar voz: " + error.message);
      const v = (data as { voice_id?: string } | null)?.voice_id ?? PRESET_VOICES[0].id;
      setSavedId(v);
      setSelectedId(v);
      const inLists = PRESET_VOICES.some((p) => p.id === v) || CHARACTER_VOICES.some((c) => c.id === v);
      if (!inLists) setCustomId(v);
      setLoading(false);
    })();
  }, []);

  const stopPreview = () => {
    audio?.pause();
    setAudio(null);
    setPreviewing(null);
  };

  const preview = async (voiceId: string) => {
    stopPreview();
    setPreviewing(voiceId);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch(TTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text: SAMPLE_TEXT, voice: voiceId, provider: "elevenlabs" }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      if (res.status === 204) {
        toast.warning("Provedor de voz indisponível no momento (quota).");
        setPreviewing(null);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      a.onended = () => {
        setPreviewing(null);
        URL.revokeObjectURL(url);
      };
      setAudio(a);
      await a.play();
    } catch (e) {
      toast.error("Falha no preview: " + (e instanceof Error ? e.message : String(e)));
      setPreviewing(null);
    }
  };

  const save = async () => {
    const id = (customId.trim() || selectedId).trim();
    if (!id || id.length < 10) {
      toast.error("Voice ID inválido.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("kera_settings")
      .update({ voice_id: id })
      .eq("singleton", true);
    setSaving(false);
    if (error) {
      toast.error("Falha ao salvar: " + error.message);
      return;
    }
    setSavedId(id);
    toast.success("Voz da Kera atualizada.");
  };

  const dirty = (customId.trim() || selectedId) !== savedId;

  return (
    <section className="pt-4 border-t border-border space-y-3">
      <div className="flex items-center gap-2">
        <Mic className="size-5 text-primary" />
        <h2 className="font-display text-xl text-glow">Voz da Kera (ElevenLabs)</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Escolha uma voz pré-definida ou cole um Voice ID customizado da{" "}
        <a
          href="https://elevenlabs.io/app/voice-library"
          target="_blank"
          rel="noreferrer"
          className="text-primary underline"
        >
          Voice Library
        </a>
        {" "}(inclui vozes estilo anime feitas pela comunidade).
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <Card className="p-3 space-y-4">
          <div>
            <h3 className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-2">
              🎭 Personagens
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {CHARACTER_VOICES.map((v) => {
                const active = selectedId === v.id && !customId.trim();
                const isPlaying = previewing === v.id;
                return (
                  <div
                    key={v.id}
                    className={`flex items-center justify-between gap-2 p-2 rounded-md border ${
                      active ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(v.id);
                        setCustomId("");
                      }}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="font-medium text-sm flex items-center gap-1.5">
                        <span>{v.emoji}</span>
                        <span className="truncate">{v.name}</span>
                        {savedId === v.id && (
                          <span className="ml-1 text-xs text-primary shrink-0">• ativa</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{v.desc}</div>
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => (isPlaying ? stopPreview() : preview(v.id))}
                    >
                      {isPlaying ? <Square className="size-4" /> : <Play className="size-4" />}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-border">
            <h3 className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-2">
              👩 Vozes femininas (padrão Kera)
            </h3>
            <div className="grid gap-2">
              {PRESET_VOICES.map((v) => {
                const active = selectedId === v.id && !customId.trim();
                const isPlaying = previewing === v.id;
                return (
                  <div
                    key={v.id}
                    className={`flex items-center justify-between gap-2 p-2 rounded-md border ${
                      active ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(v.id);
                        setCustomId("");
                      }}
                      className="flex-1 text-left"
                    >
                      <div className="font-medium text-sm">
                        {v.name}
                        {savedId === v.id && (
                          <span className="ml-2 text-xs text-primary">• ativa</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{v.desc}</div>
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => (isPlaying ? stopPreview() : preview(v.id))}
                    >
                      {isPlaying ? <Square className="size-4" /> : <Play className="size-4" />}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <Label htmlFor="custom-voice" className="text-sm">
              Voice ID customizado (Voice Library)
            </Label>
            <div className="flex gap-2">
              <Input
                id="custom-voice"
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
                placeholder="ex: 21m00Tcm4TlvDq8ikWAM"
                className="font-mono text-xs"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  customId.trim() &&
                  (previewing === customId.trim() ? stopPreview() : preview(customId.trim()))
                }
                disabled={!customId.trim()}
              >
                {previewing === customId.trim() ? (
                  <Square className="size-4" />
                ) : (
                  <Play className="size-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Cole o ID da voz copiado da Voice Library da ElevenLabs.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground min-w-0 break-all">
              Ativa: <code className="font-mono break-all">{savedId}</code>
              {dirty && <span className="ml-2 text-primary">• não salvo</span>}
            </span>
            <Button size="sm" onClick={save} disabled={saving || !dirty} className="shrink-0 self-end sm:self-auto">
              <Save className="size-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </Card>
      )}
    </section>
  );
};
