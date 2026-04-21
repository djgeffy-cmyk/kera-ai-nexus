import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";

// Bump esta versão sempre que o ícone do app for atualizado.
// Usuários verão o banner uma vez até dispensarem.
const ICON_VERSION = "2";
const STORAGE_KEY = `kera:iconUpdateDismissed:v${ICON_VERSION}`;

export const IconUpdateBanner = () => {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    try {
      // Só mostra quando o app está rodando como atalho instalado (PWA standalone)
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        // iOS Safari legacy
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;

      if (!standalone) return;

      const dismissed = localStorage.getItem(STORAGE_KEY) === "1";
      if (dismissed) return;

      const ua = window.navigator.userAgent || "";
      setIsIOS(/iPhone|iPad|iPod/i.test(ua));
      setShow(true);
    } catch {
      // silencioso
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,420px)]"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
      role="status"
      aria-live="polite"
    >
      <div className="rounded-2xl border border-primary/40 bg-background/85 backdrop-blur-md shadow-lg shadow-primary/20 p-3 pr-9 relative">
        <button
          onClick={dismiss}
          aria-label="Dispensar aviso"
          className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-start gap-2.5">
          <div className="shrink-0 mt-0.5 rounded-lg bg-primary/15 p-1.5 ring-1 ring-primary/30">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold leading-tight text-foreground">
              Novo ícone da Kera disponível
            </p>
            <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
              {isIOS ? (
                <>
                  Pra ver o novo ícone, segure o atalho atual na tela inicial e
                  toque em <span className="text-foreground font-medium">Remover</span>.
                  Depois, no Safari, abra o app, toque em{" "}
                  <span className="text-foreground font-medium">Compartilhar</span> →{" "}
                  <span className="text-foreground font-medium">Adicionar à Tela de Início</span>.
                </>
              ) : (
                <>
                  Pra ver o novo ícone, remova o atalho atual da tela inicial
                  e adicione novamente pelo menu do navegador →{" "}
                  <span className="text-foreground font-medium">Instalar app</span>.
                </>
              )}
            </p>
            <button
              onClick={dismiss}
              className="mt-2 text-[11px] font-medium text-primary hover:text-primary-glow transition-colors"
            >
              Ok, entendi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IconUpdateBanner;
