import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

/**
 * Resultado da verificação de acesso via Stripe.
 * - `allowed`: pode entrar no space.kera.
 * - `reason`: motivo técnico (admin, active_subscription, no_active_subscription...).
 * - `loading`: ainda checando.
 */
export interface StripeAccessState {
  loading: boolean;
  allowed: boolean | null;
  reason: string | null;
  message: string | null;
}

/**
 * Consulta a edge function `check-stripe-access` toda vez que a sessão muda.
 * Admins sempre passam (a edge function decide isso).
 */
export function useStripeAccess(session: Session | null, ready: boolean): StripeAccessState {
  const [state, setState] = useState<StripeAccessState>({
    loading: true, allowed: null, reason: null, message: null,
  });

  useEffect(() => {
    if (!ready) return;
    if (!session?.user) {
      setState({ loading: false, allowed: null, reason: null, message: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));

    supabase.functions.invoke("check-stripe-access", { body: {} })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setState({
            loading: false, allowed: false, reason: "invoke_error",
            message: error.message,
          });
          return;
        }
        setState({
          loading: false,
          allowed: !!data?.allowed,
          reason: data?.reason ?? null,
          message: data?.message ?? null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          loading: false, allowed: false, reason: "exception",
          message: err instanceof Error ? err.message : String(err),
        });
      });

    return () => { cancelled = true; };
  }, [session?.user?.id, ready]);

  return state;
}