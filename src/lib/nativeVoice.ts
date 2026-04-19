// Helpers para escolher e persistir a voz nativa (Web Speech API) preferida.
const KEY = "kera:nativeVoiceURI";

export function getPreferredVoiceURI(): string | null {
  return localStorage.getItem(KEY);
}

export function setPreferredVoiceURI(uri: string | null) {
  if (uri) localStorage.setItem(KEY, uri);
  else localStorage.removeItem(KEY);
}

export function getAllVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

export function loadVoicesAsync(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return resolve([]);
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) return resolve(existing);
    const handler = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    // fallback timeout
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1500);
  });
}

const FEMALE_RX = /female|fem|woman|maria|luciana|monica|joana|sarah|lily|alice|samantha|victoria|fiona|tessa|paulina|helena/i;
const MALE_RX = /male|man|daniel|diego|jorge|felipe|paulo|carlos|alex|fred|tom|david|oliver/i;

export function classifyVoice(v: SpeechSynthesisVoice): "feminina" | "masculina" | "neutra" {
  if (FEMALE_RX.test(v.name)) return "feminina";
  if (MALE_RX.test(v.name)) return "masculina";
  return "neutra";
}

export function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const preferred = getPreferredVoiceURI();
  if (preferred) {
    const found = voices.find((v) => v.voiceURI === preferred);
    if (found) return found;
  }
  // fallback: primeira feminina pt-BR, depois qualquer pt
  const langPrefix = lang.split("-")[0];
  return (
    voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix) && classifyVoice(v) === "feminina") ||
    voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix))
  );
}
