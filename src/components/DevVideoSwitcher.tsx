import { useEffect, useState } from "react";
import { CloudRain, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { filterKeraOptions, resolveValidKeraId } from "@/lib/keraIdentity";

export type VideoOption = {
  id: string;
  label: string;
  url: string;
  group?: string;
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
  // Remove opções incompatíveis com a identidade da Kera (ex.: "looking-sides").
  const safeOptions = filterKeraOptions(options);
  const fallbackId = defaultId ?? safeOptions[0]?.id;
  const [open, setOpen] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [activeId, setActiveId] = useState<string>(() => {
    if (typeof window === "undefined") return fallbackId;
    try {
      const stored = window.localStorage.getItem(storageKey);
      const { id, migrated } = resolveValidKeraId(stored, safeOptions, fallbackId);
      if (migrated && stored) {
        // Avisa o usuário e regrava a chave já com o valor válido.
        toast.info("Vídeo da Kera atualizado", {
          description: "A versão anterior foi descontinuada. Voltamos ao padrão.",
        });
        try {
          window.localStorage.setItem(storageKey, id);
        } catch {}
      }
      return id;
    } catch {
      return fallbackId;
    }
  });

  useEffect(() => {
    const opt = safeOptions.find((o) => o.id === activeId) ?? safeOptions[0];
    if (opt) {
      // Acrescenta cache-buster apenas em recargas manuais para forçar refetch.
      const url = reloadTick > 0 ? `${opt.url}${opt.url.includes("?") ? "&" : "?"}r=${reloadTick}` : opt.url;
      onChange(url, opt.id);
    }
    try {
      window.localStorage.setItem(storageKey, opt?.id ?? activeId);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, reloadTick]);

  if (!import.meta.env.DEV) return null;

  // Agrupa opções por `group` (mantendo ordem de aparição); itens sem grupo vão para "default".
  const groups = safeOptions.reduce<Record<string, VideoOption[]>>((acc, opt) => {
    const key = opt.group ?? "__default__";
    (acc[key] = acc[key] ?? []).push(opt);
    return acc;
  }, {});
  const groupOrder = Array.from(new Set(safeOptions.map((o) => o.group ?? "__default__")));

  return (
    <div className="fixed bottom-4 right-4 z-50 select-none">
      {open ? (
        <div className="rounded-2xl bg-background/85 backdrop-blur-md border border-primary/30 shadow-glow p-3 w-64 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-primary/80">
              Dev · Vídeo
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setReloadTick((t) => t + 1)}
                className="text-foreground/60 hover:text-primary transition-colors"
                aria-label="Recarregar vídeo"
                title="Recarregar apenas o vídeo"
              >
                <RefreshCw className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-foreground/60 hover:text-foreground"
                aria-label="Fechar seletor"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
            {groupOrder.map((groupKey) => (
              <div key={groupKey} className="flex flex-col gap-1">
                {groupKey !== "__default__" && (
                  <span className="text-[9px] font-mono uppercase tracking-wider text-foreground/40 px-1 mt-1">
                    {groupKey}
                  </span>
                )}
                {groups[groupKey].map((opt) => {
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
            ))}
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