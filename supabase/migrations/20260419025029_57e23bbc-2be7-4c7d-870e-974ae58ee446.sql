
-- Tabela de agentes customizados
CREATE TABLE public.agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'sparkles',
  color TEXT NOT NULL DEFAULT 'cyan',
  description TEXT,
  system_prompt TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents select own" ON public.agents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Agents insert own" ON public.agents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Agents update own" ON public.agents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Agents delete own" ON public.agents FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_agents_updated_at
BEFORE UPDATE ON public.agents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Adiciona coluna de agente nas conversas (opcional, identifica qual persona)
ALTER TABLE public.conversations
  ADD COLUMN agent_key TEXT NOT NULL DEFAULT 'kera';
