import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API types (minimal)
type SR = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts-kera`;

export function useVoice(opts: { useElevenLabs?: boolean; useRemoteTTS?: boolean; onTranscript: (t: string) => void; lang?: string }) {
  const { useElevenLabs, useRemoteTTS, onTranscript, lang = "pt-BR" } = opts;
  // Compat: aceita "useElevenLabs" (antigo) ou "useRemoteTTS" (novo). Se qualquer um for true, usa o backend.
  const useRemote = useRemoteTTS ?? useElevenLabs ?? false;
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recRef = useRef<SR | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ---------- STT (Web Speech) ----------
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Reconhecimento de voz não suportado neste navegador. Use Chrome/Edge.");
      return;
    }
    const rec: SR = new SpeechRecognition();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      onTranscript(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  }, [lang, onTranscript]);

  const stopListening = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  // ---------- TTS ----------
  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return;
    stopSpeaking();
    setSpeaking(true);

    if (useRemote) {
      try {
        const resp = await fetch(TTS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (resp.status === 204) {
          // Provedores TTS indisponíveis (quota). Silencia sem fallback robótico.
          setSpeaking(false);
          return;
        }
        if (!resp.ok) {
          const errText = await resp.text().catch(() => "");
          throw new Error("TTS HTTP " + resp.status + " " + errText.slice(0, 200));
        }
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
        audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); };
        await audio.play();
        console.log("[useVoice] TTS remoto tocando", { len: text.length });
        return;
      } catch (e) {
        // Não cai pro Web Speech (voz robótica). Usuário prefere ficar em silêncio.
        console.error("[useVoice] TTS remoto falhou (sem fallback robótico):", e);
        setSpeaking(false);
        return;
      }
    }

    // Fallback / padrão: Web Speech
    if (!("speechSynthesis" in window)) {
      console.warn("[useVoice] speechSynthesis indisponível neste navegador");
      setSpeaking(false);
      return;
    }
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = 1.05;
      u.pitch = 1.05;
      const { loadVoicesAsync, pickVoice } = await import("@/lib/nativeVoice");
      const voices = await loadVoicesAsync();
      const chosen = pickVoice(voices, lang);
      if (chosen) u.voice = chosen;
      u.onend = () => setSpeaking(false);
      u.onerror = (ev) => { console.warn("[useVoice] utterance error:", ev); setSpeaking(false); };
      // Garante que a fila esteja limpa antes de falar
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      console.log("[useVoice] speak() iniciado", { lang, voice: chosen?.name, len: text.length });
    } catch (e) {
      console.error("[useVoice] erro ao iniciar TTS nativo:", e);
      setSpeaking(false);
    }
  }, [useElevenLabs, lang, stopSpeaking]);

  // "Warm-up" do TTS: deve ser chamado dentro de um clique do usuário para
  // destravar o speechSynthesis em navegadores mobile (iOS Safari).
  const warmUpTTS = useCallback(() => {
    try {
      if (!("speechSynthesis" in window)) return;
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch {}
  }, []);

  useEffect(() => () => { stopListening(); stopSpeaking(); }, [stopListening, stopSpeaking]);

  return { listening, speaking, startListening, stopListening, speak, stopSpeaking, warmUpTTS };
}
