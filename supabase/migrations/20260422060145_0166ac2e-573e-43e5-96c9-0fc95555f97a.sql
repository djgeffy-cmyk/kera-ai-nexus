CREATE OR REPLACE FUNCTION public.consume_image_quota(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan text;
  v_limit int;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_used int;
  v_is_admin boolean;
BEGIN
  SELECT public.has_role(_user_id, 'admin'::public.app_role) INTO v_is_admin;
  IF v_is_admin THEN
    INSERT INTO public.image_quota_usage (user_id, usage_date, count)
    VALUES (_user_id, v_today, 1)
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET count = public.image_quota_usage.count + 1, updated_at = now()
    RETURNING count INTO v_used;
    RETURN jsonb_build_object('allowed', true, 'used', v_used, 'limit', -1, 'plan', 'admin');
  END IF;

  SELECT COALESCE(plan_tier, 'free') INTO v_plan
  FROM public.profiles WHERE user_id = _user_id;

  v_limit := CASE COALESCE(v_plan, 'free')
    WHEN 'master' THEN 10
    WHEN 'pro' THEN 3
    WHEN 'essencial' THEN 1
    ELSE 0
  END;

  SELECT COALESCE(count, 0) INTO v_used
  FROM public.image_quota_usage
  WHERE user_id = _user_id AND usage_date = v_today;

  IF v_used IS NULL THEN v_used := 0; END IF;

  IF v_used >= v_limit THEN
    RETURN jsonb_build_object('allowed', false, 'used', v_used, 'limit', v_limit, 'plan', v_plan);
  END IF;

  INSERT INTO public.image_quota_usage (user_id, usage_date, count)
  VALUES (_user_id, v_today, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET count = public.image_quota_usage.count + 1, updated_at = now()
  RETURNING count INTO v_used;

  RETURN jsonb_build_object('allowed', true, 'used', v_used, 'limit', v_limit, 'plan', v_plan);
END;
$function$;