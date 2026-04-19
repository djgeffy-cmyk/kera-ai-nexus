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
  const { onTranscript, lang = "pt-BR" } = opts;
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [pendingPlay, setPendingPlay] = useState(false);
  const recRef = useRef<SR | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingAudioRef = useRef<HTMLAudioElement | null>(null);
  const inflightRef = useRef<AbortController | null>(null);
  const unlockHandlerRef = useRef<(() => void) | null>(null);

  const clearPendingUnlock = useCallback(() => {
    if (!unlockHandlerRef.current) return;
    window.removeEventListener("touchend", unlockHandlerRef.current);
    window.removeEventListener("click", unlockHandlerRef.current);
    unlockHandlerRef.current = null;
  }, []);

  const cleanupAudio = useCallback((audio?: HTMLAudioElement | null) => {
    if (!audio) return;
    try {
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
      audio.src = "";
      audio.load?.();
    } catch {}
  }, []);

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

  // ---------- TTS (ElevenLabs/OpenAI via edge function — sem fallback do navegador) ----------
  const stopSpeaking = useCallback(() => {
    if (inflightRef.current) {
      try { inflightRef.current.abort(); } catch {}
      inflightRef.current = null;
    }
    clearPendingUnlock();
    cleanupAudio(audioRef.current);
    audioRef.current = null;
    pendingAudioRef.current = null;
    setPendingPlay(false);
    setSpeaking(false);
  }, [cleanupAudio, clearPendingUnlock]);

  const resumePendingPlay = useCallback(async () => {
    const audio = pendingAudioRef.current;
    if (!audio) return;
    try {
      await audio.play();
      clearPendingUnlock();
      setPendingPlay(false);
      setSpeaking(true);
    } catch (e) {
      console.warn("[useVoice] resumePendingPlay falhou:", e);
    }
  }, [clearPendingUnlock]);

  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // Para qualquer áudio anterior antes de iniciar
    if (pendingAudioRef.current) {
      cleanupAudio(pendingAudioRef.current);
      pendingAudioRef.current = null;
    }
    if (inflightRef.current) {
      try { inflightRef.current.abort(); } catch {}
      inflightRef.current = null;
    }
    clearPendingUnlock();
    cleanupAudio(audioRef.current);
    audioRef.current = null;
    setPendingPlay(false);

    const audio = new Audio();
    audio.preload = "auto";
    audio.setAttribute("playsinline", "true");
    audioRef.current = audio;

    setSpeaking(true);
    const ac = new AbortController();
    inflightRef.current = ac;

    try {
      const resp = await fetch(TTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: ac.signal,
      });

      if (resp.status === 204) {
        console.warn("[useVoice] TTS retornou 204 (quota/limite).");
        if (audioRef.current === audio) audioRef.current = null;
        setSpeaking(false);
        return;
      }
      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        throw new Error("TTS HTTP " + resp.status + " " + errText.slice(0, 200));
      }
      if (audioRef.current !== audio) {
        console.log("[useVoice] áudio substituído durante fetch, descartando");
        return;
      }

      const blob = await resp.blob();
      if (!blob.size) throw new Error("TTS retornou áudio vazio");

      const url = URL.createObjectURL(blob);
      audio.src = url;
      audio.onended = () => {
        if (audioRef.current === audio) {
          setSpeaking(false);
          audioRef.current = null;
        }
        pendingAudioRef.current = null;
        setPendingPlay(false);
        clearPendingUnlock();
        URL.revokeObjectURL(url);
      };
      audio.onerror = (ev) => {
        console.warn("[useVoice] audio playback error:", ev);
        if (audioRef.current === audio) audioRef.current = null;
        pendingAudioRef.current = null;
        setPendingPlay(false);
        setSpeaking(false);
        clearPendingUnlock();
        URL.revokeObjectURL(url);
      };

      try {
        await audio.play();
        console.log("[useVoice] TTS tocando", { len: text.length, bytes: blob.size });
      } catch (playErr) {
        if ((playErr as Error)?.name === "NotAllowedError") {
          console.warn("[useVoice] autoplay bloqueado, aguardando gesto do usuário");
          pendingAudioRef.current = audio;
          setPendingPlay(true);
          setSpeaking(false);

          const tryResume = async () => {
            if (pendingAudioRef.current !== audio) return;
            try {
              await audio.play();
              clearPendingUnlock();
              setPendingPlay(false);
              setSpeaking(true);
            } catch (e) {
              console.warn("[useVoice] retry de play falhou:", e);
            }
          };

          clearPendingUnlock();
          unlockHandlerRef.current = tryResume;
          window.addEventListener("touchend", tryResume);
          window.addEventListener("click", tryResume);
          return;
        }
        throw playErr;
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      console.error("[useVoice] TTS falhou:", e);
      if (audioRef.current === audio) audioRef.current = null;
      setSpeaking(false);
    } finally {
      if (inflightRef.current === ac) inflightRef.current = null;
    }
  }, [cleanupAudio, clearPendingUnlock]);

  // "Warm-up" do contexto de áudio: chamado dentro de um clique do usuário para
  // destravar reprodução de Audio() em iOS Safari.
  const warmUpTTS = useCallback(() => {
    try {
      const a = new Audio();
      a.muted = true;
      a.play().catch(() => {});
    } catch {}
  }, []);

  useEffect(() => () => {
    stopListening();
    stopSpeaking();
  }, [stopListening, stopSpeaking]);

  return { listening, speaking, pendingPlay, startListening, stopListening, speak, stopSpeaking, warmUpTTS, resumePendingPlay };
}
