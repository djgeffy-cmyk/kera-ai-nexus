-- Tabela de credenciais (passkeys) por usuário
CREATE TABLE public.webauthn_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  transports TEXT[] DEFAULT NULL,
  device_label TEXT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webauthn_credentials_user ON public.webauthn_credentials(user_id);
CREATE INDEX idx_webauthn_credentials_credid ON public.webauthn_credentials(credential_id);

ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own passkeys"
  ON public.webauthn_credentials FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own passkeys"
  ON public.webauthn_credentials FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- inserts/updates só via service role (edge functions)

-- Tabela temporária de desafios (registro e autenticação)
CREATE TABLE public.webauthn_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  challenge TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('registration','authentication')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webauthn_challenges_user ON public.webauthn_challenges(user_id);
CREATE INDEX idx_webauthn_challenges_email ON public.webauthn_challenges(email);

ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- nenhuma policy: só service role acessa