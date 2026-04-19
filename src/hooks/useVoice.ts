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
  const inflightRef = useRef<AbortController | null>(null);

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
    // NÃO aborta fetch em andamento (causava "connection closed").
    // Só para o áudio que já está tocando.
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // Se já tem requisição em andamento, ignora (evita empilhar chamadas paralelas)
    if (inflightRef.current) {
      console.log("[useVoice] já tem TTS em andamento, ignorando nova chamada");
      return;
    }

    // Para áudio anterior se estiver tocando
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeaking(true);

    const ac = new AbortController();
    inflightRef.current = ac;

    // SEMPRE usa ElevenLabs (voz paga). Nunca cai pro Web Speech (voz robótica).
    try {
      const resp = await fetch(TTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: ac.signal,
      });
      if (resp.status === 204) {
        console.warn("[useVoice] TTS indisponível (quota). Silenciando.");
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
      audio.onerror = (ev) => {
        console.warn("[useVoice] audio playback error:", ev);
        setSpeaking(false);
        URL.revokeObjectURL(url);
      };
      await audio.play();
      console.log("[useVoice] ElevenLabs tocando", { len: text.length, provider: resp.headers.get("X-TTS-Provider") });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      console.error("[useVoice] ElevenLabs falhou (sem fallback robótico):", e);
      setSpeaking(false);
    } finally {
      if (inflightRef.current === ac) inflightRef.current = null;
    }
  }, []);

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
