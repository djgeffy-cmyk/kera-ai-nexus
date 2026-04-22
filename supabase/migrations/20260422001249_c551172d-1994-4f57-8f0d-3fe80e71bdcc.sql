CREATE TABLE IF NOT EXISTS public.user_trigger_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_id uuid NOT NULL REFERENCES public.kera_triggers(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, trigger_id)
);

ALTER TABLE public.user_trigger_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trigger prefs select own"
  ON public.user_trigger_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "trigger prefs insert own"
  ON public.user_trigger_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "trigger prefs update own"
  ON public.user_trigger_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "trigger prefs delete own"
  ON public.user_trigger_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "trigger prefs admin read"
  ON public.user_trigger_preferences FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_user_trigger_preferences_updated_at
  BEFORE UPDATE ON public.user_trigger_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_user_trigger_prefs_user
  ON public.user_trigger_preferences (user_id);