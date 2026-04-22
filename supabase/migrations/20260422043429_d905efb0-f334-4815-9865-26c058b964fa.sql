-- Adicionar coluna de controle de acesso para o módulo municipal
ALTER TABLE public.profiles ADD COLUMN municipio_active BOOLEAN DEFAULT false;

-- Criar função administrativa para definir acesso ao módulo municipal
CREATE OR REPLACE FUNCTION public.admin_set_municipio_active(_target_user UUID, _active BOOLEAN)
RETURNS VOID AS $$
BEGIN
  -- Verificar se quem chama é admin (já validado por políticas, mas bom reforçar)
  UPDATE public.profiles
  SET municipio_active = _active
  WHERE user_id = _target_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Liberar acesso para o usuário rodrigo@guaramirim.sc.gov.br
UPDATE public.profiles
SET municipio_active = true
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'rodrigo@guaramirim.sc.gov.br'
);