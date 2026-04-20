import keraSpaceLogo from "@/assets/kera-spaceincloud-logo.png";

const Footer = () => {
  return (
    <div
      className="fixed bottom-0 right-0 z-30 pointer-events-none transition-[left] duration-300 ease-in-out"
      style={{ left: "var(--chat-sidebar-w, 0px)" }}
    >
      <div className="mx-auto w-fit max-w-[95vw] mb-2 px-4 py-2 rounded-full bg-background/80 backdrop-blur-md border border-border/60 pointer-events-auto flex items-center gap-3 shadow-lg shadow-background/40">
        <a
          href="https://app.spaceincloud.com.br/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Acessar Kera AI Space in Cloud"
          title="Kera AI · Space in Cloud — Soluções em Nuvem"
          className="shrink-0 opacity-90 hover:opacity-100 transition-opacity"
        >
          <img
            src={keraSpaceLogo}
            alt="Kera AI Space in Cloud"
            className="h-14 w-auto bg-transparent"
            loading="lazy"
            decoding="async"
            style={{ background: "transparent" }}
          />
        </a>

        <div className="h-5 w-px bg-border/60" aria-hidden="true" />

        <p className="text-[11px] text-muted-foreground whitespace-nowrap leading-none">
          Uso exclusivo de{" "}
          <span className="text-primary font-medium">Geverson Carlos Dalpra</span>
          {" "}— criador da personagem{" "}
          <span className="font-display text-glow">Kera</span>
          <sup className="text-primary ml-0.5 text-[8px] font-semibold tracking-wide">®</sup>
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
  );
};

export default Footer;
