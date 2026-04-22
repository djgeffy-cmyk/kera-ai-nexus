/**
 * Detecta plataforma do usuário pra oferecer instalação correta.
 * iOS = iPhone/iPad → instalação via Safari "Adicionar à Tela de Início"
 */
export const isIOS = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPad no iPadOS 13+ se identifica como Mac, mas tem touch
  return /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" &&
      (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1);
};

export const isAndroid = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
};

export const isSafari = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /^((?!chrome|android|crios|fxios|edgios|opios).)*safari/i.test(ua);
};

/**
 * App rodando em modo "instalado" (PWA na tela inicial)?
 */
export const isStandalonePWA = (): boolean => {
  if (typeof window === "undefined") return false;
  // iOS Safari
  if ((navigator as Navigator & { standalone?: boolean }).standalone) return true;
  // Outros navegadores
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
};
