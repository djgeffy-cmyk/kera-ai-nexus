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
  const [pendingPlay, setPendingPlay] = useState(false);
  const recRef = useRef<SR | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingAudioRef = useRef<HTMLAudioElement | null>(null);
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
    // Aborta fetch em andamento (se houver)
    if (inflightRef.current) {
      try { inflightRef.current.abort(); } catch {}
      inflightRef.current = null;
    }
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.src = "";
        audioRef.current.load?.();
      } catch {}
      audioRef.current = null;
    }
    pendingAudioRef.current = null;
    setPendingPlay(false);
    setSpeaking(false);
  }, []);

  // Tenta tocar o áudio que ficou bloqueado pelo autoplay (chamar dentro de um clique do usuário)
  const resumePendingPlay = useCallback(async () => {
    const audio = pendingAudioRef.current;
    if (!audio) return;
    try {
      await audio.play();
      setPendingPlay(false);
      setSpeaking(true);
    } catch (e) {
      console.warn("[useVoice] resumePendingPlay falhou:", e);
    }
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // SEMPRE para o áudio anterior antes de começar um novo (evita duplicação)
    if (inflightRef.current) {
      try { inflightRef.current.abort(); } catch {}
      inflightRef.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.src = "";
        audioRef.current.load?.();
      } catch {}
      audioRef.current = null;
    }

    // Cria UMA única instância de Audio. Sem play() silencioso prévio (causava duplicação).
    const audio = new Audio();
    audio.preload = "auto";
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
        console.warn("[useVoice] TTS indisponível (quota).");
        setSpeaking(false);
        if (audioRef.current === audio) audioRef.current = null;
        return;
      }
      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        throw new Error("TTS HTTP " + resp.status + " " + errText.slice(0, 200));
      }

      // Se foi cancelado durante o fetch, descarta
      if (audioRef.current !== audio) {
        console.log("[useVoice] áudio substituído durante fetch, descartando");
        return;
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      audio.src = url;
      audio.onended = () => {
        if (audioRef.current === audio) {
          setSpeaking(false);
          audioRef.current = null;
        }
        URL.revokeObjectURL(url);
      };
      audio.onerror = (ev) => {
        console.warn("[useVoice] audio playback error:", ev);
        if (audioRef.current === audio) {
          setSpeaking(false);
          audioRef.current = null;
        }
        URL.revokeObjectURL(url);
      };
      try {
        await audio.play();
        console.log("[useVoice] ElevenLabs tocando", { len: text.length, bytes: blob.size });
      } catch (playErr) {
        // iOS/Safari bloqueia autoplay sem gesto — guarda pra tocar no próximo toque
        if ((playErr as Error)?.name === "NotAllowedError") {
          console.warn("[useVoice] autoplay bloqueado, aguardando gesto do usuário");
          pendingAudioRef.current = audio;
          setPendingPlay(true);
          setSpeaking(false);
          // Auto-recover: tenta tocar no próximo toque/click em qualquer lugar da página
          const tryResume = async () => {
            if (pendingAudioRef.current !== audio) return;
            try {
              await audio.play();
              setPendingPlay(false);
              setSpeaking(true);
              window.removeEventListener("touchend", tryResume);
              window.removeEventListener("click", tryResume);
            } catch {}
          };
          window.addEventListener("touchend", tryResume, { once: false });
          window.addEventListener("click", tryResume, { once: false });
          return;
        }
        throw playErr;
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      console.error("[useVoice] ElevenLabs falhou:", e);
      if (audioRef.current === audio) {
        setSpeaking(false);
        audioRef.current = null;
      }
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

  return { listening, speaking, pendingPlay, startListening, stopListening, speak, stopSpeaking, warmUpTTS, resumePendingPlay };
}
