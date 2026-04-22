import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, MousePointerClick, Video, VideoOff } from "lucide-react";
import { motion } from "framer-motion";
import keraAvatar from "@/assets/kera-avatar.png";
import rainAmbientUrl from "@/assets/rain-ambient.mp3";
import DemoKeraDialog from "@/components/DemoKeraDialog";
import DevVideoSwitcher from "@/components/DevVideoSwitcher";

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
  const [demoOpen, setDemoOpen] = useState(false);
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
        className="relative z-20 flex flex-col items-center px-6 py-7 rounded-[2rem] bg-background/20 backdrop-blur-sm border border-white/5"
      >
        <motion.button
          type="button"
          onClick={() => setDemoOpen(true)}
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

        <h2 className="mt-8 text-primary font-display tracking-widest text-3xl uppercase text-glow">Kera</h2>
        <p className="mt-3 text-base text-foreground/90 tracking-wide text-center max-w-sm">
          Clique sobre mim para conversar — depois você decide se cria conta
        </p>

        <div className="mt-6 flex flex-col items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate("/auth")}
            className="text-sm text-primary underline underline-offset-4"
          >
            Já tenho conta — Entrar direto
          </Button>
          <p className="text-xs text-foreground/70 italic text-center">
            Após entrar, as configurações de humor ficam na barra lateral.
          </p>
        </div>
      </motion.div>

      <DemoKeraDialog
        open={demoOpen}
        onOpenChange={setDemoOpen}
        onWantToSignUp={() => navigate("/auth")}
      />

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
