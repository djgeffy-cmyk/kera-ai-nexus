-- 1) RLS: admins podem ver e atualizar todos os perfis (necessário pro gestor de planos)
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins update all profiles" ON public.profiles;
CREATE POLICY "Admins update all profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) Lista de uso (admin only) - junta profile + email + imagens hoje + imagens mês
CREATE OR REPLACE FUNCTION public.admin_list_users_usage()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  plan_tier text,
  selected_agents text[],
  onboarding_completed boolean,
  images_today integer,
  images_month integer,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_month_start date := date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores.';
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    u.email::text,
    p.display_name,
    COALESCE(p.plan_tier, 'free') AS plan_tier,
    COALESCE(p.selected_agents, ARRAY[]::text[]) AS selected_agents,
    p.onboarding_completed,
    COALESCE((SELECT count FROM public.image_quota_usage q
              WHERE q.user_id = p.user_id AND q.usage_date = v_today), 0) AS images_today,
    COALESCE((SELECT SUM(count)::int FROM public.image_quota_usage q
              WHERE q.user_id = p.user_id AND q.usage_date >= v_month_start), 0) AS images_month,
    u.created_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  ORDER BY images_month DESC, u.created_at DESC;
END;
$$;

-- 3) Atualiza plano de um usuário (admin only)
CREATE OR REPLACE FUNCTION public.admin_set_user_plan(_target_user uuid, _plan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores.';
  END IF;

  IF _plan NOT IN ('free','essencial','pro','master') THEN
    RAISE EXCEPTION 'Plano inválido: %', _plan;
  END IF;

  UPDATE public.profiles
  SET plan_tier = _plan, updated_at = now()
  WHERE user_id = _target_user;
END;
$$;