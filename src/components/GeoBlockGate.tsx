import { useEffect, useState } from "react";
import AcessoRestrito from "@/pages/AcessoRestrito";

type GeoState =
  | { status: "checking" }
  | { status: "allowed" }
  | { status: "blocked"; country: string; source: string };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const CACHE_KEY = "kera:geo:v1";
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6h

export const GeoBlockGate = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<GeoState>(() => {
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
    // Atualiza a URL pra refletir o estado de bloqueio (sem recarregar)
    if (typeof window !== "undefined" && !window.location.hash.startsWith("#/acesso-restrito")) {
      window.location.hash = "#/acesso-restrito";
    }
    return <AcessoRestrito />;
  }

  return <>{children}</>;
};