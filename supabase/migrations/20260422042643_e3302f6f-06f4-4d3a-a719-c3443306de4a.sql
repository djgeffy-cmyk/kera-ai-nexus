-- Adiciona controle de troca de senha obrigatória e acesso manual a agentes
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS granted_agent_keys TEXT[] DEFAULT '{}';

-- Comentário para documentação interna
COMMENT ON COLUMN public.profiles.must_change_password IS 'Se verdadeiro, o usuário é redirecionado para trocar a senha logo após o login.';
COMMENT ON COLUMN public.profiles.granted_agent_keys IS 'Lista de chaves de agentes (ex: kera-dev) que este usuário pode usar sem depender de planos globais.';

-- Garante que usuários novos (ou resetados) possam atualizar seu próprio perfil de senha
CREATE POLICY "Users can update their own password status"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);
