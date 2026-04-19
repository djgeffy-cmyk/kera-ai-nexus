CREATE TABLE public.ipm_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  base_url text NOT NULL,
  kind text NOT NULL DEFAULT 'public',
  auth_type text NOT NULL DEFAULT 'none',
  token text,
  notes text,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ipm_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins select ipm endpoints"
  ON public.ipm_endpoints FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins insert ipm endpoints"
  ON public.ipm_endpoints FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update ipm endpoints"
  ON public.ipm_endpoints FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete ipm endpoints"
  ON public.ipm_endpoints FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_ipm_endpoints_updated_at
  BEFORE UPDATE ON public.ipm_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ipm_endpoints_enabled ON public.ipm_endpoints(enabled);