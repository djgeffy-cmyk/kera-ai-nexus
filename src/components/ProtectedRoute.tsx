import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

interface Props {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute = ({ children, requireAdmin = false }: Props) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // 1) Set up listener FIRST (sync only — no awaits)
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      // reset admin flag so it gets re-checked for the new user
      setIsAdmin(null);
    });

    // 2) THEN restore existing session from storage
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!session?.user) { setIsAdmin(false); return; }
    if (!requireAdmin) { setIsAdmin(true); return; }
    supabase
      .rpc("has_role", { _user_id: session.user.id, _role: "admin" })
      .then(({ data }) => setIsAdmin(!!data));
  }, [session, requireAdmin, authReady]);

  // Verifica se o usuário já completou o onboarding (escolha de áreas)
  useEffect(() => {
    if (!authReady) return;
    if (!session?.user) { setOnboardingChecked(true); setNeedsOnboarding(false); return; }
    supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setNeedsOnboarding(!data?.onboarding_completed);
        setOnboardingChecked(true);
      });
  }, [session, authReady]);

  // Wait until auth is restored AND (if needed) admin check finished
  if (!authReady || isAdmin === null || !onboardingChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-display text-primary text-glow animate-pulse">KERA</div>
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" replace />;
  // Se ainda não escolheu áreas, manda pro onboarding (exceto se já está nele)
  if (needsOnboarding && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }
  if (requireAdmin && !isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h1 className="font-display text-3xl text-glow mb-3">Acesso restrito</h1>
          <p className="text-muted-foreground">
            Esta área é exclusiva para administradores. Volte ao chat para continuar.
          </p>
        </div>
      </main>
    );
  }
  return <>{children}</>;
};
