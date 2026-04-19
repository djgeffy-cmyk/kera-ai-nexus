import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import keraLogo from "@/assets/kera-logo.png";

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Kera AI — Entrar";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Acesse o Kera AI: assistente futurista para tecnologia, programação e cibersegurança.");
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/", { replace: true });
    });
  }, [navigate]);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Conta criada! Você já pode entrar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/", { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message || "Erro de autenticação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="panel w-full max-w-md p-8 border-primary/20 shadow-glow">
        <Link to="/" className="block mb-6">
          <img src={keraLogo} alt="Kera AI logo" className="h-16 mx-auto" />
        </Link>
        <h1 className="font-display text-2xl text-center mb-1 text-glow">
          {mode === "signin" ? "Acesse a Kera" : "Crie sua conta"}
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Sua IA direta, honesta e útil ao máximo.
        </p>
        <form onSubmit={handle} className="space-y-4">
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
          </div>
          <Button type="submit" disabled={loading}
            className="w-full bg-gradient-cyber text-primary-foreground font-display tracking-wider hover:opacity-90 shadow-glow">
            {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
          </Button>
        </form>
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="w-full text-sm text-muted-foreground hover:text-primary mt-4 transition"
        >
          {mode === "signin" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
        </button>
      </Card>
    </main>
  );
};

export default Auth;
