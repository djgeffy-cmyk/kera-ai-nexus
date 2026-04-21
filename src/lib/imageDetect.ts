// Detecta pedidos de geração de imagem em PT-BR
// IMPORTANTE: "imagina/imagine" sozinho é MUITO comum em fala coloquial
// ("imagina ir pra praia", "imagina só"), então só aceitamos quando vier
// seguido de palavra-chave visual.

// Substantivos visuais que disparam geração quando combinados com verbo de criação.
// Inclui peças gráficas comuns (card, banner, flyer, cartaz, anúncio, capa, ícone,
// avatar, post, story, thumbnail, wallpaper, pôster, cartão, mockup, layout visual).
const VISUAL_NOUN =
  "(?:imagem|imagens|foto|fotos|figura|figuras|ilustra[çc][ãa]o|ilustra[çc][õo]es|desenho|desenhos|arte|artes|logo|logotipo|pintura|render(?:iza[çc][ãa]o)?|" +
  "card|cards|cart[ãa]o|banner|banners|cartaz|cartazes|p[ôo]ster|posters|an[úu]ncio|an[úu]ncios|flyer|panfleto|capa|capas|" +
  "[íi]cone|[íi]cones|icon|avatar|avatares|post|posts|story|stories|stories?|thumbnail|thumbnails|wallpaper|papel\\s+de\\s+parede|" +
  "mockup|mock[- ]?up|layout\\s+visual|infogr[áa]fico|sticker|adesivo|emoji)";

const TRIGGERS = [
  // Verbo de criar + (artigo opcional + adjetivos opcionais) + substantivo visual
  new RegExp(
    `\\b(gera|gere|gerar|cria|crie|criar|desenha|desenhe|desenhar|faz|fa[çc]a|fazer|produz|produza|produzir|me\\s+d[aá]|monta|monte|montar|design(?:e|a|ar)?)\\s+(?:um[a]?s?\\s+)?(?:[\\wÀ-ÿ-]+\\s+){0,4}${VISUAL_NOUN}\\b`,
    "i",
  ),
  // "imagine/imagina" só dispara com substantivo visual (não com "imagina ir pra praia")
  new RegExp(`\\b(imagine|imagina)\\s+(?:um[a]?s?\\s+)?(?:[\\wÀ-ÿ-]+\\s+){0,3}${VISUAL_NOUN}\\b`, "i"),
  // Pedidos diretos: "preciso de uma imagem", "quero um logo"
  new RegExp(`\\b(quero|queria|preciso\\s+de|gostaria\\s+de)\\s+(?:um[a]?s?\\s+)?(?:[\\wÀ-ÿ-]+\\s+){0,4}${VISUAL_NOUN}\\b`, "i"),
  // Inglês
  /\b(image\s+of|picture\s+of|draw\s+me|generate\s+an?\s+image|create\s+an?\s+(image|logo|banner|card|poster|illustration))\b/i,
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
  // Tira só o verbo inicial — preserva o substantivo (ex: "card de pagamento")
  // pois ele faz parte da descrição visual que o modelo precisa.
  t = t.replace(
    /^(gera|gere|gerar|cria|crie|criar|desenha|desenhe|desenhar|faz|fa[çc]a|fazer|produz|produza|produzir|me\s+d[aá]|monta|monte|montar|imagine|imagina|quero|queria|preciso\s+de|gostaria\s+de|design(?:e|a|ar)?)\s+(?:um[a]?s?\s+)?/i,
    "",
  );
  return t.trim() || text.trim();
}
