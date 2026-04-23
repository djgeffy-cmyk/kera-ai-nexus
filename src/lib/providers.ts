export const PROVIDERS = [
  { id: "auto", label: "Automático (OpenAI primeiro)", description: "Prioriza OpenAI para economizar créditos Lovable", help: "" },
  { id: "lovable", label: "Lovable AI · Gemini 3 Flash", description: "Grátis até o limite mensal", help: "Já vem ativo, sem chave necessária." },
  { id: "openai", label: "OpenAI · GPT-4o mini", description: "Pago por uso", help: "Crie em platform.openai.com/api-keys" },
  { id: "groq", label: "Groq · Llama 3.3 70B", description: "Grátis e ultra-rápido", help: "Crie em console.groq.com/keys" },
  { id: "openrouter", label: "OpenRouter · Llama 3.3 (free)", description: "Vários modelos gratuitos", help: "Crie em openrouter.ai/keys" },
  { id: "gemini", label: "Google Gemini 2.0 Flash", description: "Estilo NotebookLM (Google)", help: "Crie em aistudio.google.com/apikey" },
  { id: "xai", label: "xAI · Grok 4", description: "Pago (sua conta xAI)", help: "Crie em console.x.ai" },
] as const;

export type ProviderId = typeof PROVIDERS[number]["id"];

export const SECRET_NAMES: Record<Exclude<ProviderId, "auto" | "lovable">, string> = {
  openai: "OPENAI_API_KEY",
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  gemini: "GEMINI_API_KEY",
  xai: "XAI_API_KEY",
};

export const PROVIDER_PREF_KEY = "kera:provider";

export function getPreferredProvider(): ProviderId {
  if (typeof window === "undefined") return "auto";
  return (localStorage.getItem(PROVIDER_PREF_KEY) as ProviderId) || "auto";
}

export function setPreferredProvider(p: ProviderId) {
  localStorage.setItem(PROVIDER_PREF_KEY, p);
}
