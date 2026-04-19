// Detecta pedidos de geração de imagem em PT-BR
// IMPORTANTE: "imagina/imagine" sozinho é MUITO comum em fala coloquial
// ("imagina ir pra praia", "imagina só"), então só aceitamos quando vier
// seguido de palavra-chave visual (imagem/foto/cena/etc).
const TRIGGERS = [
  /\b(gera|cria|crie|gere|desenha|desenhe|fa[çc]a|produz|produza|me\s+d[aá])\s+(?:uma?\s+)?(imagem|foto|figura|ilustra[çc][ãa]o|desenho|arte|logo|pintura|render(?:iza[çc][ãa]o)?)\b/i,
  /\b(imagine|imagina)\s+(uma?\s+)?(imagem|foto|figura|cena|ilustra[çc][ãa]o|desenho|arte|pintura)\b/i,
  /\b(image\s+of|picture\s+of|draw\s+me|generate\s+an?\s+image)\b/i,
];

export function isImageRequest(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return TRIGGERS.some((r) => r.test(t));
}

// Extrai a descrição/cena para enviar ao gerador, removendo o gatilho
export function extractImagePrompt(text: string): string {
  let t = text.trim();
  // Remove prefixos comuns
  t = t.replace(/^(por\s+favor[,\s]+)?/i, "");
  t = t.replace(
    /^(gera|cria|crie|gere|desenha|desenhe|faz|fa[çc]a|produz|produza|me\s+d[aá]|imagine|imagina)\s+(?:uma?\s+)?(imagem|foto|figura|ilustra[çc][ãa]o|desenho|arte|logo|pintura|render(?:iza[çc][ãa]o)?)?(?:\s+(de|do|da|sobre|com|que|para))?\s*/i,
    "",
  );
  return t.trim() || text.trim();
}
