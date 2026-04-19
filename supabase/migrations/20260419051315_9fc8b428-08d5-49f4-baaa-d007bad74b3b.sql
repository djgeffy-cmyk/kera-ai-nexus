-- Cache de respostas da função ipm-query para reduzir custo de Firecrawl
CREATE TABLE public.ipm_query_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL,
  filtro_status TEXT,
  endpoint_id UUID,
  url TEXT,
  path TEXT,
  response JSONB NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_hit_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '6 hours')
);

CREATE INDEX idx_ipm_query_cache_key ON public.ipm_query_cache(cache_key);
CREATE INDEX idx_ipm_query_cache_expires ON public.ipm_query_cache(expires_at);

ALTER TABLE public.ipm_query_cache ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver / gerenciar o cache (a função usa service role e ignora RLS)
CREATE POLICY "Admins read ipm cache"
ON public.ipm_query_cache FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete ipm cache"
ON public.ipm_query_cache FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));