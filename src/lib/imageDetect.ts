// Detecta pedidos de geração de imagem em PT-BR
const TRIGGERS = [
  /\b(gera|cria|crie|gere|desenha|desenhe|faz|faça|fa[çc]a|produz|produza|me\s+d[aá])\s+(?:uma?\s+)?(imagem|foto|figura|ilustra[çc][ãa]o|desenho|arte|logo|pintura|render(?:iza[çc][ãa]o)?)\b/i,
  /\b(imagine|imagina)\s+/i,
  /\b(image\s+of|picture\s+of|draw\s+me)\b/i,
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
