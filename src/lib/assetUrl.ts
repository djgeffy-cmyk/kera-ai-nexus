// Resolve URL de assets para funcionar tanto na Web quanto no Kera Desktop (Electron).
//
// Estratégia: assets de vídeo grandes (.mp4) foram migrados para o bucket público
// `kera-videos` no Lovable Cloud. Paths internos `/__l5e/assets-v1/<id>/<filename>.mp4`
// são reescritos para a URL pública do Storage (funciona web + desktop, sem auth).
//
// Outros assets (paths internos não migrados) caem no fallback: na Web servem direto;
// no Electron prefixamos com o domínio público da Kera.

const PUBLIC_HOST = "https://kera-ai-nexus.lovable.app";
const STORAGE_PUBLIC =
  "https://ytixqgkzqgeoxrbmjqbo.supabase.co/storage/v1/object/public/kera-videos";

const isElectron = (): boolean =>
  typeof window !== "undefined" &&
  (window.location.protocol === "file:" ||
    !!(window as unknown as { kera?: { isDesktop?: boolean } }).kera?.isDesktop);

// Match: /__l5e/assets-v1/<uuid>/<filename>.mp4  → kera-videos/<filename>.mp4
const VIDEO_BUCKET_RE = /^\/__l5e\/assets-v1\/[^/]+\/([^/]+\.mp4)$/i;

export const assetUrl = (urlOrAsset: string | { url: string }): string => {
  const raw = typeof urlOrAsset === "string" ? urlOrAsset : urlOrAsset?.url;
  if (!raw) return raw;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:") || raw.startsWith("blob:")) return raw;

  // 1) Vídeos migrados para o bucket público kera-videos
  const m = raw.match(VIDEO_BUCKET_RE);
  if (m) return `${STORAGE_PUBLIC}/${m[1]}`;

  // 2) Demais paths absolutos: no Electron, prefixar com domínio público
  if (isElectron() && raw.startsWith("/")) return `${PUBLIC_HOST}${raw}`;

  return raw;
};
