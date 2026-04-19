-- Tabela de gatilhos da Kera (zoeira por menção a pessoas)
CREATE TABLE public.kera_triggers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  keywords TEXT NOT NULL,
  regex_pattern TEXT,
  theme TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global',
  excluded_emails TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

-- Trigger pra atualizar updated_at
CREATE TRIGGER update_kera_triggers_updated_at
BEFORE UPDATE ON public.kera_triggers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: só admin gerencia
ALTER TABLE public.kera_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read kera triggers"
  ON public.kera_triggers FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert kera triggers"
  ON public.kera_triggers FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update kera triggers"
  ON public.kera_triggers FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete kera triggers"
  ON public.kera_triggers FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed inicial: os 4 gatilhos atuais (Rodrigo, Geverson, Daniel Ferrari, Denis)
INSERT INTO public.kera_triggers (name, keywords, regex_pattern, theme, scope, excluded_emails, sort_order) VALUES
(
  'Rodrigo',
  'rodrigo, professor linguiça',
  '\brodrig[oa]\b|\bprofessor linguiç?a\b',
  '**TEMA-CHAVE (sempre):** chamar os sistemas dele de **"sisteminha"** (palavra que ele ODEIA).
**Use "sisteminha" pelo menos 2x na resposta**, mas com VARIAÇÃO — diferentes contextos, comparações, motivos. Inspirações:
- "sisteminha de novo travou? que surpresa…"
- "Rodrigo deve estar benzendo o sisteminha agora"
- "deixa eu adivinhar, mais um sisteminha precisando de gambiarra"
- "sisteminha do Rodrigo: rodando em 1 core e uma reza"
- "essa magia negra do sisteminha só o Rodrigo entende"',
  'global',
  ARRAY[]::TEXT[],
  10
),
(
  'Geverson',
  'geverson, dj geffy, dalpra',
  '\bgeverson\b|\bdj\.?\s*geffy\b|\bdalpra\b',
  '**TEMA-CHAVE (sempre):** implicar com a **rede da prefeitura** (lentidão, gambiarras, switch antigo, Wi-Fi caindo, cabo no chão, latência absurda) — Geverson ODEIA quando falam mal da rede dele.
VARIE a piada toda vez, NUNCA repita a mesma frase. Inspirações:
- "rede da prefeitura travando? culpa do Geverson, manda ele olhar o switch"
- "o ping não mente, Geverson, aceita"
- "aposto que o Wi-Fi caiu enquanto o Geverson lia isso"
- "rede do Geverson: latência de tartaruga, uptime de político"
- "Geverson vai jurar que tá tudo perfeito… até o próximo cabo solto"',
  'global',
  ARRAY['dj.geffy@gmail.com']::TEXT[],
  20
),
(
  'Daniel Ferrari',
  'daniel ferrari, ferrari',
  '\bdaniel\s+ferrari\b|\bferrari\b',
  '**TEMA-CHAVE (sempre, mistura os DOIS):**
1. **Baixinho** → comparar com **Oompa Loompa** (Fábrica de Chocolate do Wonka).
2. **Telecom quebrada** → ramal mudo, VoIP caindo, ligação não completa, telefonia anos 90.
VARIE as piadas a cada resposta, NUNCA repita literal. Inspirações:
- "Oompa Loompa das telecom apareceu de novo"
- "baixinho lá do Wonka, agora cuidando de ramal"
- "o VoIP do Ferrari só funciona em ano bissexto"
- "telecom do Daniel: tecnologia de ponta dos anos 90"
- "tamanho Oompa Loompa, problemas tamanho família"
- "Ferrari + telefonia da prefeitura = silêncio constitucional"
Mistura os DOIS ângulos.',
  'global',
  ARRAY[]::TEXT[],
  30
),
(
  'Denis (vice-prefeito)',
  'denis, vice-prefeito, vice prefeito',
  '\bdenis\b|\bvice[-\s]?prefeito\b',
  '**TEMA-CHAVE (sempre, mistura os DOIS):**
1. **Sorvete** → ele come sorvete demais, fato notório.
2. **Treino de verdade** → ele finge que treina mas não sua.
SEMPRE pega no pé, mesmo em pergunta séria. Inspirações:
- "o Denis de novo? aposto que tá com casquinha na mão"
- "fala pro Denis trocar o sorvete por whey"
- "Denis, larga a colher e pega a barra"
- "treino de verdade, Denis — caminhada até a sorveteria não conta"
- "vice-prefeito não pode ser caricatura de gordinho simpático"',
  'agent:kera-nutri',
  ARRAY[]::TEXT[],
  40
);