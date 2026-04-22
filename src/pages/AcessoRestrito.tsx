import { useEffect, useState } from "react";
import rainVideo from "@/assets/rain-bg-realistic.mp4";
import { Mail, MessageCircle, ShieldAlert } from "lucide-react";
import { useLocation } from "react-router-dom";

interface LocationState {
  country?: string;
  source?: string;
}

const AcessoRestrito = () => {
  const location = useLocation();
  const stateInfo = (location.state || {}) as LocationState;
  const [info, setInfo] = useState<LocationState>(stateInfo);

  // Se chegou direto na URL (sem state), tenta ler do cache do gate
  useEffect(() => {
    if (info.country) return;
    try {
      const raw = localStorage.getItem("kera:geo:v1");
      if (raw) {
        const parsed = JSON.parse(raw) as { country?: string; source?: string };
        setInfo({ country: parsed.country, source: parsed.source });
      }
    } catch {}
  }, [info.country]);

  const country = info.country && info.country !== "UNKNOWN" ? info.country : null;

  return (
    <main className="fixed inset-0 z-[9999] overflow-hidden bg-black text-white">
      <video
        src={rainVideo}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-60"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/90" />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-10 text-center overflow-y-auto">
        <div className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/40 bg-black/40 backdrop-blur-sm">
          <ShieldAlert className="w-4 h-4 text-primary" />
          <span className="text-xs uppercase tracking-[0.25em] text-primary/90">
            Acesso Restrito
          </span>
        </div>

        <h1 className="font-display text-4xl sm:text-6xl text-glow mb-4 leading-tight">KERA</h1>
        <p className="text-base sm:text-lg text-white/85 max-w-xl mb-2">
          Plataforma de uso <span className="text-primary font-semibold">empresarial</span>,
          disponível somente em território brasileiro.
        </p>
        <p className="text-sm text-white/60 max-w-md mb-8">
          {country
            ? `Detectamos um acesso de fora do Brasil (${country}).`
            : "Detectamos um acesso de fora do Brasil."}{" "}
          Para liberar o acesso da sua organização, fale com a equipe Space in Cloud®.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 w-full max-w-md mb-10">
          <a
            href="https://wa.me/5547992080916"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition shadow-[0_0_30px_-5px_hsl(var(--primary))]"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp 47 99208-0916
          </a>
          <a
            href="mailto:space@kera.ia.br"
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-white/25 bg-white/5 hover:bg-white/10 backdrop-blur-sm transition"
          >
            <Mail className="w-4 h-4" />
            space@kera.ia.br
          </a>
        </div>

        <div className="pt-6 border-t border-white/10 w-full max-w-md">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-1">Powered by</p>
          <p className="font-display text-lg text-white/90">
            Space in Cloud<sup className="text-primary text-xs ml-0.5">®</sup>
          </p>
        </div>
      </div>
    </main>
  );
};

export default AcessoRestrito;