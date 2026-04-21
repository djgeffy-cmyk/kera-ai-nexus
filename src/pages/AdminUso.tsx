import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ImageIcon, Users, TrendingUp, DollarSign, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type UsageRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  plan_tier: "free" | "essencial" | "pro" | "master";
  selected_agents: string[];
  onboarding_completed: boolean;
  images_today: number;
  images_month: number;
  created_at: string;
};

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  essencial: "Essencial",
  pro: "Pro",
  master: "Master",
};

const PLAN_BADGE: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  essencial: "bg-blue-500/15 text-blue-300 border border-blue-400/30",
  pro: "bg-primary/15 text-primary border border-primary/30",
  master: "bg-amber-500/15 text-amber-300 border border-amber-400/30",
};

// Custo estimado em R$ por imagem (Gemini 2.5 Flash Image via Lovable AI)
// Conservador — ajuste conforme seu painel real.
const COST_PER_IMAGE_BRL = 0.15;

export default function AdminUso() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users_usage");
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setRows((data || []) as UsageRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const totalUsers = rows.length;
    const imagesToday = rows.reduce((s, r) => s + (r.images_today || 0), 0);
    const imagesMonth = rows.reduce((s, r) => s + (r.images_month || 0), 0);
    const costMonth = imagesMonth * COST_PER_IMAGE_BRL;
    return { totalUsers, imagesToday, imagesMonth, costMonth };
  }, [rows]);

  const top = useMemo(() => rows.slice(0, 20), [rows]);

  const changePlan = async (user_id: string, plan: string) => {
    setSavingUserId(user_id);
    const { error } = await supabase.rpc("admin_set_user_plan", {
      _target_user: user_id,
      _plan: plan,
    });
    setSavingUserId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Plano atualizado para ${PLAN_LABEL[plan]}.`);
    setRows((prev) =>
      prev.map((r) => (r.user_id === user_id ? { ...r, plan_tier: plan as UsageRow["plan_tier"] } : r))
    );
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate("/admin")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao admin
          </button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        <header className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl text-glow mb-2">
            Consumo de IA
          </h1>
          <p className="text-muted-foreground">
            Acompanhe quem está gerando imagens e quanto isso está custando.
          </p>
        </header>

        {/* Cards de totais */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Imagens hoje</CardTitle>
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.imagesToday}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Imagens no mês</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.imagesMonth}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Custo estimado</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totals.costMonth.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                ~R$ {COST_PER_IMAGE_BRL.toFixed(2)}/imagem
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Ranking */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top usuários (por imagens no mês)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center text-muted-foreground py-12">Carregando…</div>
            ) : top.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                Nenhum usuário cadastrado ainda.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2 w-8">#</th>
                      <th className="px-3 py-2">Usuário</th>
                      <th className="px-3 py-2">Plano</th>
                      <th className="px-3 py-2 text-right">Hoje</th>
                      <th className="px-3 py-2 text-right">Mês</th>
                      <th className="px-3 py-2 text-right">Custo</th>
                      <th className="px-3 py-2 w-44">Mudar plano</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((r, idx) => {
                      const cost = (r.images_month * COST_PER_IMAGE_BRL).toFixed(2);
                      return (
                        <tr key={r.user_id} className="border-b border-border/50 hover:bg-muted/30 transition">
                          <td className="px-3 py-3 text-muted-foreground">{idx + 1}</td>
                          <td className="px-3 py-3">
                            <div className="font-medium">{r.display_name || "—"}</div>
                            <div className="text-xs text-muted-foreground">{r.email || "—"}</div>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${PLAN_BADGE[r.plan_tier]}`}>
                              {PLAN_LABEL[r.plan_tier]}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{r.images_today}</td>
                          <td className="px-3 py-3 text-right tabular-nums font-semibold">{r.images_month}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">R$ {cost}</td>
                          <td className="px-3 py-3">
                            <Select
                              value={r.plan_tier}
                              onValueChange={(v) => changePlan(r.user_id, v)}
                              disabled={savingUserId === r.user_id}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="free">Free</SelectItem>
                                <SelectItem value="essencial">Essencial</SelectItem>
                                <SelectItem value="pro">Pro</SelectItem>
                                <SelectItem value="master">Master</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground mt-6 text-center">
          Custo estimado é uma referência. O valor real é cobrado pela Lovable AI conforme uso —
          confira em <strong>Settings → Cloud &amp; AI balance</strong>.
        </p>
      </div>
    </main>
  );
}
