import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Loader2, Crown, Sparkles, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PLAN_LIMITS: Record<string, number> = {
  free: 0,
  essencial: 1,
  pro: 3,
  master: 10,
};

const PLAN_LABEL: Record<string, string> = {
  free: "Grátis",
  essencial: "Essencial",
  pro: "Pro",
  master: "Master",
  admin: "Admin (ilimitado)",
};

type Quota = {
  used: number;
  limit: number;
  plan: string;
};

export function ImageQuotaCard({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [quota, setQuota] = useState<Quota | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        if (!cancelled) setLoading(false);
        return;
      }

      const [{ data: profile }, { data: isAdmin }, { data: usage }] = await Promise.all([
        supabase.from("profiles").select("plan_tier").eq("user_id", u.user.id).maybeSingle(),
        supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" }),
        supabase
          .from("image_quota_usage")
          .select("count")
          .eq("user_id", u.user.id)
          .eq("usage_date", new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }))
            .toISOString().slice(0, 10))
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const plan = isAdmin ? "admin" : (profile?.plan_tier ?? "free");
      const limit = isAdmin ? -1 : (PLAN_LIMITS[plan] ?? 0);
      const used = usage?.count ?? 0;
      setQuota({ used, limit, plan });
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Card className="p-6 flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando consumo…
      </Card>
    );
  }

  if (!quota) {
    return (
      <Card className="p-6 text-muted-foreground">
        Faça login para ver seu consumo.
      </Card>
    );
  }

  const unlimited = quota.limit < 0;
  const remaining = unlimited ? Infinity : Math.max(0, quota.limit - quota.used);
  const pct = unlimited ? 100 : quota.limit === 0 ? 0 : Math.min(100, (quota.used / quota.limit) * 100);
  const exhausted = !unlimited && remaining === 0;
  const isFree = quota.plan === "free";

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">Geração de imagens — hoje</h3>
            <p className="text-xs text-muted-foreground">Cota diária reinicia à meia-noite (Brasília)</p>
          </div>
        </div>
        <div className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground inline-flex items-center gap-1">
          {quota.plan === "master" && <Crown className="h-3 w-3" />}
          {quota.plan === "admin" && <Sparkles className="h-3 w-3" />}
          {PLAN_LABEL[quota.plan] ?? quota.plan}
        </div>
      </div>

      {unlimited ? (
        <div className="text-2xl font-bold">{quota.used} <span className="text-sm font-normal text-muted-foreground">geradas hoje · sem limite</span></div>
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold">
              {quota.used} <span className="text-sm font-normal text-muted-foreground">/ {quota.limit}</span>
            </div>
            <div className={`text-sm font-medium ${exhausted ? "text-destructive" : "text-muted-foreground"}`}>
              {exhausted ? "Cota esgotada" : `${remaining} restante${remaining === 1 ? "" : "s"}`}
            </div>
          </div>
          <Progress value={pct} />
        </>
      )}

      {!compact && (isFree || exhausted) && (
        <div className="pt-2 border-t border-border">
          <p className="text-sm text-muted-foreground mb-3">
            {isFree
              ? "Geração de imagem não está no plano gratuito. Faça upgrade para liberar."
              : "Você atingiu o limite diário. Faça upgrade ou volte amanhã."}
          </p>
          <Button onClick={() => navigate("/planos")} className="w-full">
            Ver planos
          </Button>
        </div>
      )}

      {!compact && (
        <div className="pt-3 border-t border-border flex gap-2 text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary/70" />
          <p>
            <strong className="text-foreground">Por que esse limite?</strong> O foco da Kera é
            ser sua copiloto inteligente — chat, agentes especialistas, voz, análise de código
            e segurança. Geração de imagem e vídeo é um <em>extra</em> — a Kera faz muito bem,
            mas o limite diário existe pra manter os planos acessíveis sem inflar o preço.
          </p>
        </div>
      )}
    </Card>
  );
}