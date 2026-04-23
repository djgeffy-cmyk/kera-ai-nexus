import { useEffect, useRef, useState } from "react";
import rainVideo from "@/assets/rain-bg-realistic.mp4";
import { ArrowRight, Mail, MessageCircle, RefreshCw, ShieldAlert, Timer } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

interface LocationState {
  country?: string;
  source?: string;
}

const BYPASS_KEY = "kera:geo:bypass";
const BYPASS_TTL_MS = 30_000;

const AcessoRestrito = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const stateInfo = (location.state || {}) as LocationState;
  const [info, setInfo] = useState<LocationState>(stateInfo);
  const [rechecking, setRechecking] = useState(false);
  const [bypassRemaining, setBypassRemaining] = useState(0);
  const tickRef = useRef<number | null>(null);

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

  // Lê o tempo restante do bypass (em ms) a partir do sessionStorage
  const readBypassRemaining = (): number => {
    try {
      const raw = sessionStorage.getItem(BYPASS_KEY);
      if (!raw) return 0;
      const ts = Number(raw);
      if (!Number.isFinite(ts)) return 0;
      return Math.max(0, BYPASS_TTL_MS - (Date.now() - ts));
    } catch {
      return 0;
    }
  };

  // Mantém um tick de 1s atualizando o contador regressivo enquanto houver bypass
  useEffect(() => {
    const update = () => {
      const remaining = readBypassRemaining();
      setBypassRemaining(remaining);
      if (remaining <= 0 && tickRef.current !== null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
    update();
    if (tickRef.current === null) {
      tickRef.current = window.setInterval(update, 1000) as unknown as number;
    }
    return () => {
      if (tickRef.current !== null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, []);

  const clearGeoCache = () => {
    // Lista de chaves conhecidas relacionadas ao gate de geo / bloqueio
    const exactKeys = [
      "kera:geo:v1",
      "kera:geo",
      "kera:geo:blocked",
      "kera:geo:country",
      "kera:geo:source",
      "kera:geoblock",
      "kera:access:blocked",
    ];
    // Prefixos a varrer para pegar variações futuras (ex.: kera:geo:v2)
    const prefixes = ["kera:geo", "kera:geoblock", "kera:access"];

    const purge = (storage: Storage | null) => {
      if (!storage) return;
      try {
        for (const k of exactKeys) storage.removeItem(k);
        const toRemove: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (!key) continue;
          if (prefixes.some((p) => key.startsWith(p))) toRemove.push(key);
        }
        toRemove.forEach((k) => storage.removeItem(k));
      } catch {}
    };

    try {
      purge(window.localStorage);
      purge(window.sessionStorage);
    } catch {}

    // Limpa também cookies relacionados, caso existam
    try {
      document.cookie.split(";").forEach((c) => {
        const name = c.split("=")[0]?.trim();
        if (name && (name.startsWith("kera_geo") || name.startsWith("kera_access"))) {
          document.cookie = `${name}=; Max-Age=0; path=/`;
        }
      });
    } catch {}

    // Sinaliza ao GeoBlockGate que acabamos de limpar o cache. Enquanto a flag
    // estiver ativa (~30s), o gate evita redirecionar de volta para
    // /acesso-restrito mesmo que a próxima checagem ainda venha bloqueada,
    // dando tempo do reprocessamento sem cair em loop.
    try {
      sessionStorage.setItem("kera:geo:bypass", String(Date.now()));
    } catch {}
    // Atualiza o contador imediatamente após setar o bypass
    setBypassRemaining(BYPASS_TTL_MS);
    if (tickRef.current === null) {
      tickRef.current = window.setInterval(() => {
        const remaining = readBypassRemaining();
        setBypassRemaining(remaining);
        if (remaining <= 0 && tickRef.current !== null) {
          window.clearInterval(tickRef.current);
          tickRef.current = null;
        }
      }, 1000) as unknown as number;
    }
  };

  const handleRetry = () => {
    setRechecking(true);
    clearGeoCache();
    // Recarrega a app na raiz (HashRouter) para que o GeoBlockGate refaça a checagem
    window.location.replace("/#/");
    // garante reload completo caso já estivéssemos em /#/
    setTimeout(() => window.location.reload(), 50);
  };

  const handleBackToApp = () => {
    clearGeoCache();
    navigate("/", { replace: true });
  };

  // "Reexecutar checagem" — limpa cache + seta bypass, mas SEM reload (refaz na rota raiz)
  const handleRecheckNoReload = () => {
    clearGeoCache();
    navigate("/", { replace: true });
  };

  const bypassSeconds = Math.ceil(bypassRemaining / 1000);
  const bypassPct = Math.max(0, Math.min(100, (bypassRemaining / BYPASS_TTL_MS) * 100));
  const bypassActive = bypassRemaining > 0;

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
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/95" />

      <div className="relative z-10 min-h-screen w-full flex flex-col items-center justify-center px-5 sm:px-6 py-8 sm:py-12 text-center overflow-y-auto">
        <div className="mb-5 sm:mb-6 inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full border border-primary/40 bg-black/40 backdrop-blur-sm">
          <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
          <span className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-primary/90">
            Acesso Restrito
          </span>
        </div>

        <h1 className="font-display text-5xl sm:text-7xl text-glow mb-4 leading-none tracking-wide text-primary">
          KERA
        </h1>
        <p className="text-sm sm:text-lg text-white/85 max-w-xl mb-2 px-2">
          Plataforma de uso <span className="text-primary font-semibold">empresarial</span>,
          disponível somente em território brasileiro.
        </p>
        <p className="text-xs sm:text-sm text-white/60 max-w-md mb-8 px-2 leading-relaxed">
          {country
            ? `Detectamos um acesso de fora do Brasil (${country}).`
            : "Detectamos um acesso de fora do Brasil."}{" "}
          Para liberar o acesso da sua organização, fale com a equipe Space in Cloud®.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md mb-10">
          <a
            href="https://wa.me/5547992080916"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm sm:text-base font-medium hover:opacity-90 transition shadow-[0_0_30px_-5px_hsl(var(--primary))]"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp 47 99208-0916
          </a>
          <a
            href="mailto:space@kera.ia.br"
            className="flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-xl border border-white/25 bg-white/5 text-sm sm:text-base hover:bg-white/10 backdrop-blur-sm transition"
          >
            <Mail className="w-4 h-4" />
            space@kera.ia.br
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md mb-10">
          <button
            type="button"
            onClick={handleRetry}
            disabled={rechecking}
            className="flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-xl border border-primary/40 bg-primary/10 text-sm sm:text-base text-primary hover:bg-primary/20 transition disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${rechecking ? "animate-spin" : ""}`} />
            {rechecking ? "Verificando..." : "Verificar novamente"}
          </button>
          <button
            type="button"
            onClick={handleBackToApp}
            className="flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-xl border border-white/25 bg-white/5 text-sm sm:text-base text-white/90 hover:bg-white/10 backdrop-blur-sm transition"
          >
            Voltar ao app
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {bypassActive && (
          <div className="w-full max-w-md mb-8 -mt-4 px-4 py-3 rounded-xl border border-primary/30 bg-primary/5 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2 text-xs sm:text-sm">
              <span className="inline-flex items-center gap-1.5 text-primary/90">
                <Timer className="w-3.5 h-3.5" />
                Janela de re-verificação ativa
              </span>
              <span className="font-mono text-primary tabular-nums">{bypassSeconds}s</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-primary transition-[width] duration-1000 ease-linear"
                style={{ width: `${bypassPct}%` }}
              />
            </div>
            <button
              type="button"
              onClick={handleRecheckNoReload}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-primary/40 bg-primary/10 text-xs sm:text-sm text-primary hover:bg-primary/20 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reexecutar checagem agora
            </button>
          </div>
        )}

        <p className="text-[11px] text-white/40 max-w-md mb-8 -mt-4">
          Já foi autorizado ou está acessando do Brasil? Use “Verificar novamente” para refazer a
          checagem ou “Voltar ao app” para limpar o bloqueio.
        </p>

        <div className="pt-5 sm:pt-6 border-t border-white/10 w-full max-w-md">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-1">Powered by</p>
          <p className="font-display text-base sm:text-lg text-white/90">
            Space in Cloud<sup className="text-primary text-xs ml-0.5">®</sup>
          </p>
        </div>
      </div>
    </main>
  );
};

export default AcessoRestrito;