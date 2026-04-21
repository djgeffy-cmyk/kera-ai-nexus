ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS selected_agents text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;