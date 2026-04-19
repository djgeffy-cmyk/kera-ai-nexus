
-- 1) Enum de roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2) Tabela user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3) Função security definer para checar role (evita recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4) RLS para user_roles: usuário lê o próprio; admin gerencia tudo
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5) Marcar dj.geffy@gmail.com como admin (se já existir)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'dj.geffy@gmail.com'
ON CONFLICT DO NOTHING;

-- 6) Trigger que bloqueia signup fora da whitelist
CREATE OR REPLACE FUNCTION public.enforce_email_whitelist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(NEW.email);
BEGIN
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Email é obrigatório.';
  END IF;

  IF v_email = 'dj.geffy@gmail.com'
     OR v_email LIKE '%@guaramirim.sc.gov.br' THEN
    -- Auto-promove dj.geffy a admin no primeiro signup
    IF v_email = 'dj.geffy@gmail.com' THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'admin'::public.app_role)
      ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Cadastro permitido apenas para emails @guaramirim.sc.gov.br.';
END;
$$;

DROP TRIGGER IF EXISTS enforce_email_whitelist_trigger ON auth.users;
CREATE TRIGGER enforce_email_whitelist_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_email_whitelist();

-- 7) Restringir monitor_targets a admins (Sentinela)
DROP POLICY IF EXISTS "Users can view their own monitor targets" ON public.monitor_targets;
DROP POLICY IF EXISTS "Users can insert their own monitor targets" ON public.monitor_targets;
DROP POLICY IF EXISTS "Users can update their own monitor targets" ON public.monitor_targets;
DROP POLICY IF EXISTS "Users can delete their own monitor targets" ON public.monitor_targets;

CREATE POLICY "Admins manage monitor targets - select"
  ON public.monitor_targets FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage monitor targets - insert"
  ON public.monitor_targets FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage monitor targets - update"
  ON public.monitor_targets FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage monitor targets - delete"
  ON public.monitor_targets FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 8) Restringir leitura de network_metrics a admins (mantém insert de service)
DROP POLICY IF EXISTS "Users can view their own network metrics" ON public.network_metrics;

CREATE POLICY "Admins can view network metrics"
  ON public.network_metrics FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
