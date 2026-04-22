import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldCheck, KeyRound, Mail, ScanFace, Eye, EyeOff, Sparkles, MousePointerClick, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import keraAvatar from "@/assets/kera-avatar.png";
 import keraAvatarVideoV2 from "@/assets/kera-avatar-rain-v2.mp4";
import rainAmbientUrl from "@/assets/rain-ambient.mp3";

// Vídeo de chuva hospedado no storage (atualizado pelo usuário).
// `?v=` força o navegador/CDN a baixar a versão mais recente quando o arquivo
// for trocado no bucket — sem isso, o cache antigo continua sendo exibido.
const rainBgRealisticUrl =
  "https://ytixqgkzqgeoxrbmjqbo.supabase.co/storage/v1/object/public/kera-videos//kera-chuva.mp4?v=2026-04-22";

import DemoKeraDialog from "@/components/DemoKeraDialog";
import { assetUrl } from "@/lib/assetUrl";
import { MissionCriticalSchema } from "@/lib/missionCriticalSchemas";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import {
  loginWithPasskey,
  registerPasskey,
  webauthnSupported,
  isInIframe,
} from "@/lib/webauthn";

type Mode = "signin" | "signup" | "totp";

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [supportsPasskey] = useState(() => webauthnSupported());
  const [inIframe] = useState(() => isInIframe());
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const passkeyAvailable = supportsPasskey && !inIframe;

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("[passkey] diagnóstico", {
      supportsPasskey,
      inIframe,
      passkeyAvailable,
      hasPublicKeyCredential:
        typeof window !== "undefined" && !!(window as any).PublicKeyCredential,
      origin: typeof window !== "undefined" ? window.location.origin : null,
      isSecureContext:
        typeof window !== "undefined" ? window.isSecureContext : null,
      protocol:
        typeof window !== "undefined" ? window.location.protocol : null,
    });
  }, [supportsPasskey, inIframe, passkeyAvailable]);

  const mainRef = useRef<HTMLElement | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = mainRef.current;
    const video = bgVideoRef.current;
    if (!el || !video) return;
    // Parallax desligado: o vídeo de chuva é vertical e qualquer scale/translate
    // empurra o chão (com as gotas batendo) para fora da tela. Mantemos o vídeo
    // alinhado pelo bottom para garantir que o solo molhado sempre apareça.
    video.style.transform = "none";
    video.style.willChange = "auto";
    return;
  }, []);

  // Garante autoplay/loop do vídeo de chuva mesmo quando o navegador bloqueia
  // o primeiro play (ex.: autoplay policy) ou quando há falha de rede.
  useEffect(() => {
    const video = bgVideoRef.current;
    if (!video) return;

    const tryPlay = () => {
      const p = video.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {/* será retentado em próxima interação */});
      }
    };

    const onCanPlay = () => tryPlay();
    const onStalled = () => { try { video.load(); } catch {} };
    const onVisibility = () => { if (document.visibilityState === "visible") tryPlay(); };
    const onUserGesture = () => tryPlay();

    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("loadeddata", onCanPlay);
    video.addEventListener("stalled", onStalled);
    video.addEventListener("error", onStalled);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointerdown", onUserGesture, { once: true });
    window.addEventListener("keydown", onUserGesture, { once: true });

    tryPlay();

    return () => {
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("loadeddata", onCanPlay);
      video.removeEventListener("stalled", onStalled);
      video.removeEventListener("error", onStalled);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", onUserGesture);
      window.removeEventListener("keydown", onUserGesture);
    };
  }, []);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetNote, setResetNote] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
   const rainVideoUrl = keraAvatarVideoV2;
    // Vídeo de chuva realista enviado pelo usuário (local, alta definição)
    const rainBgUrl = rainBgRealisticUrl;

  useEffect(() => {
    document.title = "Kera AI — Entrar";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Acesse o Kera AI: assistente futurista para tecnologia, programação e cibersegurança.");
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/", { replace: true });
    });
  }, [navigate]);

  // Áudio ambiente de chuva: começa a tocar na primeira interação do usuário
  // (autoplay policy do navegador exige gesture).
  useEffect(() => {
    if (audioStarted) return;
    const tryStart = async () => {
      const a = audioRef.current;
      if (!a || audioStarted) return;
      try {
        // Configura grafo Web Audio para enriquecer o som da chuva:
        // Perfil "chuva ultra-suave": remove todo o chiado agudo irritante
        // e o ronco grave, deixando apenas um som de fundo macio e "morno".
        // Volume reduzido para ser apenas uma textura de ambiente.
        if (!audioCtxRef.current) {
          const Ctx =
            (window as any).AudioContext || (window as any).webkitAudioContext;
          if (Ctx) {
            const ctx: AudioContext = new Ctx();
            const source = ctx.createMediaElementSource(a);

            // LowPass agressivo: corta o chiado (hiss) acima de 2.2kHz
            const lowPass = ctx.createBiquadFilter();
            lowPass.type = "lowpass";
            lowPass.frequency.value = 2200;
            lowPass.Q.value = 0.5;

            // HighPass: remove o ronco de baixa frequência
            const highPass = ctx.createBiquadFilter();
            highPass.type = "highpass";
            highPass.frequency.value = 300;

            // HighShelf: corta ainda mais os agudos que sobraram
            const highShelf = ctx.createBiquadFilter();
            highShelf.type = "highshelf";
            highShelf.frequency.value = 1800;
            highShelf.gain.value = -12;

            // Reverb sutil de ambiente
            const delay = ctx.createDelay(0.5);
            delay.delayTime.value = 0.14;
            const feedback = ctx.createGain();
            feedback.gain.value = 0.18;
            const wet = ctx.createGain();
            wet.gain.value = 0.22;

            const master = ctx.createGain();
            master.gain.value = 0; // arranca em 0 para fade-in

            source.connect(lowPass);
            lowPass.connect(highPass);
            highPass.connect(highShelf);
            // dry path
            highShelf.connect(master);
            // wet path (reverb)
            highShelf.connect(delay);
            delay.connect(feedback);
            feedback.connect(delay);
            delay.connect(wet);
            wet.connect(master);

            master.connect(ctx.destination);

            audioCtxRef.current = ctx;
            gainNodeRef.current = master;
          }
        }

        a.volume = 1; // o controle real fica no GainNode master
        await a.play();

        // Fade-in longo (8s) até 0.20 — volume muito baixo e discreto
        const ctx = audioCtxRef.current;
        const master = gainNodeRef.current;
        if (ctx && master) {
          if (ctx.state === "suspended") {
            try { await ctx.resume(); } catch { /* ignore */ }
          }
          const now = ctx.currentTime;
          master.gain.cancelScheduledValues(now);
          master.gain.setValueAtTime(0, now);
          master.gain.linearRampToValueAtTime(0.2, now + 8);
        }

        setAudioStarted(true);
        cleanup();
      } catch {
        /* ignora — espera próxima interação */
      }
    };
    const cleanup = () => {
      window.removeEventListener("pointerdown", tryStart);
      window.removeEventListener("keydown", tryStart);
      window.removeEventListener("touchstart", tryStart);
    };
    window.addEventListener("pointerdown", tryStart);
    window.addEventListener("keydown", tryStart);
    window.addEventListener("touchstart", tryStart);
    return cleanup;
  }, [audioStarted]);

  // Sincroniza mute com estado (usa GainNode quando disponível para evitar
  // cortes bruscos — fade rápido de 250ms entre mute/unmute).
  useEffect(() => {
    const ctx = audioCtxRef.current;
    const master = gainNodeRef.current;
    if (ctx && master) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(audioMuted ? 0 : 0.2, now + 0.5);
    } else if (audioRef.current) {
      audioRef.current.muted = audioMuted;
    }
  }, [audioMuted]);

  const checkAndChallengeMfa = async (): Promise<boolean> => {
    const { data: factors, error } = await supabase.auth.mfa.listFactors();
    if (error) return false;
    const totp = factors?.totp?.find((f) => f.status === "verified");
    if (!totp) return false;
    const ch = await supabase.auth.mfa.challenge({ factorId: totp.id });
    if (ch.error) {
      toast.error("Falha ao iniciar verificação 2FA.");
      return false;
    }
    setFactorId(totp.id);
    setChallengeId(ch.data.id);
    setMode("totp");
    return true;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const schema = mode === "signup" ? MissionCriticalSchema.authSignup : MissionCriticalSchema.authSignin;
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(first?.message || "Dados inválidos");
      return;
    }
    const { email: cleanEmail, password: cleanPassword } = parsed.data;
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: cleanEmail, password: cleanPassword,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Conta criada! Você já pode entrar.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password: cleanPassword });
        if (error) throw error;
        const needs2fa = await checkAndChallengeMfa();
        if (!needs2fa) navigate("/", { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message || "Erro de autenticação");
    } finally {
      setLoading(false);
    }
  };

  const verifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || !challengeId) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code: otp });
      if (error) throw error;
      toast.success("2FA verificado!");
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Código inválido");
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    if (!email.trim()) {
      toast.error("Digite seu email primeiro.");
      return;
    }
    setPasskeyLoading(true);
    try {
      await loginWithPasskey(email.trim().toLowerCase());
      toast.success("Acesso liberado pelo Face ID!");
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Falha no Face ID");
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handlePasskeyRegister = async () => {
    setPasskeyLoading(true);
    try {
      await registerPasskey();
      toast.success("Face ID cadastrado! Da próxima vez, use o botão Face ID.");
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Falha ao cadastrar Face ID");
    } finally {
      setPasskeyLoading(false);
    }
  };

  const submitReset = async () => {
    const e = resetEmail.trim().toLowerCase();
    if (!e || !e.includes("@")) {
      toast.error("Informe um email válido.");
      return;
    }
    if (resetNote.length > 500) {
      toast.error("Mensagem muito longa.");
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.from("password_reset_requests").insert({
        email: e,
        note: resetNote.trim() || null,
      });
      if (error) throw error;
      toast.success("Pedido enviado! O administrador vai entrar em contato.");
      setResetOpen(false);
      setResetEmail("");
      setResetNote("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar pedido");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <main ref={mainRef} className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <video
        ref={bgVideoRef}
        aria-hidden
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster={keraAvatar}
        disablePictureInPicture
        // O vídeo é vertical (784x1168). Em telas widescreen `object-cover` corta
        // o topo E o chão. Alinhar pelo bottom garante que o solo com as gotas
        // batendo SEMPRE fique visível.
        className="absolute inset-0 w-full h-full object-cover object-bottom"
        src={rainBgUrl}
        // Sem filtros: mostra o vídeo de chuva original, com as gotas no chão visíveis
      />

      {/* Áudio ambiente de chuva — começa após primeira interação */}
      <audio
        ref={audioRef}
        src={rainAmbientUrl}
        loop
        preload="auto"
        aria-hidden
      />

      {/* Toggle mute discreto — canto superior direito */}
      <button
        type="button"
        onClick={() => setAudioMuted((m) => !m)}
        aria-label={audioMuted ? "Ativar som da chuva" : "Silenciar chuva"}
        title={audioMuted ? "Ativar som da chuva" : "Silenciar chuva"}
        className="fixed top-4 right-4 z-40 size-10 rounded-full bg-background/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-primary/80 hover:text-primary hover:bg-background/60 hover:scale-105 active:scale-95 transition-all duration-300 shadow-soft"
      >
        {audioMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </button>

      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at center, hsl(var(--background) / 0.58) 0%, hsl(var(--background) / 0.32) 24%, transparent 52%), radial-gradient(ellipse at center, transparent 0%, hsl(var(--background) / 0.18) 68%, hsl(var(--background) / 0.52) 100%)",
        }}
      />

      <AnimatePresence mode="wait">
        {!isUnlocked ? (
          <motion.div
            key="kera-trigger"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: 1.1,
              filter: "blur(12px)",
              transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
            }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative z-20 flex flex-col items-center px-6 py-7 rounded-[2rem]"
            style={{
              background: "linear-gradient(180deg, hsl(var(--background) / 0.34), hsl(var(--background) / 0.18))",
              boxShadow: "0 18px 60px hsl(0 0% 0% / 0.28)",
            }}
          >
            {/* Trigger: avatar grande da Kera. Hover = pulse + chamada. Click = abre demo. */}
            <motion.button
              type="button"
              onClick={() => setDemoOpen(true)}
              aria-label="Conversar com a Kera"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="group relative cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-primary/40 rounded-full"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {/* Halos pulsantes ao redor */}
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full border-2 border-primary/40"
                animate={{ scale: [1, 1.35, 1.6], opacity: [0.6, 0.2, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
              />
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full border-2 border-primary/30"
                animate={{ scale: [1, 1.35, 1.6], opacity: [0.4, 0.15, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", delay: 0.8 }}
              />

              {/* Avatar de vídeo da Kera */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="relative size-48 sm:size-56 rounded-full overflow-hidden border-2 border-primary/70 shadow-glow ring-4 ring-primary/20 group-hover:ring-primary/50 group-hover:shadow-[0_0_60px_hsl(var(--primary)/0.6)] transition-all duration-500 bg-background"
              >
                <video
                  aria-hidden
                  autoPlay
                  loop
                  muted
                  playsInline
                  src={rainVideoUrl}
                  poster={keraAvatar}
                  className="w-full h-full object-cover"
                />
                {/* Overlay sutil que reage ao hover */}
                <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors duration-500" />
              </motion.div>

              {/* Badge de "click" no canto */}
              <motion.div
                aria-hidden
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute bottom-2 right-2 bg-primary text-primary-foreground rounded-full p-2.5 shadow-glow border-2 border-background"
              >
                <MousePointerClick className="size-5" />
              </motion.div>
            </motion.button>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-8 text-primary font-display tracking-widest text-3xl uppercase text-center text-glow"
              style={{ textShadow: "0 0 12px hsl(var(--primary) / 0.9), 0 4px 24px hsl(0 0% 0% / 0.7)" }}
            >
              Kera
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-3 text-base text-foreground/90 tracking-wide text-center max-w-sm leading-relaxed"
              style={{ textShadow: "0 2px 18px hsl(0 0% 0% / 0.72)" }}
            >
              Clique sobre mim para conversar — depois você decide se cria conta
            </motion.p>

             <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ delay: 1 }}
               className="mt-6 flex flex-col items-center gap-3"
             >
               <Button
                 variant="ghost"
                 onClick={() => setIsUnlocked(true)}
                  className="text-sm text-primary hover:text-primary hover:bg-background/25 tracking-wide underline-offset-4 underline transition-all"
                  style={{ textShadow: "0 2px 16px hsl(0 0% 0% / 0.65)" }}
               >
                 Já tenho conta — Entrar direto
               </Button>
                <p className="text-xs text-foreground/70 italic text-center" style={{ textShadow: "0 2px 16px hsl(0 0% 0% / 0.72)" }}>
                 Após entrar, as configurações de humor ficam na barra lateral.
               </p>
             </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="auth-card"
            initial={{ opacity: 0, y: 40, scale: 0.85, filter: "blur(12px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            transition={{
              type: "spring",
              damping: 22,
              stiffness: 110,
              delay: 0.15,
              filter: { duration: 0.5, delay: 0.15 },
            }}
          >
            <Card
              className="relative w-full max-w-sm p-5 sm:p-6 shadow-glow z-10 max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-thin rounded-2xl"
               style={{
                 background: "linear-gradient(180deg, hsl(var(--background) / 0.62), hsl(var(--background) / 0.46))",
                 border: "1px solid hsl(var(--border) / 0.7)",
                 textShadow: "0 2px 14px rgba(0, 0, 0, 0.72)",
               }}
            >
              <div className="flex flex-col items-center mb-4">
                <div className="relative size-20 sm:size-24 rounded-full overflow-hidden border-2 border-primary/70 shadow-glow mb-3 bg-background ring-4 ring-primary/20">
                  <video
                    aria-hidden
                    autoPlay
                    loop
                    muted
                    playsInline
                    src={rainVideoUrl}
                    poster={keraAvatar}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-1 right-1 bg-background/80 p-1 rounded-full border border-primary/30">
                    <Sparkles className="size-3 text-primary" />
                  </div>
                  <div aria-hidden className="absolute inset-0 rounded-full ring-1 ring-primary/40 pointer-events-none" />
                </div>
                <h1 className="font-display text-2xl text-glow text-center">
                  {mode === "signin" && "Acesse a Kera"}
                  {mode === "signup" && "Crie sua conta"}
                  {mode === "totp" && "Verificação 2FA"}
                </h1>
                <p className="text-sm text-muted-foreground text-center mt-1">
                  {mode === "totp"
                    ? "Digite o código de 6 dígitos do seu app autenticador."
                    : "Sua IA direta, honesta e útil ao máximo."}
                </p>
              </div>

              {mode === "totp" ? (
                <form onSubmit={verifyTotp} className="space-y-4">
                  <div>
                    <Label htmlFor="otp" className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-primary" /> Código TOTP
                    </Label>
                    <Input
                      id="otp"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      className="mt-1 bg-input/50 border-border focus-visible:ring-primary text-center text-2xl tracking-[0.5em] font-mono"
                      placeholder="000000"
                      autoFocus
                    />
                  </div>
                  <Button type="submit" disabled={loading || otp.length !== 6}
                    className="w-full bg-gradient-cyber text-primary-foreground font-display tracking-wider hover:opacity-90 shadow-glow">
                    {loading ? "Verificando..." : "Verificar"}
                  </Button>
                  <button
                    type="button"
                    onClick={async () => {
                      await supabase.auth.signOut();
                      setMode("signin");
                      setOtp("");
                    }}
                    className="w-full text-sm text-muted-foreground hover:text-primary transition"
                  >
                    Cancelar
                  </button>
                </form>
              ) : (
                <>
                  <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                      <Label htmlFor="email">E-mail</Label>
                      <Input id="email" type="email" required value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1 bg-input/50 border-border focus-visible:ring-primary" />
                    </div>
                    <div>
                      <Label htmlFor="password">Senha</Label>
                      <div className="relative mt-1">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="bg-input/50 border-border focus-visible:ring-primary pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(v => !v)}
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                          aria-pressed={showPassword}
                          tabIndex={-1}
                          className="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-muted-foreground hover:text-primary transition-colors"
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      {mode === "signup" && <PasswordStrengthMeter password={password} />}
                    </div>
                    <Button type="submit" disabled={loading}
                      className="w-full bg-gradient-cyber text-primary-foreground font-display tracking-wider hover:opacity-90 shadow-glow">
                      {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
                    </Button>
                  </form>

                  {mode === "signin" && supportsPasskey && (
                    <>
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-border/50" />
                        <span className="text-xs text-muted-foreground">ou</span>
                        <div className="flex-1 h-px bg-border/50" />
                      </div>
                      <Button
                        type="button"
                        onClick={handlePasskeyLogin}
                        disabled={passkeyLoading || !email.trim() || inIframe}
                        variant="outline"
                        className="w-full border-primary/40 hover:bg-primary/10 hover:border-primary disabled:opacity-60"
                        title={inIframe ? "Abra direto em chat.kera.ia.br" : undefined}
                      >
                        <ScanFace className="size-4 mr-2 text-primary" />
                        {passkeyLoading ? "Aguarde..." : "Entrar com Face ID / Touch ID"}
                      </Button>
                    </>
                  )}

                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => { setResetEmail(email); setResetOpen(true); }}
                      className="w-full text-xs text-muted-foreground hover:text-primary mt-3 transition flex items-center justify-center gap-1"
                    >
                      <KeyRound className="size-3" /> Esqueci minha senha
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                    className="w-full text-sm text-muted-foreground hover:text-primary mt-4 transition"
                  >
                    {mode === "signin" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
                  </button>

                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-border/50" />
                    <span className="text-xs text-muted-foreground uppercase tracking-widest">ou</span>
                    <div className="flex-1 h-px bg-border/50" />
                  </div>

                  <Button
                    type="button"
                    onClick={() => setDemoOpen(true)}
                    variant="outline"
                    className="w-full border-primary/40 hover:bg-primary/10 hover:border-primary group"
                  >
                    <Sparkles className="size-4 mr-2 text-primary group-hover:animate-pulse" />
                    Testar Kera antes (3 perguntas grátis)
                  </Button>
                </>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="panel border-primary/30">
          <DialogHeader>
            <DialogTitle className="font-display text-glow flex items-center gap-2">
              <Mail className="size-5 text-primary" /> Recuperar senha
            </DialogTitle>
            <DialogDescription>
              O administrador receberá seu pedido e entrará em contato para redefinir sua senha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="reset-email">Seu e-mail</Label>
              <Input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="mt-1 bg-input/50"
                placeholder="seu.email@guaramirim.sc.gov.br"
              />
            </div>
            <div>
              <Label htmlFor="reset-note">Mensagem (opcional)</Label>
              <Input
                id="reset-note"
                value={resetNote}
                maxLength={500}
                onChange={(e) => setResetNote(e.target.value)}
                className="mt-1 bg-input/50"
                placeholder="Ex: troquei de celular, esqueci a senha..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>Cancelar</Button>
            <Button
              onClick={submitReset}
              disabled={resetLoading}
              className="bg-gradient-cyber text-primary-foreground shadow-glow"
            >
              {resetLoading ? "Enviando..." : "Enviar pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DemoKeraDialog
        open={demoOpen}
        onOpenChange={setDemoOpen}
        onWantToSignUp={() => {
          setIsUnlocked(true);
          setMode("signup");
        }}
      />
    </main>
  );
};

export default Auth;
