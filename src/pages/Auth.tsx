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
 import rainBgRealisticUrl from "@/assets/rain-bg-chuva.mp4";
import rainAmbientUrl from "@/assets/rain-ambient.mp3";

import ParticlesOverlay from "@/components/ParticlesOverlay";
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
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const MAX = 14;
    let targetX = 0, targetY = 0, currX = 0, currY = 0;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      targetX = -nx * MAX * 2;
      targetY = -ny * MAX * 2;
      if (rafRef.current == null) tick();
    };

    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      if (rafRef.current == null) tick();
    };

    const tick = () => {
      currX += (targetX - currX) * 0.12;
      currY += (targetY - currY) * 0.12;
      video.style.transform = `scale(1.08) translate3d(${currX.toFixed(2)}px, ${currY.toFixed(2)}px, 0)`;
      if (Math.abs(targetX - currX) > 0.1 || Math.abs(targetY - currY) > 0.1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    video.style.transform = "scale(1.08) translate3d(0,0,0)";
    video.style.transition = "transform 120ms linear";
    video.style.willChange = "transform";

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
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
        a.volume = 0.35;
        await a.play();
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

  // Sincroniza mute com estado
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = audioMuted;
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
        className="absolute inset-0 w-full h-full object-cover"
        src={rainBgUrl}
        style={{ filter: "brightness(0.95) contrast(1.05) saturate(1)" }}
      />
      <div aria-hidden className="absolute inset-0 bg-background/10" />
      <ParticlesOverlay />

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
            "radial-gradient(ellipse at center, transparent 0%, hsl(var(--background) / 0.25) 65%, hsl(var(--background) / 0.6) 100%)",
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
            className="relative z-20 flex flex-col items-center"
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
              className="mt-8 text-primary font-display tracking-widest text-2xl uppercase text-center text-glow"
            >
              Kera
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-2 text-sm text-muted-foreground tracking-wider text-center max-w-xs"
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
                 className="text-xs text-primary/80 hover:text-primary hover:bg-primary/10 tracking-wider underline-offset-4 underline transition-all"
               >
                 Já tenho conta — Entrar direto
               </Button>
               <p className="text-[10px] text-muted-foreground/50 italic">
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
                background: "rgba(0, 0, 0, 0.03)",
                backdropFilter: "blur(2px)",
                WebkitBackdropFilter: "blur(2px)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                textShadow: "0px 0px 5px rgba(0, 0, 0, 0.8)",
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
