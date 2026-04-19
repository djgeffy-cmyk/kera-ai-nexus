-- Tabela de pedidos de reset de senha (admin aprova)
CREATE TABLE public.password_reset_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID
);

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode pedir reset (insert público) — sem auth, pois esqueceu a senha
CREATE POLICY "Anyone can request password reset"
ON public.password_reset_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Só admin vê e gerencia
CREATE POLICY "Admins view all reset requests"
ON public.password_reset_requests
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update reset requests"
ON public.password_reset_requests
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete reset requests"
ON public.password_reset_requests
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_password_reset_status ON public.password_reset_requests(status, requested_at DESC);