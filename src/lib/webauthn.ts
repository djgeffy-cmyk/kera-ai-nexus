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

export async function registerPasskey(deviceLabel?: string) {
  if (!webauthnSupported()) throw new Error("Seu dispositivo não suporta Face ID/Touch ID via web.");
  const { options } = await call("register-options", { method: "POST" });
  const attestation = await startRegistration({ optionsJSON: options });
  await call("register-verify", {
    method: "POST",
    body: JSON.stringify({ response: attestation, device_label: deviceLabel || navigator.userAgent.slice(0, 60) }),
  });
  return true;
}

export async function loginWithPasskey(email: string) {
  if (!webauthnSupported()) throw new Error("Seu dispositivo não suporta Face ID/Touch ID via web.");
  const { options } = await call("auth-options", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  const assertion = await startAuthentication({ optionsJSON: options });
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