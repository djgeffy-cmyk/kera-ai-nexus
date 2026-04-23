
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS grok_allowed boolean NOT NULL DEFAULT false;

UPDATE public.profiles p
SET grok_allowed = true
FROM auth.users u
WHERE u.id = p.user_id
  AND lower(u.email) = 'dj.geffy@gmail.com';

CREATE OR REPLACE FUNCTION public.admin_set_grok_allowed(_target_user uuid, _allowed boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores.';
  END IF;

  UPDATE public.profiles
  SET grok_allowed = _allowed,
      updated_at = now()
  WHERE user_id = _target_user;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_list_users_usage();

CREATE OR REPLACE FUNCTION public.admin_list_users_usage()
RETURNS TABLE(
  user_id uuid,
  email text,
  display_name text,
  plan_tier text,
  selected_agents text[],
  onboarding_completed boolean,
  images_today integer,
  images_month integer,
  created_at timestamp with time zone,
  grok_allowed boolean
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
    u.created_at,
    COALESCE(p.grok_allowed, false) AS grok_allowed
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  ORDER BY images_month DESC, u.created_at DESC;
END;
$$;
