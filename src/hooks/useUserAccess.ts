import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { canSeeAgent, GUARAMIRIM_EMAIL_DOMAIN, KERA_FIT_AGENT_KEYS } from "@/lib/agents";

/** Quantas perguntas "palhinha" o usuário pode fazer a um agente bloqueado antes do paywall. */
export const PAYWALL_FREE_TRIES = 3;

/**
 * Agentes que fazem parte do pacote Kera Fit (Kera + SpaceInCloud).
 * Quem tem `spaceincloud_active = true` no profile vê esses 3 liberados,
 * independentemente do plano padrão.
 */
export const FIT_AGENT_KEYS = new Set<string>(KERA_FIT_AGENT_KEYS);

/**
 * Carrega informações de acesso do usuário logado:
 * - selectedAgents: chaves dos agentes que ele liberou no onboarding
 * - onboardingCompleted: se já passou pela tela de escolha
 * - isAdmin: admin enxerga todos os agentes
 * - paywallTrialCount: nº de perguntas a agentes bloqueados já consumidas
 * - spaceincloudActive: usuário tem o pacote Growth FIT (Kera + SpaceInCloud) ativo
 */
export function useUserAccess() {
  const [loading, setLoading] = useState(true);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
   const [paywallTrialCount, setPaywallTrialCount] = useState<number>(0);
   const [spaceincloudActive, setSpaceincloudActive] = useState<boolean>(false);
   const [juridicoActive, setJuridicoActive] = useState<boolean>(false);
    const [techActive, setTechActive] = useState<boolean>(false);
    const [municipioActive, setMunicipioActive] = useState<boolean>(false);
   const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);
   const [grantedAgentKeys, setGrantedAgentKeys] = useState<string[]>([]);

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
            .select("selected_agents, onboarding_completed, paywall_trial_count, spaceincloud_active, juridico_active, tech_active, municipio_active, must_change_password, granted_agent_keys")
           .eq("user_id", u.user.id)
           .maybeSingle(),
        supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" }),
      ]);

      if (cancelled) return;

      setSelectedAgents((profile?.selected_agents as string[] | null) ?? []);
      setOnboardingCompleted(!!profile?.onboarding_completed);
      setPaywallTrialCount(((profile as any)?.paywall_trial_count as number | null) ?? 0);
       setSpaceincloudActive(!!(profile as any)?.spaceincloud_active);
       setJuridicoActive(!!(profile as any)?.juridico_active);
        setTechActive(!!(profile as any)?.tech_active);
        setMunicipioActive(!!(profile as any)?.municipio_active);
       setMustChangePassword(!!(profile as any)?.must_change_password);
       setGrantedAgentKeys((profile as any)?.granted_agent_keys || []);
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
     // Pacote Growth FIT — libera nutri/treinador/iron pra quem tem SpaceInCloud ativo.
     if (spaceincloudActive && FIT_AGENT_KEYS.has(agentKey)) return true;
 
     // Módulo Jurídico
     const juridicoKeys = ["kera-juridica", "kera-familia", "kera-sucessoes", "kera-personalidade", "kera-curatela"];
     if (juridicoActive && juridicoKeys.includes(agentKey)) return true;
 
     // Módulo Tecnologia
     const techKeys = ["kera-dev", "kera-sec", "kera-security-nasa", "kera-sentinela"];
     if (techActive && techKeys.includes(agentKey)) return true;

     // Agentes liberados manualmente (Admin concedeu acesso)
     if (grantedAgentKeys.includes(agentKey)) return true;

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
    spaceincloudActive,
    municipioActive,
    canAccess,
    canSee,
    consumeTrial,
    mustChangePassword,
    grantedAgentKeys,
  };
}