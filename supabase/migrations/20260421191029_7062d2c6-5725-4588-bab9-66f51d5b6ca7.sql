
-- Adiciona campos no profiles para sincronizar status do SpaceInCloud (Growth FIT)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS spaceincloud_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS spaceincloud_synced_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS spaceincloud_external_id text;

-- RPC para admin liberar/revogar manualmente o acesso Growth FIT (SpaceInCloud)
CREATE OR REPLACE FUNCTION public.admin_set_spaceincloud_active(_target_user uuid, _active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores.';
  END IF;

  UPDATE public.profiles
  SET spaceincloud_active = _active,
      spaceincloud_synced_at = now(),
      updated_at = now()
  WHERE user_id = _target_user;
END;
$function$;
