-- Adiciona coluna de plano no profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'free';

-- Tabela de uso diário de imagens
CREATE TABLE IF NOT EXISTS public.image_quota_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  usage_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_image_quota_user_date
  ON public.image_quota_usage (user_id, usage_date DESC);

ALTER TABLE public.image_quota_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own image quota" ON public.image_quota_usage;
CREATE POLICY "Users view own image quota"
  ON public.image_quota_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Função que consome 1 imagem da cota diária do usuário, respeitando o plano.
-- Retorna jsonb { allowed, used, limit, plan }.
-- SECURITY DEFINER pra rodar mesmo com RLS (a edge function chama com o user_id do JWT).
CREATE OR REPLACE FUNCTION public.consume_image_quota(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_limit int;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_used int;
  v_is_admin boolean;
BEGIN
  -- Admin não tem limite
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
    WHEN 'master' THEN 50
    WHEN 'pro' THEN 10
    WHEN 'essencial' THEN 1
    ELSE 0
  END;

  -- Pega uso atual (sem incrementar ainda)
  SELECT COALESCE(count, 0) INTO v_used
  FROM public.image_quota_usage
  WHERE user_id = _user_id AND usage_date = v_today;

  IF v_used IS NULL THEN v_used := 0; END IF;

  IF v_used >= v_limit THEN
    RETURN jsonb_build_object('allowed', false, 'used', v_used, 'limit', v_limit, 'plan', v_plan);
  END IF;

  -- Incrementa atomicamente
  INSERT INTO public.image_quota_usage (user_id, usage_date, count)
  VALUES (_user_id, v_today, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET count = public.image_quota_usage.count + 1, updated_at = now()
  RETURNING count INTO v_used;

  RETURN jsonb_build_object('allowed', true, 'used', v_used, 'limit', v_limit, 'plan', v_plan);
END;
$$;