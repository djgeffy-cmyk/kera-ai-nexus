import { supabase } from "@/integrations/supabase/client";
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webauthn`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function call(action: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: ANON,
    ...(init.headers as Record<string, string> | undefined),
  };
  // anexa Authorization se houver sessão
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) {
    headers["Authorization"] = `Bearer ${data.session.access_token}`;
  } else {
    headers["Authorization"] = `Bearer ${ANON}`;
  }
  const res = await fetch(`${FN_BASE}/${action}`, { ...init, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Erro ${res.status}`);
  return json;
}

export const webauthnSupported = () =>
  typeof window !== "undefined" && browserSupportsWebAuthn();

export const isInIframe = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin → com certeza está em iframe
  }
};

/**
 * Detecta navegadores no iOS que NÃO são Safari.
 * No iOS, Chrome (CriOS), Firefox (FxiOS), Edge (EdgiOS) e Opera (OPiOS)
 * são forçados pela Apple a usar o engine do Safari (WebKit), MAS o WebAuthn
 * com Face ID/Touch ID só funciona no Safari "puro" — os outros navegadores
 * não têm acesso à API de Passkeys.
 */
export const isIOSNonSafari = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) ||
    // iPad no iPadOS 13+ se identifica como Mac, mas tem touch
    (navigator.platform === "MacIntel" && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1);
  if (!isIOS) return false;
  return /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo/i.test(ua);
};

function ensureUsable() {
  if (!webauthnSupported()) {
    if (isIOSNonSafari()) {
      throw new Error(
        "Face ID no iPhone só funciona no Safari. Abra chat.kera.ia.br no Safari e tente novamente.",
      );
    }
    throw new Error("Seu dispositivo não suporta Face ID/Touch ID via web.");
  }
  if (isIOSNonSafari()) {
    throw new Error(
      "Face ID no iPhone só funciona no Safari. Abra chat.kera.ia.br no Safari e tente novamente.",
    );
  }
  if (isInIframe()) {
    throw new Error(
      "Face ID não funciona dentro do preview. Abra direto em chat.kera.ia.br no Safari.",
    );
  }
}

export async function registerPasskey(deviceLabel?: string) {
  ensureUsable();
  const { options } = await call("register-options", { method: "POST" });
  const attestation = await startRegistration(options);
  await call("register-verify", {
    method: "POST",
    body: JSON.stringify({ response: attestation, device_label: deviceLabel || navigator.userAgent.slice(0, 60) }),
  });
  return true;
}

export async function loginWithPasskey(email: string) {
  ensureUsable();
  const { options } = await call("auth-options", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  const assertion = await startAuthentication(options);
  const result = await call("auth-verify", {
    method: "POST",
    body: JSON.stringify({ email, response: assertion }),
  });
  if (!result?.token_hash) throw new Error("Sessão não pôde ser criada");
  const { error } = await supabase.auth.verifyOtp({
    token_hash: result.token_hash,
    type: "magiclink",
  });
  if (error) throw error;
  return true;
}

/**
 * Login sem digitar email — o navegador mostra a lista de passkeys
 * disponíveis (Face ID/Touch ID/Windows Hello) e o usuário escolhe.
 * Requer passkeys do tipo "resident key" (cadastradas com residentKey: "preferred").
 */
export async function loginWithPasskeyDiscoverable() {
  ensureUsable();
  const { options } = await call("auth-options-discoverable", { method: "POST" });
  const assertion = await startAuthentication(options);
  const result = await call("auth-verify-discoverable", {
    method: "POST",
    body: JSON.stringify({ response: assertion }),
  });
  if (!result?.token_hash) throw new Error("Sessão não pôde ser criada");
  const { error } = await supabase.auth.verifyOtp({
    token_hash: result.token_hash,
    type: "magiclink",
  });
  if (error) throw error;
  return { email: result.email as string };
}