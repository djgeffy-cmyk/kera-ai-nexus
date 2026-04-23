import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldCheck, KeyRound, Mail, ScanFace, Eye, EyeOff, Sparkles, Volume2, VolumeX, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import keraAvatar from "@/assets/kera-avatar.png";
 import keraAvatarVideoV2 from "@/assets/kera-avatar-rain-v2.mp4";
import rainAmbientUrl from "@/assets/rain-ambient.mp3";
import keraLookingSidesAsset from "@/assets/kera-avatar-looking-sides.mp4.asset.json";

// Vídeos hospedados no storage. `?v=` força o CDN/navegador a baixar a versão
// mais recente quando o arquivo for trocado no bucket.
// Fundo full-screen da página: chuva pura (sem o avatar da Kera).
const rainBgUrl =
  "https://ytixqgkzqgeoxrbmjqbo.supabase.co/storage/v1/object/public/kera-videos/kera-chuva.mp4?v=2026-04-22";
// Avatar circular dentro do botão/card: Kera realista com gotas de chuva.
const rainVideoUrl =
  "https://ytixqgkzqgeoxrbmjqbo.supabase.co/storage/v1/object/public/kera-videos/kera-avatar-rain.mp4?v=2026-04-22";
// Kera olhando para os dois lados (gerado por IA, hospedado em CDN).
const keraLookingSidesUrl = (keraLookingSidesAsset as { url: string }).url;
import { assetUrl } from "@/lib/assetUrl";
import DevVideoSwitcher from "@/components/DevVideoSwitcher";

