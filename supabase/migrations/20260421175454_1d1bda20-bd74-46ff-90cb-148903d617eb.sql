CREATE OR REPLACE FUNCTION public.admin_image_usage_daily(_days int DEFAULT 30)
RETURNS TABLE(usage_date date, total_images bigint, unique_users bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_start date := v_today - (_days - 1);
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores.';
  END IF;

  RETURN QUERY
  WITH series AS (
    SELECT generate_series(v_start, v_today, interval '1 day')::date AS d
  )
  SELECT
    s.d AS usage_date,
    COALESCE(SUM(q.count), 0)::bigint AS total_images,
    COUNT(DISTINCT q.user_id)::bigint AS unique_users
  FROM series s
  LEFT JOIN public.image_quota_usage q ON q.usage_date = s.d
  GROUP BY s.d
  ORDER BY s.d ASC;
END;
$$;