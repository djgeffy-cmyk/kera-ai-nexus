CREATE TABLE public.monitor_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.monitor_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Targets select own" ON public.monitor_targets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Targets insert own" ON public.monitor_targets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Targets update own" ON public.monitor_targets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Targets delete own" ON public.monitor_targets
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_monitor_targets_updated_at
  BEFORE UPDATE ON public.monitor_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();