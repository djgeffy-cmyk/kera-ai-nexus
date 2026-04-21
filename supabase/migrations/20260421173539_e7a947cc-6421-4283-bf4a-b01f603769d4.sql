DROP TRIGGER IF EXISTS on_auth_user_created_whitelist ON auth.users;
DROP TRIGGER IF EXISTS enforce_email_whitelist_trigger ON auth.users;
DROP FUNCTION IF EXISTS public.enforce_email_whitelist();

CREATE OR REPLACE FUNCTION public.auto_promote_main_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = 'dj.geffy@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_admin_promote ON auth.users;
CREATE TRIGGER on_auth_user_created_admin_promote
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.auto_promote_main_admin();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS paywall_trial_count integer NOT NULL DEFAULT 0;