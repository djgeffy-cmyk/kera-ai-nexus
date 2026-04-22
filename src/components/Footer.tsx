import { useLocation } from "react-router-dom";

const Footer = () => {
  const { pathname } = useLocation();
  // Esconde o rodapé nas telas onde ele se sobrepõe ao composer do chat
  // (chat principal "/" e "/chat"). Nessas telas a barra de digitação fica
  // fixa no fundo e o rodapé acaba cobrindo o input.
  if (pathname === "/" || pathname.startsWith("/chat")) return null;

  return (
    <>
      {/* Rodapé compacto (texto + QR) — escondido no mobile pra não atrapalhar o chat */}
      <div
        className="hidden md:block fixed bottom-0 right-0 z-30 pointer-events-none transition-[left] duration-300 ease-in-out"
        style={{ left: "var(--chat-sidebar-w, 0px)" }}
      >
        <div className="mx-auto w-fit max-w-[95vw] mb-2 px-4 py-1.5 rounded-full bg-background/80 backdrop-blur-md border border-border/60 pointer-events-auto flex items-center gap-3 shadow-lg shadow-background/40">
          <p className="text-[12px] text-muted-foreground whitespace-nowrap leading-none flex items-center gap-1.5">
            <span className="font-display text-glow text-primary">Kera AI</span>
            <span className="opacity-70">·</span>
            <span className="font-medium text-foreground/90">Space in Cloud</span>
            <span
              className="ml-1 inline-flex items-center justify-center text-primary font-bold text-[15px] leading-none drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]"
              title="Marca registrada no INPI"
              aria-label="Marca registrada no INPI"
            >
              ®
            </span>
            <span className="ml-1 text-[9px] uppercase tracking-[0.15em] text-primary/80 font-semibold">
              INPI
            </span>
          </p>

          <div className="h-5 w-px bg-border/60" aria-hidden="true" />

          <a
            href="https://wa.me/5547999208916"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Falar no WhatsApp via QR Code"
            title="Escaneie ou clique para abrir o WhatsApp"
            className="shrink-0 inline-flex items-center justify-center rounded-md bg-background p-1 ring-1 ring-emerald-500/40 hover:ring-emerald-400 transition-all"
          >
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data=${encodeURIComponent("https://wa.me/5547999208916")}`}
              alt="QR Code WhatsApp"
              className="h-12 w-12"
              loading="lazy"
              decoding="async"
            />
          </a>
        </div>
      </div>
    </>
  );
};

export default Footer;
