-- Adiciona colunas de controle de acesso para os novos módulos
ALTER TABLE public.profiles 
ADD COLUMN juridico_active BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN tech_active BOOLEAN NOT NULL DEFAULT false;

-- Atualiza a função de administração para suportar os novos módulos
-- Note: A função admin_set_spaceincloud_active já existe, vamos criar versões similares ou generalizar.
-- Para manter compatibilidade com o que já foi feito (AdminUso.tsx), vou criar funções específicas.

CREATE OR REPLACE FUNCTION public.admin_set_juridico_active(_target_user UUID, _active BOOLEAN)
RETURNS VOID AS $$
BEGIN
  -- Verifica se quem chama é admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.profiles
  SET juridico_active = _active
  WHERE user_id = _target_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_set_tech_active(_target_user UUID, _active BOOLEAN)
RETURNS VOID AS $$
BEGIN
  -- Verifica se quem chama é admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.profiles
  SET tech_active = _active
  WHERE user_id = _target_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
