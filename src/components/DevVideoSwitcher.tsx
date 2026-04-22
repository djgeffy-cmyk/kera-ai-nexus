import { useEffect, useState } from "react";
import { CloudRain, Sparkles, X } from "lucide-react";

export type VideoOption = {
  id: string;
  label: string;
  url: string;
};

interface DevVideoSwitcherProps {
  storageKey: string;
  options: VideoOption[];
  onChange: (url: string, id: string) => void;
  defaultId?: string;
}

/**
 * Seletor flutuante visível apenas em ambiente de desenvolvimento.
 * Permite alternar entre URLs de vídeo em tempo real e persiste a escolha
 * no localStorage por `storageKey`.
 */
const DevVideoSwitcher = ({ storageKey, options, onChange, defaultId }: DevVideoSwitcherProps) => {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>(() => {
    if (typeof window === "undefined") return defaultId ?? options[0]?.id;
    try {
      return window.localStorage.getItem(storageKey) ?? defaultId ?? options[0]?.id;
    } catch {
      return defaultId ?? options[0]?.id;
    }
  });

  useEffect(() => {
    const opt = options.find((o) => o.id === activeId) ?? options[0];
    if (opt) onChange(opt.url, opt.id);
    try {
      window.localStorage.setItem(storageKey, activeId);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 select-none">
      {open ? (
        <div className="rounded-2xl bg-background/85 backdrop-blur-md border border-primary/30 shadow-glow p-3 w-56 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-primary/80">
              Dev · Vídeo
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-foreground/60 hover:text-foreground"
              aria-label="Fechar seletor"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {options.map((opt) => {
              const active = opt.id === activeId;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setActiveId(opt.id)}
                  className={`text-left text-xs px-2.5 py-1.5 rounded-md transition-colors ${
                    active
                      ? "bg-primary/20 text-primary border border-primary/40"
                      : "bg-background/40 text-foreground/80 border border-white/5 hover:border-primary/30"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="size-11 rounded-full bg-background/70 backdrop-blur-md border border-primary/30 text-primary shadow-glow flex items-center justify-center hover:scale-105 transition-transform"
          aria-label="Abrir seletor de vídeo (dev)"
          title="Trocar vídeo de fundo (dev)"
        >
          <CloudRain className="size-4" />
          <Sparkles className="size-3 -ml-1 -mt-2" />
        </button>
      )}
    </div>
  );
};

export default DevVideoSwitcher;