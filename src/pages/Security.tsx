import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShieldCheck, ShieldOff, Smartphone, Key } from "lucide-react";
import { toast } from "sonner";
import keraLogo from "@/assets/kera-logo.png";

type Factor = { id: string; status: string; friendly_name?: string | null };

const Security = () => {
  const navigate = useNavigate();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [mustChange, setMustChange] = useState(false);

  useEffect(() => {
    document.title = "Kera AI — Segurança (2FA)";
    refresh();
  }, []);

  useEffect(() => {
    const checkProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("must_change_password")
          .eq("user_id", user.id)
          .maybeSingle();
        setMustChange(!!data?.must_change_password);
      }
    };
    checkProfile();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ must_change_password: false })
          .eq("user_id", user.id);
      }
      
      toast.success("Senha atualizada com sucesso!");
      setNewPassword("");
      setMustChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar senha");
    } finally {
      setChangingPassword(false);
    }
  };

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) toast.error(error.message);
    else setFactors((data?.totp || []) as Factor[]);
    setLoading(false);
  };

  const startEnroll = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Kera-${Date.now()}`,
      });
      if (error) throw error;
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
    } catch (e: any) {
      toast.error(e.message || "Erro ao iniciar 2FA");
      setEnrolling(false);
    }
  };

  const verifyEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setVerifying(true);
    try {
      const ch = await supabase.auth.mfa.challenge({ factorId });
      if (ch.error) throw ch.error;
      const v = await supabase.auth.mfa.verify({ factorId, challengeId: ch.data.id, code });
      if (v.error) throw v.error;
      toast.success("2FA ativado com sucesso!");
      setEnrolling(false);
      setQr(null);
      setSecret(null);
      setFactorId(null);
      setCode("");
      refresh();
    } catch (e: any) {
      toast.error(e.message || "Código inválido");
    } finally {
      setVerifying(false);
    }
  };

  const removeFactor = async (id: string) => {
    if (!confirm("Desativar 2FA? Você poderá entrar só com senha.")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) toast.error(error.message);
    else {
      toast.success("2FA desativado");
      refresh();
    }
  };

  const verified = factors.filter((f) => f.status === "verified");

  return (
    <div className="min-h-screen bg-background">
      {!mustChange && (
        <header className="h-14 border-b border-border panel flex items-center px-4 md:px-6 gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="size-5" />
          </Button>
          <img src={keraLogo} alt="Kera AI" className="h-7" />
          <h1 className="font-display text-glow text-lg ml-2">SEGURANÇA</h1>
        </header>
      )}

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {mustChange && (
          <section className="text-center space-y-4 mb-8">
            <div className="flex justify-center mb-6">
              <img src={keraLogo} alt="Kera AI" className="h-12" />
            </div>
            <h2 className="font-display text-3xl text-glow">Defina sua nova senha</h2>
            <p className="text-muted-foreground">
              Por segurança, você deve alterar sua senha temporária no primeiro acesso.
            </p>
          </section>
        )}

        <section>
          <h2 className="font-display text-xl text-glow mb-1 flex items-center gap-2">
            <Key className="size-5 text-primary" /> Alterar Senha
          </h2>
          <p className="text-sm text-muted-foreground">
            {mustChange ? "Digite sua nova senha definitiva abaixo." : "Mantenha sua conta segura com uma senha forte."}
          </p>
        </section>

        <Card className="p-5 border-border bg-card/50">
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <Button 
              type="submit" 
              disabled={changingPassword || newPassword.length < 6}
              className="w-full shadow-glow"
            >
              {changingPassword ? "Atualizando..." : "Salvar Nova Senha"}
            </Button>
          </form>
        </Card>

        {!mustChange && (
          <>
            <section>
        <section>
          <h2 className="font-display text-xl text-glow mb-1 flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" /> Autenticação em 2 fatores (TOTP)
          </h2>
          <p className="text-sm text-muted-foreground">
            Use Google Authenticator, Authy, Microsoft Authenticator ou 1Password
            para gerar códigos de 6 dígitos a cada login.
          </p>
        </section>

        {loading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : verified.length > 0 ? (
          <Card className="p-5 border-primary/40 bg-primary/5">
            <div className="flex items-start gap-3">
              <Badge className="bg-primary/20 text-primary border-primary/40">
                <ShieldCheck className="size-3 mr-1" /> Ativado
              </Badge>
            </div>
            <div className="mt-4 space-y-2">
              {verified.map((f) => (
                <div key={f.id} className="flex items-center justify-between text-sm border border-border rounded-md p-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="size-4 text-primary" />
                    <span className="font-mono text-xs">{f.friendly_name || f.id.slice(0, 8)}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeFactor(f.id)}>
                    <ShieldOff className="size-4 mr-1" /> Remover
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        ) : enrolling && qr ? (
          <Card className="p-5 space-y-4 border-primary/30">
            <p className="text-sm">
              <strong>Passo 1:</strong> Escaneie o QR code com seu app autenticador.
            </p>
            <div className="flex justify-center bg-white p-4 rounded-md">
              <img src={qr} alt="QR Code 2FA" className="w-56 h-56" />
            </div>
            {secret && (
              <p className="text-xs text-muted-foreground text-center break-all">
                Ou digite manualmente: <code className="text-primary">{secret}</code>
              </p>
            )}
            <form onSubmit={verifyEnroll} className="space-y-3">
              <div>
                <Label htmlFor="code"><strong>Passo 2:</strong> Digite o código gerado</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="mt-1 bg-input/50 text-center text-2xl tracking-[0.5em] font-mono"
                  placeholder="000000"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => { setEnrolling(false); setQr(null); setFactorId(null); }}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={verifying || code.length !== 6}
                  className="flex-1 bg-gradient-cyber text-primary-foreground shadow-glow"
                >
                  {verifying ? "Verificando..." : "Ativar 2FA"}
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <Card className="p-5 border-border">
            <p className="text-sm text-muted-foreground mb-4">
              Você ainda não ativou 2FA. Clique abaixo para configurar.
            </p>
            <Button
              onClick={startEnroll}
              className="bg-gradient-cyber text-primary-foreground shadow-glow"
            >
              <ShieldCheck className="size-4 mr-2" /> Ativar 2FA
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Security;
