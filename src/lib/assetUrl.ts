// Resolve URL de assets (.asset.json) para funcionar tanto na Web quanto no Kera Desktop (Electron).
// Na Web, paths como "/__l5e/..." resolvem corretamente contra o domínio.
// No Electron empacotado, a página é carregada via file://, então paths absolutos quebram.
// Por isso, no Desktop, prefixamos com o domínio público da Kera.

const PUBLIC_HOST = "https://kera-ai-nexus.lovable.app";

const isElectron = (): boolean =>
  typeof window !== "undefined" &&
  (window.location.protocol === "file:" || !!(window as unknown as { kera?: { isDesktop?: boolean } }).kera?.isDesktop);

export const assetUrl = (urlOrAsset: string | { url: string }): string => {
  const raw = typeof urlOrAsset === "string" ? urlOrAsset : urlOrAsset.url;
  if (!raw) return raw;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:") || raw.startsWith("blob:")) return raw;
  if (isElectron() && raw.startsWith("/")) return `${PUBLIC_HOST}${raw}`;
  return raw;
};