const authBgOptions = [
  { id: "kera-rain", label: "Kera com chuva (full bg)", url: rainVideoUrl },
  { id: "kera-sides", label: "Kera olhando os lados", url: keraLookingSidesUrl },
  { id: "rain", label: "Chuva pura", url: rainBgUrl },
];
const authAvatarOptions = [
  { id: "kera-rain", label: "Kera com chuva", url: rainVideoUrl },
  { id: "kera-sides", label: "Kera olhando os lados", url: keraLookingSidesUrl },
  { id: "rain", label: "Chuva pura", url: rainBgUrl },
];
import { MissionCriticalSchema } from "@/lib/missionCriticalSchemas";
import { PasswordStrengthMeter } from "@/components/PasswordStrengthMeter";
import {
  loginWithPasskey,
  loginWithPasskeyDiscoverable,
  registerPasskey,
  webauthnSupported,
  isInIframe,
  isIOSNonSafari,
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
  const [iosNonSafari] = useState(() => isIOSNonSafari());
  const [bgVideoUrl, setBgVideoUrl] = useState(authBgOptions[0].url);
  const [avatarVideoUrl, setAvatarVideoUrl] = useState(authAvatarOptions[0].url);
  // Lembra a preferência do usuário entre visitas (localStorage).
  const RAIN_MUTE_KEY = "kera:auth:rain-muted";
  const [audioMuted, setAudioMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(RAIN_MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [audioStarted, setAudioStarted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const passkeyAvailable = supportsPasskey && !inIframe;
  const muteTimeoutRef = useRef<number | null>(null);

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

  useEffect(() => {
    document.title = "Kera AI — Entrar";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Acesse o Kera AI: assistente futurista para tecnologia, programação e cibersegurança.");
    supabase.auth.getSession().then(({ data }) => {
     if (data.session) navigate("/", { replace: true });
     });
   }, [navigate]);
 
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

  /**
   * Login Face ID sem precisar digitar email — usa passkeys descobríveis.
   * O navegador mostra a lista de passkeys salvas e o usuário escolhe.
   */
  const handlePasskeyDiscoverableLogin = async () => {
    setPasskeyLoading(true);
    try {
      const { email: loggedEmail } = await loginWithPasskeyDiscoverable();
      toast.success(`Bem-vinda${loggedEmail ? `, ${loggedEmail}` : ""}!`);
      navigate("/", { replace: true });
    } catch (err: any) {
      // Usuário cancelou prompt do Face ID — silencia
      const msg = err?.message || "";
      if (
        msg.includes("NotAllowed") ||
        msg.includes("cancel") ||
        msg.toLowerCase().includes("aborted")
      ) {
        return;
      }
      toast.error(msg || "Falha no Face ID");
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
    <main
      ref={mainRef}
      className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden"
      style={{
        // Fallback imediato: gradiente escuro + poster da Kera. Garante que a
        // tela NUNCA fique 100% preta enquanto o vídeo de chuva (MBs) carrega
        // ou quando o navegador/PC bloqueia autoplay/decodificação de vídeo.
        backgroundColor: "hsl(var(--background))",
        backgroundImage: `radial-gradient(ellipse at center, hsl(var(--primary) / 0.18), transparent 60%), url(${keraAvatar})`,
        backgroundSize: "cover, cover",
        backgroundPosition: "center, center",
        backgroundRepeat: "no-repeat, no-repeat",
      }}
    >
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
        key={bgVideoUrl}
        src={bgVideoUrl}
        // Sem filtros: mostra o vídeo de chuva original, com as gotas no chão visíveis
      />

      {/* Áudio ambiente de chuva — começa após primeira interação */}
      <audio
        ref={audioRef}
        src={rainAmbientUrl}
        loop
        preload="auto"
        muted={audioMuted}
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

      {/* Botão voltar — canto superior esquerdo. Volta pra tela inicial /welcome. */}
      <button
        type="button"
        onClick={() => navigate("/welcome")}
        aria-label="Voltar pra tela inicial"
        title="Voltar"
        className="fixed top-4 left-4 z-40 h-10 px-3 rounded-full bg-background/40 backdrop-blur-md border border-white/10 flex items-center gap-1.5 text-primary/80 hover:text-primary hover:bg-background/60 hover:scale-105 active:scale-95 transition-all duration-300 shadow-soft text-sm"
      >
        <ArrowLeft className="size-4" />
        <span className="hidden sm:inline">Voltar</span>
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
                    key={avatarVideoUrl}
                    src={avatarVideoUrl}
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
                  {mode === "signin" && iosNonSafari && !passkeyAvailable && (
                    <div className="mb-4 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm text-foreground/90">
                      <p className="font-semibold text-primary mb-1 flex items-center gap-2">
                        <ScanFace className="size-4" />
                        Face ID indisponível neste navegador
                      </p>
                      <p className="text-xs leading-relaxed">
                        No iPhone, Face ID/Touch ID só funciona no <strong>Safari</strong>.
                        Chrome, Firefox e Edge no iOS não têm acesso à biometria por
                        limitação da Apple.
                      </p>
                      <p className="text-xs leading-relaxed mt-2">
                        Para usar Face ID, abra <strong>chat.kera.ia.br</strong> no Safari.
                      </p>
                    </div>
                  )}
                  {mode === "signin" && passkeyAvailable && (
                    <>
                      <Button
                        type="button"
                        onClick={handlePasskeyDiscoverableLogin}
                        disabled={passkeyLoading}
                        className="w-full bg-primary/15 hover:bg-primary/25 border border-primary/40 text-primary font-medium shadow-glow group"
                      >
                        <ScanFace className="size-5 mr-2 group-hover:scale-110 transition-transform" />
                        {passkeyLoading ? "Aguardando biometria..." : "Entrar com Face ID / Touch ID"}
                      </Button>
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-border/50" />
                        <span className="text-xs text-muted-foreground uppercase tracking-widest">ou com senha</span>
                        <div className="flex-1 h-px bg-border/50" />
                      </div>
                    </>
                  )}

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
                </>
              )}
            </Card>
          </motion.div>
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

      <DevVideoSwitcher
        storageKey="kera:auth:bg-video"
        options={authBgOptions}
        defaultId="kera-rain"
        onChange={(url) => setBgVideoUrl(url)}
      />
    </main>
  );
};

export default Auth;
