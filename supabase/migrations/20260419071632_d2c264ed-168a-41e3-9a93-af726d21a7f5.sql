ALTER TABLE public.kera_triggers
  ADD COLUMN IF NOT EXISTS intensity text NOT NULL DEFAULT 'medio';

-- Validação por trigger (CHECK constraints podem dar problema; usar trigger é mais flexível)
CREATE OR REPLACE FUNCTION public.validate_kera_trigger_intensity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.intensity NOT IN ('leve','medio','pesado') THEN
    RAISE EXCEPTION 'intensity inválida: %, use leve | medio | pesado', NEW.intensity;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_kera_trigger_intensity ON public.kera_triggers;
CREATE TRIGGER trg_validate_kera_trigger_intensity
BEFORE INSERT OR UPDATE ON public.kera_triggers
FOR EACH ROW
EXECUTE FUNCTION public.validate_kera_trigger_intensity();