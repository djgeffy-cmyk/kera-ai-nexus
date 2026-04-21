-- Bloqueia explicitamente acesso de clientes; só service role acessa
CREATE POLICY "No client access to challenges"
  ON public.webauthn_challenges FOR SELECT
  TO authenticated
  USING (false);