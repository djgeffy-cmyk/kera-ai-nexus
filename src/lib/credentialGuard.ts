// Detecta padrões comuns de credenciais e bloqueia antes de mandar pro chat/LLM.
// Conservador: prefere falso-positivo a deixar passar.

export type CredentialMatch = {
  type: "cnpj_pwd" | "cpf_pwd" | "user_pwd" | "kv_pwd" | "bearer" | "api_key";
  preview: string;
};

const PATTERNS: { type: CredentialMatch["type"]; rx: RegExp }[] = [
  // CNPJ:senha  ex: 05.151.009/0001-17:Meg#030808  ou 05151009000117:senha
  { type: "cnpj_pwd", rx: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\s*[:|\s]\s*\S{4,}/g },
  // CPF:senha
  { type: "cpf_pwd", rx: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\s*[:|]\s*\S{4,}/g },
  // chave:valor explícito  senha=xxx, password: xxx, pwd:xxx, pass=xxx
  { type: "kv_pwd", rx: /\b(?:senha|password|passwd|pwd|pass|secret|token|api[_-]?key)\s*[:=]\s*['"]?[^\s'"<>]{4,}/gi },
  // user:pass genérico (usuario com @ ou nome + : + algo com símbolo/maiúscula)
  { type: "user_pwd", rx: /\b[A-Za-z0-9._-]{3,}@?[A-Za-z0-9.-]*\s*:\s*[^\s:]{6,32}(?=[#$@!%&*])/g },
  // Bearer token
  { type: "bearer", rx: /\bBearer\s+[A-Za-z0-9._\-]{20,}/gi },
  // sk- / sk_live_ / sk_test_ típicos de APIs
  { type: "api_key", rx: /\b(?:sk|pk|rk)[-_](?:live|test)?[-_]?[A-Za-z0-9]{20,}/g },
];

export function scanForCredentials(text: string): CredentialMatch[] {
  if (!text || text.length < 6) return [];
  const out: CredentialMatch[] = [];
  for (const { type, rx } of PATTERNS) {
    const m = text.match(rx);
    if (m) {
      for (const hit of m) {
        out.push({ type, preview: hit.slice(0, 8) + "…" });
      }
    }
  }
  return out;
}

export function redactCredentials(text: string): string {
  let out = text;
  for (const { rx } of PATTERNS) {
    out = out.replace(rx, "[REDACTED-CREDENTIAL]");
  }
  return out;
}

export function hasCredentials(text: string): boolean {
  return scanForCredentials(text).length > 0;
}
