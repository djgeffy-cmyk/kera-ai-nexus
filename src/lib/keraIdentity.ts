/**
 * Identidade visual da Kera.
 *
 * Bloqueia opções de vídeo/avatar incompatíveis com a personagem
 * (ex.: versões antigas onde ela aparecia "olhando para os lados",
 * que foram descontinuadas). Combina denylist explícita + heurística
 * por nome para pegar variantes futuras sem precisar editar este arquivo.
 */

// IDs explicitamente proibidos (já removidos do projeto).
const DENYLIST_IDS = new Set<string>([
  "kera-sides",
  "looking-sides",
  "kera-looking-sides",
]);

// Termos no ID que indicam enquadramento incompatível com a identidade.
const BLOCKED_PATTERNS = [/looking-?sides/i, /olhando-?lados/i];

export type KeraOptionLike = { id: string; label?: string };

export const isValidKeraOption = (opt: KeraOptionLike): boolean => {
  if (DENYLIST_IDS.has(opt.id)) return false;
  return !BLOCKED_PATTERNS.some((re) => re.test(opt.id));
};

export const filterKeraOptions = <T extends KeraOptionLike>(opts: T[]): T[] =>
  opts.filter(isValidKeraOption);

/**
 * Resolve um ID salvo (ex.: localStorage) para um ID válido.
 * Se o salvo for inválido, devolve o fallback.
 */
export const resolveValidKeraId = <T extends KeraOptionLike>(
  storedId: string | null | undefined,
  options: T[],
  fallbackId: string,
): { id: string; migrated: boolean } => {
  if (!storedId) return { id: fallbackId, migrated: false };
  const opt = options.find((o) => o.id === storedId);
  if (opt && isValidKeraOption(opt)) return { id: storedId, migrated: false };
  return { id: fallbackId, migrated: true };
};
