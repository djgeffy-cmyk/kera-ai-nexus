-- Tabela de correções de pronúncia para o TTS da Kera
CREATE TABLE public.pronunciation_fixes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  word TEXT NOT NULL,
  replacement TEXT NOT NULL,
  case_sensitive BOOLEAN NOT NULL DEFAULT false,
  whole_word BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.pronunciation_fixes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read pronunciation fixes"
ON public.pronunciation_fixes FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert pronunciation fixes"
ON public.pronunciation_fixes FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update pronunciation fixes"
ON public.pronunciation_fixes FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete pronunciation fixes"
ON public.pronunciation_fixes FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_pronunciation_fixes_updated_at
BEFORE UPDATE ON public.pronunciation_fixes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed inicial com a correção do Geverson
INSERT INTO public.pronunciation_fixes (word, replacement, whole_word, case_sensitive, notes)
VALUES ('Geverson', 'Guêverson', true, false, 'Evitar TTS pronunciar como "Queverson"');