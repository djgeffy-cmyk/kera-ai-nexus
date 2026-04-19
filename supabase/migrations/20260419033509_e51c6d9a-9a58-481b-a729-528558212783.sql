-- Extensões para agendamento e chamadas HTTP
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Tabela de histórico
CREATE TABLE public.network_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  target_id UUID,
  label TEXT NOT NULL,
  host TEXT NOT NULL,
  url TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  received INTEGER NOT NULL DEFAULT 0,
  loss_pct INTEGER NOT NULL DEFAULT 0,
  min_ms INTEGER,
  avg_ms INTEGER,
  max_ms INTEGER,
  jitter_ms INTEGER,
  last_status INTEGER,
  resolved_ip TEXT,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_network_metrics_user_host_time
  ON public.network_metrics (user_id, host, checked_at DESC);

CREATE INDEX idx_network_metrics_checked_at
  ON public.network_metrics (checked_at DESC);

-- RLS
ALTER TABLE public.network_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Metrics select own"
  ON public.network_metrics
  FOR SELECT
  USING (auth.uid() = user_id);

-- Não permitimos insert/update/delete via cliente (somente service role)
-- Service role bypassa RLS, então não precisa policy.