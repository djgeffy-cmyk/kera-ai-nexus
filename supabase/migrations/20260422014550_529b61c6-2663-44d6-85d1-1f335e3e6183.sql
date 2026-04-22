CREATE TABLE public.demo_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_hash text NOT NULL UNIQUE,
  count integer NOT NULL DEFAULT 0,
  first_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_demo_usage_ip_hash ON public.demo_usage(ip_hash);

ALTER TABLE public.demo_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read demo usage"
  ON public.demo_usage
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));