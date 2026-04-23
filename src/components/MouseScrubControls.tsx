import { useEffect, useState } from "react";
import { Gauge, RotateCcw, X } from "lucide-react";
import { Slider } from "@/components/ui/slider";

export type ScrubSettings = {
  smoothing: number; // 0.02 (muito suave) .. 0.6 (muito responsivo)
  range: number; // 0.3 .. 1.0 — fração da largura da tela usada para mapear o vídeo
};

const STORAGE_KEY = "kera:auth:mouse-scrub-settings";
const DEFAULTS: ScrubSettings = { smoothing: 0.18, range: 1.0 };

export const loadScrubSettings = (): ScrubSettings => {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ScrubSettings>;
    return {
      smoothing: clamp(parsed.smoothing ?? DEFAULTS.smoothing, 0.02, 0.6),
      range: clamp(parsed.range ?? DEFAULTS.range, 0.3, 1.0),
    };
  } catch {
    return DEFAULTS;
  }
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

interface Props {
  value: ScrubSettings;
  onChange: (next: ScrubSettings) => void;
}

/**
 * Painel flutuante (canto inferior esquerdo, somente DEV) com sliders para
 * controlar a sensibilidade do modo "Seguir o mouse". Persiste no localStorage.
 */
const MouseScrubControls = ({ value, onChange }: Props) => {
  const [open, setOpen] = useState(false);

  // Persistência sempre que algo muda.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {}
  }, [value]);

  if (!import.meta.env.DEV) return null;

  const update = (patch: Partial<ScrubSettings>) => onChange({ ...value, ...patch });
  const reset = () => onChange(DEFAULTS);

  return (
    <div className="fixed bottom-4 left-4 z-50 select-none">
      {open ? (
        <div className="rounded-2xl bg-background/85 backdrop-blur-md border border-primary/30 shadow-glow p-3 w-72 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-primary/80">
              Dev · Sensibilidade
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={reset}
                className="text-foreground/60 hover:text-primary transition-colors"
                aria-label="Resetar para padrão"
                title="Resetar para padrão"
              >
                <RotateCcw className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-foreground/60 hover:text-foreground"
                aria-label="Fechar painel"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] text-foreground/80">Suavização</label>
                <span className="text-[10px] font-mono text-primary/80">
                  {value.smoothing.toFixed(2)}
                </span>
              </div>
              <Slider
                min={0.02}
                max={0.6}
                step={0.01}
                value={[value.smoothing]}
                onValueChange={(v) => update({ smoothing: v[0] })}
              />
              <p className="text-[9px] text-foreground/40 mt-1">
                Menor = movimento mais suave · Maior = mais responsivo
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] text-foreground/80">Amplitude</label>
                <span className="text-[10px] font-mono text-primary/80">
                  {Math.round(value.range * 100)}%
                </span>
              </div>
              <Slider
                min={0.3}
                max={1.0}
                step={0.05}
                value={[value.range]}
                onValueChange={(v) => update({ range: v[0] })}
              />
              <p className="text-[9px] text-foreground/40 mt-1">
                Quanto da tela aciona o giro completo do rosto
              </p>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="size-11 rounded-full bg-background/70 backdrop-blur-md border border-primary/30 text-primary shadow-glow flex items-center justify-center hover:scale-105 transition-transform"
          aria-label="Abrir controle de sensibilidade do mouse"
          title="Sensibilidade · Seguir o mouse"
        >
          <Gauge className="size-4" />
        </button>
      )}
    </div>
  );
};

export default MouseScrubControls;