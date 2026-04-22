import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Users, Loader2, ShieldCheck, Mail, Key, Wand2, Copy, RotateCcw, Sparkles } from "lucide-react";
import { BUILTIN_AGENTS } from "@/lib/agents";

// Gera senha forte no padrão Kera: 14 caracteres, com maiúscula, minúscula, número e símbolo.
const generateKeraPassword = (length = 14): string => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sem I, O
  const lower = "abcdefghijkmnpqrstuvwxyz"; // sem l, o
  const digits = "23456789"; // sem 0, 1
  const symbols = "!@#$%&*?";
  const all = upper + lower + digits + symbols;
  const rand = (set: string) => set[Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1) * set.length)];
  const required = [rand(upper), rand(lower), rand(digits), rand(symbols)];
  const remaining = Array.from({ length: length - required.length }, () => rand(all));
  return [...required, ...remaining]
    .sort(() => crypto.getRandomValues(new Uint32Array(1))[0] - 0x7fffffff)
    .join("");
};

export const UserManager = () => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  // Reset de senha
  const [resetDialogUser, setResetDialogUser] = useState<any | null>(null);
  const [resetPwd, setResetPwd] = useState("");
  const [resetting, setResetting] = useState(false);
  // Liberar agentes
  const [agentsDialogUser, setAgentsDialogUser] = useState<any | null>(null);
  const [grantedKeys, setGrantedKeys] = useState<string[]>([]);
  const [savingAgents, setSavingAgents] = useState(false);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { action: "list_users" },
      });
      if (error) throw error;
      setUsers(data.users || []);
    } catch (err: any) {
      console.error("Error fetching users:", err);
      // toast.error("Erro ao carregar usuários");
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openResetDialog = (u: any) => {
    setResetPwd(generateKeraPassword());
    setResetDialogUser(u);
  };

  const handleResetPassword = async () => {
    if (!resetDialogUser || resetPwd.length < 8) {
      toast.error("Senha precisa de 8+ caracteres");
      return;
    }
    setResetting(true);
    try {
      const { error } = await supabase.functions.invoke("admin-user-management", {
        body: {
          action: "reset_password",
          targetUserId: resetDialogUser.id,
          password: resetPwd,
        },
      });
      if (error) throw error;
      await navigator.clipboard.writeText(resetPwd).catch(() => {});
      toast.success("Senha resetada e copiada. Repasse ao usuário.");
      setResetDialogUser(null);
      setResetPwd("");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao resetar senha");
    } finally {
      setResetting(false);
    }
  };

  const openAgentsDialog = (u: any) => {
    setGrantedKeys(u.profile?.granted_agent_keys || []);
    setAgentsDialogUser(u);
  };

  const toggleAgent = (key: string) => {
    setGrantedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleSaveAgents = async () => {
    if (!agentsDialogUser) return;
    setSavingAgents(true);
    try {
      const { error } = await supabase.functions.invoke("admin-user-management", {
        body: {
          action: "set_granted_agents",
          targetUserId: agentsDialogUser.id,
          agentKeys: grantedKeys,
        },
      });
      if (error) throw error;
      toast.success("Agentes atualizados");
      setAgentsDialogUser(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar agentes");
    } finally {
      setSavingAgents(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Preencha email e senha");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-management", {
        body: { 
          action: "create_user",
          email,
          password,
          displayName
        },
      });

      if (error) throw error;

      toast.success("Usuário criado com sucesso!");
      setEmail("");
      setPassword("");
      setDisplayName("");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar usuário");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="size-5 text-primary" />
        <h2 className="font-display text-xl text-glow">Gestão de Usuários</h2>
      </div>

      <Card className="p-6 border-primary/20 bg-primary/5">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <UserPlus className="size-4 text-primary" />
            <h3 className="font-medium">Cadastrar Novo Usuário</h3>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground ml-1">Nome (opcional)</label>
              <Input
                placeholder="Ex: João Silva"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-background/50 border-primary/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground ml-1">E-mail</label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/50 border-primary/20"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground ml-1">Senha Temporária</label>
              <div className="flex gap-1">
                <Input
                  type="text"
                  placeholder="Senha123!"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-background/50 border-primary/20 font-mono"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  title="Gerar senha forte (padrão Kera)"
                  onClick={() => {
                    const pwd = generateKeraPassword();
                    setPassword(pwd);
                    toast.success("Senha gerada no padrão Kera");
                  }}
                  className="shrink-0 border-primary/30 hover:bg-primary/10"
                >
                  <Wand2 className="size-4 text-primary" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  title="Copiar senha"
                  disabled={!password}
                  onClick={async () => {
                    await navigator.clipboard.writeText(password);
                    toast.success("Senha copiada");
                  }}
                  className="shrink-0 border-primary/30 hover:bg-primary/10"
                >
                  <Copy className="size-4 text-primary" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground ml-1">14 caracteres • A-Z, a-z, 0-9, símbolo</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading} className="shadow-glow">
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Criando...
                </>
              ) : (
                "Cadastrar Usuário"
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            * O usuário será marcado para trocar a senha no primeiro acesso.
          </p>
        </form>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground px-1">Usuários Recentes</h3>
        <div className="grid gap-2">
          {users.slice(0, 5).map((u) => (
            <div 
              key={u.id} 
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50 text-sm hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {u.email[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{u.profile?.display_name || u.email.split('@')[0]}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="size-3" />
                    {u.email}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {u.profile?.must_change_password && (
                  <span className="flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full border border-amber-500/20">
                    <Key className="size-2.5" />
                    Troca Pendente
                  </span>
                )}
                {u.profile?.plan_tier !== 'free' && (
                  <span className="flex items-center gap-1 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                    <ShieldCheck className="size-2.5" />
                    {u.profile?.plan_tier}
                  </span>
                )}
              </div>
            </div>
          ))}
          {users.length === 0 && !loading && (
            <p className="text-center py-8 text-muted-foreground text-sm italic">
              Nenhum usuário encontrado ou erro na listagem.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};
