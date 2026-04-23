import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, MousePointerClick, Video, VideoOff } from "lucide-react";
import { ShieldCheck, ArrowRight, Lock } from "lucide-react";
import { motion } from "framer-motion";
import keraAvatar from "@/assets/kera-avatar.png";
import rainAmbientUrl from "@/assets/rain-ambient.mp3";
import DevVideoSwitcher from "@/components/DevVideoSwitcher";
import RainOverlay from "@/components/RainOverlay";

const STORAGE_BASE = "https://ytixqgkzqgeoxrbmjqbo.supabase.co/storage/v1/object/public/kera-videos";
const VERSION = "2026-04-22";

const bgVideoOptions = [
  { id: "rain", label: "Chuva pura (full bg)", url: `${STORAGE_BASE}/kera-chuva.mp4?v=${VERSION}` },
  { id: "kera-rain", label: "Kera com chuva", url: `${STORAGE_BASE}/kera-avatar-rain.mp4?v=${VERSION}` },
];

const avatarVideoOptions = [
  { id: "kera-rain", label: "Kera com chuva", url: `${STORAGE_BASE}/kera-avatar-rain.mp4?v=${VERSION}` },
  { id: "rain", label: "Chuva pura", url: `${STORAGE_BASE}/kera-chuva.mp4?v=${VERSION}` },
];

const Welcome = () => {
  const navigate = useNavigate();
  const [bgUrl, setBgUrl] = useState(bgVideoOptions[0].url);
  const [avatarUrl, setAvatarUrl] = useState(avatarVideoOptions[0].url);
  const BG_KEY = "kera:global:show-bg";
  const [showBackground, setShowBackground] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const v = window.localStorage.getItem(BG_KEY);
      return v === null ? true : v === "1";
    } catch {
      return true;
    }
  });

  const RAIN_MUTE_KEY = "kera:auth:rain-muted";
  const [audioMuted, setAudioMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(RAIN_MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);

  // Tenta tocar o áudio (após primeira interação) e mantém o volume
  // sincronizado com o estado mute. O `level` da chuva escuta o mesmo estado.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = audioMuted ? 0 : 0.55;
    if (!audioMuted) {
      const p = audio.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
    const onFirstInteract = () => {
      if (!audioMuted) {
        const p = audio.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      }
    };
    window.addEventListener("pointerdown", onFirstInteract, { once: true });
    return () => window.removeEventListener("pointerdown", onFirstInteract);
  }, [audioMuted]);

  useEffect(() => {
    document.title = "Kera AI — Bem-vindo";
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/", { replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    const video = bgVideoRef.current;
    if (!video) return;
    const tryPlay = () => {
      const p = video.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {});
      }
    };
    video.addEventListener("canplay", tryPlay);
    video.addEventListener("loadeddata", tryPlay);
    window.addEventListener("pointerdown", tryPlay, { once: true });
    tryPlay();
    return () => {
      video.removeEventListener("canplay", tryPlay);
      video.removeEventListener("loadeddata", tryPlay);
      window.removeEventListener("pointerdown", tryPlay);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(BG_KEY, showBackground ? "1" : "0");
    } catch {}
  }, [showBackground]);

  useEffect(() => {
    try {
      window.localStorage.setItem(RAIN_MUTE_KEY, audioMuted ? "1" : "0");
    } catch {}
  }, [audioMuted]);

  return (
    <main className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-background">
      {showBackground && (
        <video
          ref={bgVideoRef}
          key={bgUrl}
          aria-hidden
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster={keraAvatar}
          className="absolute inset-0 w-full h-full object-cover object-bottom"
          src={bgUrl}
        />
      )}

      <audio ref={audioRef} src={rainAmbientUrl} loop preload="auto" muted={audioMuted} aria-hidden />

      {/* Chuva suave em canvas — intensidade segue o som ambiente.
          Mute = leve respingo (0.18), som ligado = chuva cheia (1.0).
          O smoothing interno do componente faz a transição parecer natural. */}
      <RainOverlay intensity="soft" level={audioMuted ? 0.18 : 1} />

      <div className="fixed top-4 right-4 z-40 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShowBackground((v) => !v)}
          title={showBackground ? "Desativar vídeo de fundo" : "Ativar vídeo de fundo"}
          className="size-10 rounded-full bg-background/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-primary/80 hover:text-primary transition-all shadow-soft"
        >
          {showBackground ? <Video className="size-4" /> : <VideoOff className="size-4" />}
        </button>

        <button
          type="button"
          onClick={() => setAudioMuted((m) => !m)}
          title={audioMuted ? "Ativar som ambiente" : "Desativar som ambiente"}
          className="size-10 rounded-full bg-background/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-primary/80 hover:text-primary transition-all shadow-soft"
        >
          {audioMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      </div>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle at center, hsl(var(--background) / 0.58) 0%, hsl(var(--background) / 0.32) 24%, transparent 52%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-20 flex flex-col items-center px-8 py-9 rounded-[2rem] bg-background/30 backdrop-blur-md border border-primary/15 shadow-[0_0_60px_-15px_hsl(var(--primary)/0.35)]"
      >
        <div className="mb-5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-[10px] uppercase tracking-[0.18em] text-primary/90">
          <ShieldCheck className="size-3" />
          Acesso restrito · Plataforma empresarial
        </div>

        <motion.button
          type="button"
          onClick={() => navigate("/auth")}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="group relative rounded-full"
        >
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-primary/40"
            animate={{ scale: [1, 1.35, 1.6], opacity: [0.6, 0.2, 0] }}
            transition={{ duration: 2.4, repeat: Infinity }}
          />
          <div className="relative size-48 sm:size-56 rounded-full overflow-hidden border-2 border-primary/70 shadow-glow bg-background">
            <video
              key={avatarUrl}
              autoPlay
              loop
              muted
              playsInline
              src={avatarUrl}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute bottom-2 right-2 bg-primary text-primary-foreground rounded-full p-2.5 shadow-glow">
            <MousePointerClick className="size-5" />
          </div>
        </motion.button>

        <h2 className="mt-8 text-primary font-display tracking-[0.25em] text-4xl uppercase text-glow">
          Kera
        </h2>
        <p className="mt-2 text-[11px] uppercase tracking-[0.3em] text-primary/60">
          Inteligência operacional
        </p>
        <p className="mt-4 text-sm text-foreground/75 text-center max-w-xs leading-relaxed">
          Ambiente exclusivo para usuários autorizados. Faça login com suas credenciais corporativas.
        </p>

        <div className="my-6 h-px w-24 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <Button
          onClick={() => navigate("/auth")}
          className="w-full bg-gradient-cyber text-primary-foreground shadow-glow hover:opacity-95 group"
        >
          <Lock className="size-4 mr-2" />
          Entrar na plataforma
          <ArrowRight className="size-4 ml-2 transition-transform group-hover:translate-x-0.5" />
        </Button>

        <p className="mt-4 text-[10px] text-muted-foreground/70 text-center max-w-xs">
          Sem cadastro público. Solicite acesso ao administrador da sua organização.
        </p>
      </motion.div>

      <DevVideoSwitcher
        storageKey="kera:welcome:bg-video"
        options={bgVideoOptions}
        defaultId="rain"
        onChange={(url) => setBgUrl(url)}
      />
    </main>
  );
};

export default Welcome;
