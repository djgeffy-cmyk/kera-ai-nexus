
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles select own" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Profiles insert own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Profiles update own" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Conv select own" ON public.conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Conv insert own" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Conv update own" ON public.conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Conv delete own" ON public.conversations FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_conversations_user ON public.conversations(user_id, updated_at DESC);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Msg select own" ON public.messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Msg insert own" ON public.messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Msg delete own" ON public.messages FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_messages_conv ON public.messages(conversation_id, created_at ASC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_conv_updated BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
