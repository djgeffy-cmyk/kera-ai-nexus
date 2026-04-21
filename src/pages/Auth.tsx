import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldCheck, KeyRound, Mail, ScanFace } from "lucide-react";
import keraAvatar from "@/assets/kera-avatar.png";
import keraAvatarVideo from "@/assets/kera-avatar-rain.mp4.asset.json";
import ParticlesOverlay from "@/components/ParticlesOverlay";
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
  const [supportsPasskey] = useState(() => webauthnSupported());
  const [inIframe] = useState(() => isInIframe());
  const passkeyAvailable = supportsPasskey && !inIframe;

  // Refs pro parallax (movimento sutil via CSS vars — não re-renderiza React)
  const mainRef = useRef<HTMLElement | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = mainRef.current;
    const video = bgVideoRef.current;
    if (!el || !video) return;
    // Respeita preferência de movimento reduzido
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const MAX = 14; // deslocamento máximo em px — bem sutil
    let targetX = 0, targetY = 0, currX = 0, currY = 0;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;  // -0.5..0.5
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      targetX = -nx * MAX * 2; // inverso pro efeito parallax natural
      targetY = -ny * MAX * 2;
      if (rafRef.current == null) tick();
    };

    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      if (rafRef.current == null) tick();
    };

    const tick = () => {
      // easing — aproxima 12% por frame, dá uma sensação suave/orgânica
      currX += (targetX - currX) * 0.12;
      currY += (targetY - currY) * 0.12;
      video.style.transform = `scale(1.08) translate3d(${currX.toFixed(2)}px, ${currY.toFixed(2)}px, 0)`;
      if (Math.abs(targetX - currX) > 0.1 || Math.abs(targetY - currY) > 0.1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    // estado inicial — escala leve pra esconder bordas no movimento
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

  // Reset password modal
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetNote, setResetNote] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const rainVideoUrl = assetUrl(keraAvatarVideo);

  useEffect(() => {
    document.title = "Kera AI — Entrar";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Acesse o Kera AI: assistente futurista para tecnologia, programação e cibersegurança.");
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/", { replace: true });
    });
  }, [navigate]);

  const isEmailAllowed = (raw: string) => {
    const e = raw.trim().toLowerCase();
    return e === "dj.geffy@gmail.com" || e.endsWith("@guaramirim.sc.gov.br");
  };

  const checkAndChallengeMfa = async (): Promise<boolean> => {
    // Verifica se o usuário tem fator TOTP verificado
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
    if (mode === "signup" && !isEmailAllowed(email)) {
      toast.error("Cadastro permitido apenas para emails @guaramirim.sc.gov.br.");
      return;
    }
    // Validação NASA-grade
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
        // Após login, checa se tem 2FA
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
      {/* Vídeo Kera de fundo — em alta qualidade, com overlay leve pra ela aparecer */}
      <video
        ref={bgVideoRef}
        aria-hidden
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        src={rainVideoUrl}
        poster={keraAvatar}
      />
      {/* Overlay sutil — só o suficiente pra dar contraste no card, sem apagar a Kera */}
      <div aria-hidden className="absolute inset-0 bg-background/30" />
      {/* Partículas/poeira luminosa flutuando sobre a Kera — dá profundidade */}
      <ParticlesOverlay />
      {/* Vinheta bem leve — quase transparente pra Kera aparecer no fundo */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, hsl(var(--background) / 0.25) 65%, hsl(var(--background) / 0.6) 100%)",
        }}
      />

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
            {passkeyAvailable && (
              <Button
                type="button"
                onClick={handlePasskeyRegister}
                disabled={passkeyLoading}
                variant="outline"
                className="w-full border-primary/40 hover:bg-primary/10 hover:border-primary"
              >
                <ScanFace className="size-4 mr-2 text-primary" />
                {passkeyLoading
                  ? "Cadastrando..."
                  : "Cadastrar Face ID neste dispositivo"}
              </Button>
            )}
            {supportsPasskey && inIframe && (
              <p className="text-xs text-muted-foreground text-center px-2">
                Para cadastrar Face ID, abra direto em <strong>chat.kera.ia.br</strong> no Safari (não funciona dentro deste preview).
              </p>
            )}
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
                <Input id="password" type="password" required minLength={6} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 bg-input/50 border-border focus-visible:ring-primary" />
                {mode === "signup" && <PasswordStrengthMeter password={password} />}
              </div>
              <Button type="submit" disabled={loading}
                className="w-full bg-gradient-cyber text-primary-foreground font-display tracking-wider hover:opacity-90 shadow-glow">
                {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
              </Button>
            </form>

            {mode === "signin" && passkeyAvailable && (
              <>
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-border/50" />
                  <span className="text-xs text-muted-foreground">ou</span>
                  <div className="flex-1 h-px bg-border/50" />
                </div>
                <Button
                  type="button"
                  onClick={handlePasskeyLogin}
                  disabled={passkeyLoading || !email.trim()}
                  variant="outline"
                  className="w-full border-primary/40 hover:bg-primary/10 hover:border-primary"
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
          </>
        )}
      </Card>

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
    </main>
  );
};

export default Auth;
