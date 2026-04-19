const Footer = () => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
      <div className="mx-auto w-fit max-w-[95vw] mb-1 px-3 py-1 rounded-full bg-background/70 backdrop-blur border border-border/60 pointer-events-auto">
        <p className="text-[10px] text-muted-foreground whitespace-nowrap">
          Uso exclusivo de{" "}
          <span className="text-primary font-medium">Geverson Carlos Dalpra</span>
          {" "}— criador da personagem{" "}
          <span className="font-display text-glow">Kera</span>
          <sup className="text-primary ml-0.5 text-[8px] font-semibold tracking-wide">®</sup>
        </p>
      </div>
    </div>
  );
};

export default Footer;
