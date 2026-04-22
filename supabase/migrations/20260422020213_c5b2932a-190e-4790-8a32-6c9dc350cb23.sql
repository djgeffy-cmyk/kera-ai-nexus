-- Tabela de log de tentativas de abuso (após atingir o limite do demo)
CREATE TABLE public.demo_abuse_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_hash text NOT NULL,
  attempted_count integer NOT NULL,
  attempted_at timestamp with time zone NOT NULL DEFAULT now(),
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index para auditoria por IP e por tempo
CREATE INDEX idx_demo_abuse_log_ip_hash ON public.demo_abuse_log(ip_hash);
CREATE INDEX idx_demo_abuse_log_attempted_at ON public.demo_abuse_log(attempted_at DESC);

-- RLS habilitado
ALTER TABLE public.demo_abuse_log ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler. Inserts vêm via service role (edge function), então
-- não precisa de policy de INSERT para clientes.
CREATE POLICY "Admins read demo abuse log"
ON public.demo_abuse_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));