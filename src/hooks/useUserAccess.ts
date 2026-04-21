import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { canSeeAgent, GUARAMIRIM_EMAIL_DOMAIN } from "@/lib/agents";

/** Quantas perguntas "palhinha" o usuário pode fazer a um agente bloqueado antes do paywall. */
export const PAYWALL_FREE_TRIES = 3;

/**
 * Carrega informações de acesso do usuário logado:
 * - selectedAgents: chaves dos agentes que ele liberou no onboarding
 * - onboardingCompleted: se já passou pela tela de escolha
 * - isAdmin: admin enxerga todos os agentes
 * - paywallTrialCount: nº de perguntas a agentes bloqueados já consumidas
 */
export function useUserAccess() {
  const [loading, setLoading] = useState(true);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [paywallTrialCount, setPaywallTrialCount] = useState<number>(0);

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
      if (!cancelled) {
        setUserId(u.user.id);
        setUserEmail(u.user.email ?? null);
      }

      const [{ data: profile }, { data: adminFlag }] = await Promise.all([
        supabase
          .from("profiles")
          .select("selected_agents, onboarding_completed, paywall_trial_count")
          .eq("user_id", u.user.id)
          .maybeSingle(),
        supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" }),
      ]);

      if (cancelled) return;

      setSelectedAgents((profile?.selected_agents as string[] | null) ?? []);
      setOnboardingCompleted(!!profile?.onboarding_completed);
      setPaywallTrialCount(((profile as any)?.paywall_trial_count as number | null) ?? 0);
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
    // Agentes da Prefeitura de Guaramirim já vêm liberados pra emails do domínio.
    if (
      agentKey === "kera-sentinela" &&
      (userEmail ?? "").toLowerCase().endsWith(GUARAMIRIM_EMAIL_DOMAIN)
    ) {
      return true;
    }
    return selectedAgents.includes(agentKey);
  };

  /** Esconde totalmente agentes restritos pra quem não é admin nem da prefeitura. */
  const canSee = (agentKey: string) =>
    canSeeAgent(agentKey, { isAdmin, email: userEmail });

  /**
   * Tenta consumir 1 "palhinha" para um agente bloqueado.
   * Retorna:
   *  - { allowed: true, remaining }: pode mandar a pergunta (e já incrementou no banco).
   *  - { allowed: false, remaining: 0 }: estourou o limite — UI deve redirecionar p/ /planos.
   * Se o agente já está liberado, retorna allowed:true sem consumir nada.
   */
  const consumeTrial = async (agentKey: string): Promise<{ allowed: boolean; remaining: number; wasTrial: boolean }> => {
    if (canAccess(agentKey)) return { allowed: true, remaining: PAYWALL_FREE_TRIES, wasTrial: false };
    if (!userId) return { allowed: false, remaining: 0, wasTrial: true };
    if (paywallTrialCount >= PAYWALL_FREE_TRIES) {
      return { allowed: false, remaining: 0, wasTrial: true };
    }
    const next = paywallTrialCount + 1;
    const { error } = await supabase
      .from("profiles")
      .update({ paywall_trial_count: next } as any)
      .eq("user_id", userId);
    if (error) return { allowed: false, remaining: PAYWALL_FREE_TRIES - paywallTrialCount, wasTrial: true };
    setPaywallTrialCount(next);
    return { allowed: true, remaining: PAYWALL_FREE_TRIES - next, wasTrial: true };
  };

  return {
    loading,
    isAdmin,
    userId,
    userEmail,
    selectedAgents,
    onboardingCompleted,
    paywallTrialCount,
    trialsRemaining: Math.max(0, PAYWALL_FREE_TRIES - paywallTrialCount),
    canAccess,
    canSee,
    consumeTrial,
  };
}