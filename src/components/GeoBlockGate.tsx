import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

type GeoState =
  | { status: "checking" }
  | { status: "allowed" }
  | { status: "blocked"; country: string; source: string };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const CACHE_KEY = "kera:geo:v1";
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6h
const BYPASS_KEY = "kera:geo:bypass";
const BYPASS_TTL_MS = 1000 * 30; // 30s — janela curta para evitar loop com /acesso-restrito

const hasActiveBypass = () => {
  try {
    const raw = sessionStorage.getItem(BYPASS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    if (Date.now() - ts < BYPASS_TTL_MS) return true;
    sessionStorage.removeItem(BYPASS_KEY);
    return false;
  } catch {
    return false;
  }
};

export const GeoBlockGate = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [state, setState] = useState<GeoState>(() => {
    // Se o usuário acabou de limpar o cache em /acesso-restrito, não bloqueia
    // imediatamente — deixa a checagem reprocessar sem redirecionar em loop.
    if (hasActiveBypass()) return { status: "checking" };
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          allowed: boolean;
          country: string;
          source?: string;
          ts: number;
        };
        if (Date.now() - parsed.ts < CACHE_TTL_MS) {
          return parsed.allowed
            ? { status: "allowed" }
            : { status: "blocked", country: parsed.country, source: parsed.source || "cache" };
        }
      }
    } catch {}
    return { status: "checking" };
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/geo-check`, {
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        });
        const data = await r.json();
        if (cancelled) return;
        const allowed = !!data.allowed;
        const detected = !!data.detected;
        const country = String(data.country || "UNKNOWN");
        const source = String(data.source || "none");
        // só cacheia quando detectou de verdade — evita "lembrar" de um fail-open
        if (detected) {
          try {
            localStorage.setItem(
              CACHE_KEY,
              JSON.stringify({ allowed, country, source, ts: Date.now() }),
            );
          } catch {}
        }
        // Bypass acabou: se vier permitido, limpa para não interferir em sessões futuras.
        // Se vier bloqueado e o bypass ainda estiver ativo, respeitamos o bypass
        // (mantém em checking/allowed) para não redirecionar em loop.
        if (allowed) {
          try {
            sessionStorage.removeItem(BYPASS_KEY);
          } catch {}
        } else if (hasActiveBypass()) {
          setState({ status: "allowed" });
          return;
        }
        setState(allowed ? { status: "allowed" } : { status: "blocked", country, source });
      } catch {
        // fail-open: não trava o usuário se a checagem falhar
        if (!cancelled) setState({ status: "allowed" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="font-display text-primary text-glow animate-pulse text-lg">KERA</div>
      </div>
    );
  }

  if (state.status === "blocked") {
    // Já está na página? Deixa renderizar normalmente.
    if (location.pathname === "/acesso-restrito") return <>{children}</>;
    return (
      <Navigate
        to="/acesso-restrito"
        replace
        state={{ country: state.country, source: state.source }}
      />
    );
  }

  return <>{children}</>;
};