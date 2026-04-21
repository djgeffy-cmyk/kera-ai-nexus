import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Carrega informações de acesso do usuário logado:
 * - selectedAgents: chaves dos agentes que ele liberou no onboarding
 * - onboardingCompleted: se já passou pela tela de escolha
 * - isAdmin: admin enxerga todos os agentes
 */
export function useUserAccess() {
  const [loading, setLoading] = useState(true);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }
      if (!cancelled) setUserId(u.user.id);

      const [{ data: profile }, { data: adminFlag }] = await Promise.all([
        supabase
          .from("profiles")
          .select("selected_agents, onboarding_completed")
          .eq("user_id", u.user.id)
          .maybeSingle(),
        supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" }),
      ]);

      if (cancelled) return;

      setSelectedAgents((profile?.selected_agents as string[] | null) ?? []);
      setOnboardingCompleted(!!profile?.onboarding_completed);
      setIsAdmin(!!adminFlag);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Admin OU área marcada na seleção do usuário */
  const canAccess = (agentKey: string) => {
    if (isAdmin) return true;
    // "kera" (generalista) é sempre liberada — porta de entrada
    if (agentKey === "kera") return true;
    return selectedAgents.includes(agentKey);
  };

  return {
    loading,
    isAdmin,
    userId,
    selectedAgents,
    onboardingCompleted,
    canAccess,
  };
}