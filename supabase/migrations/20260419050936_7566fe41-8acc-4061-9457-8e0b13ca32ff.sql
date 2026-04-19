CREATE TABLE public.licitacoes_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hash text NOT NULL UNIQUE,
  numero text,
  modalidade text,
  objeto text,
  status text,
  data_abertura text,
  data_encerramento text,
  valor text,
  vencedor text,
  link text,
  raw jsonb,
  source_url text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  is_open boolean NOT NULL DEFAULT true
);

ALTER TABLE public.licitacoes_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read snapshots"
  ON public.licitacoes_snapshot FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_licitacoes_snapshot_open ON public.licitacoes_snapshot(is_open);
CREATE INDEX idx_licitacoes_snapshot_last_seen ON public.licitacoes_snapshot(last_seen_at DESC);

CREATE TABLE public.licitacoes_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid REFERENCES public.licitacoes_snapshot(id) ON DELETE CASCADE,
  numero text,
  modalidade text,
  objeto text,
  status text,
  data_encerramento text,
  valor text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.licitacoes_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read alerts"
  ON public.licitacoes_alerts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update alerts"
  ON public.licitacoes_alerts FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_licitacoes_alerts_created ON public.licitacoes_alerts(created_at DESC);
CREATE INDEX idx_licitacoes_alerts_unread ON public.licitacoes_alerts(read_at) WHERE read_at IS NULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.licitacoes_alerts;
ALTER TABLE public.licitacoes_alerts REPLICA IDENTITY FULL;