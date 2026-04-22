
-- Municípios EngeGov atendidos
CREATE TABLE public.engegov_municipios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  uf text NOT NULL,
  cidade_id integer NOT NULL,
  slug text,
  notes text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (cidade_id)
);

ALTER TABLE public.engegov_municipios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read engegov municipios"
  ON public.engegov_municipios FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert engegov municipios"
  ON public.engegov_municipios FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update engegov municipios"
  ON public.engegov_municipios FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete engegov municipios"
  ON public.engegov_municipios FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_engegov_municipios_updated
  BEFORE UPDATE ON public.engegov_municipios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cache de scraping
CREATE TABLE public.engegov_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  cidade_id integer NOT NULL,
  tipo text NOT NULL,         -- 'lista' | 'detalhe'
  obra_id text,               -- preenchido quando tipo='detalhe'
  url text,
  response jsonb NOT NULL,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_hit_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '6 hours')
);

ALTER TABLE public.engegov_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read engegov cache"
  ON public.engegov_cache FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete engegov cache"
  ON public.engegov_cache FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_engegov_cache_key ON public.engegov_cache(cache_key);
CREATE INDEX idx_engegov_cache_expires ON public.engegov_cache(expires_at);
CREATE INDEX idx_engegov_municipios_enabled ON public.engegov_municipios(enabled) WHERE enabled = true;
