CREATE TABLE IF NOT EXISTS public.mp_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  payer_id text,
  preapproval_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  plan_tier text NOT NULL DEFAULT 'pro',
  reason text,
  amount numeric,
  currency text,
  next_payment_date timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mp_subscriptions_email_idx ON public.mp_subscriptions (lower(email));
CREATE INDEX IF NOT EXISTS mp_subscriptions_status_idx ON public.mp_subscriptions (status);

ALTER TABLE public.mp_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read mp subs" ON public.mp_subscriptions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins insert mp subs" ON public.mp_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update mp subs" ON public.mp_subscriptions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete mp subs" ON public.mp_subscriptions
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER mp_subscriptions_set_updated_at
  BEFORE UPDATE ON public.mp_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();