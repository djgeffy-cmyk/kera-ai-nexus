import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
// Backend (ElevenLabs/OpenAI) aceita até 4000 chars; mantemos uma única chamada
// na maioria das mensagens para evitar que o iOS bloqueie autoplay entre chunks.
const MAX_TTS_CHARS = 3500;

function splitTextForTTS(text: string, maxChars = MAX_TTS_CHARS): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    const value = current.trim();
    if (value) chunks.push(value);
    current = "";
  };

  const appendPiece = (piece: string) => {
    const cleanPiece = piece.trim();
    if (!cleanPiece) return;

    if (cleanPiece.length <= maxChars) {
      const next = current ? `${current} ${cleanPiece}` : cleanPiece;
      if (next.length <= maxChars) current = next;
      else {
        pushCurrent();
        current = cleanPiece;
      }
      return;
    }

    const softerPieces = cleanPiece.split(/(?<=[,;:])\s+/).filter(Boolean);
    if (softerPieces.length > 1) {
      softerPieces.forEach(appendPiece);
      return;
    }

    let remaining = cleanPiece;
    while (remaining.length > maxChars) {
      let cut = remaining.lastIndexOf(" ", maxChars);
      if (cut < Math.floor(maxChars * 0.6)) cut = maxChars;
      appendPiece(remaining.slice(0, cut));
      remaining = remaining.slice(cut).trim();
    }

    appendPiece(remaining);
  };

  normalized.split(/(?<=[.!?…])\s+/).filter(Boolean).forEach(appendPiece);
  pushCurrent();
  return chunks;
}

export function useVoice(opts: { useElevenLabs?: boolean; useRemoteTTS?: boolean; onTranscript: (t: string) => void; lang?: string }) {
  const { onTranscript, lang = "pt-BR" } = opts;
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [pendingPlay, setPendingPlay] = useState(false);
  const recRef = useRef<SR | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingAudioRef = useRef<HTMLAudioElement | null>(null);
  const primedAudioRef = useRef<HTMLAudioElement | null>(null);
  const inflightRef = useRef<AbortController | null>(null);
  const unlockHandlerRef = useRef<(() => void) | null>(null);
  const sessionRef = useRef(0);
  const playbackRejectRef = useRef<((reason?: unknown) => void) | null>(null);

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

  const rejectPendingPlayback = useCallback((reason?: unknown) => {
    const reject = playbackRejectRef.current;
    playbackRejectRef.current = null;
    if (reject) reject(reason);
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
    sessionRef.current += 1;
    if (inflightRef.current) {
      try { inflightRef.current.abort(); } catch {}
      inflightRef.current = null;
    }
    clearPendingUnlock();
    rejectPendingPlayback(new Error("Playback interrompido"));
    cleanupAudio(audioRef.current);
    audioRef.current = null;
    pendingAudioRef.current = null;
    setPendingPlay(false);
    setSpeaking(false);
  }, [cleanupAudio, clearPendingUnlock, rejectPendingPlayback]);

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

  const playAudioBlob = useCallback((blob: Blob, sessionId: number) => {
    return new Promise<void>((resolve, reject) => {
      // Reusa o <audio> "primed" criado durante o clique do usuário (warmUpTTS),
      // porque no iOS Safari o token de gesture só vale pro elemento que
      // recebeu o primeiro .play(). Se não houver, cria um novo (desktop).
      const audio = primedAudioRef.current ?? new Audio();
      primedAudioRef.current = null;
      const url = URL.createObjectURL(blob);
      let settled = false;

      const finish = (callback?: () => void) => {
        if (settled) return;
        settled = true;
        if (audioRef.current === audio) audioRef.current = null;
        if (pendingAudioRef.current === audio) pendingAudioRef.current = null;
        if (playbackRejectRef.current === rejectPlayback) playbackRejectRef.current = null;
        clearPendingUnlock();
        setPendingPlay(false);
        URL.revokeObjectURL(url);
        callback?.();
      };

      const rejectPlayback = (reason?: unknown) => {
        cleanupAudio(audio);
        finish(() => reject(reason instanceof Error ? reason : new Error("Falha ao reproduzir áudio")));
      };

      playbackRejectRef.current = rejectPlayback;
      audio.preload = "auto";
      audio.setAttribute("playsinline", "true");
      audio.muted = false;
      audio.volume = 1;
      audio.src = url;
      audioRef.current = audio;

      audio.onended = () => finish(resolve);
      audio.onerror = () => rejectPlayback(new Error("Falha ao reproduzir áudio"));

      audio.play().then(() => {
        if (sessionRef.current !== sessionId) {
          rejectPlayback(new Error("Playback interrompido"));
          return;
        }
        setSpeaking(true);
      }).catch((playErr) => {
        if ((playErr as Error)?.name === "NotAllowedError") {
          console.warn("[useVoice] autoplay bloqueado, aguardando gesto do usuário");
          pendingAudioRef.current = audio;
          setPendingPlay(true);
          setSpeaking(false);

          const tryResume = async () => {
            if (sessionRef.current !== sessionId || pendingAudioRef.current !== audio) return;
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

        rejectPlayback(playErr);
      });
    });
  }, [cleanupAudio, clearPendingUnlock]);

  const speak = useCallback(async (text: string) => {
    const cleanedText = text.trim();
    if (!cleanedText) return;

    const sessionId = sessionRef.current + 1;
    sessionRef.current = sessionId;

    if (pendingAudioRef.current) {
      cleanupAudio(pendingAudioRef.current);
      pendingAudioRef.current = null;
    }
    if (inflightRef.current) {
      try { inflightRef.current.abort(); } catch {}
      inflightRef.current = null;
    }
    rejectPendingPlayback(new Error("Playback substituído"));
    clearPendingUnlock();
    cleanupAudio(audioRef.current);
    audioRef.current = null;
    setPendingPlay(false);
    setSpeaking(true);

    const chunks = splitTextForTTS(cleanedText);
    let playedAny = false;

    try {
      for (const chunk of chunks) {
        if (sessionRef.current !== sessionId) return;

        const ac = new AbortController();
        inflightRef.current = ac;

        const resp = await fetch(TTS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: chunk }),
          signal: ac.signal,
        });

        if (resp.status === 204) {
          console.warn("[useVoice] TTS retornou 204 (quota/limite).");
          break;
        }

        if (!resp.ok) {
          const errText = await resp.text().catch(() => "");
          throw new Error("TTS HTTP " + resp.status + " " + errText.slice(0, 200));
        }

        const blob = await resp.blob();
        if (!blob.size) throw new Error("TTS retornou áudio vazio");

        await playAudioBlob(blob, sessionId);
        playedAny = true;
        console.log("[useVoice] TTS tocando", { len: chunk.length, bytes: blob.size, chunked: chunks.length > 1 });

        if (inflightRef.current === ac) inflightRef.current = null;
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      console.error("[useVoice] TTS falhou:", e);
      toast.error("Não foi possível tocar o áudio agora.");
    } finally {
      if (!playedAny) {
        toast.error("Áudio indisponível no momento.");
      }
      if (sessionRef.current === sessionId) {
        setSpeaking(false);
        if (!pendingAudioRef.current) setPendingPlay(false);
      }
      inflightRef.current = null;
    }
  }, [cleanupAudio, clearPendingUnlock, playAudioBlob, rejectPendingPlayback]);

  // "Warm-up" do contexto de áudio: chamado dentro de um clique do usuário para
  // destravar reprodução de Audio() em iOS Safari.
  const warmUpTTS = useCallback(() => {
    // No iOS, o gesture-token só desbloqueia o elemento <audio> que recebeu
    // o .play() durante o clique. Por isso criamos AGORA o elemento que vai
    // tocar a fala, damos um play() mudo (com src silencioso) e guardamos a
    // referência. Quando o blob real chegar, só trocamos o src e tocamos.
    try {
      if (primedAudioRef.current) return; // já existe um pronto
      const a = new Audio();
      a.setAttribute("playsinline", "true");
      a.preload = "auto";
      a.muted = true;
      // src "silencioso" mínimo (mp3 vazio data URI) só pra .play() resolver.
      a.src =
        "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7097v///////////////////xQAOAAYABwAFiBwAGAAcABwAGwgcABwAFkBwAGAAcABwAFkBwAGAAcABwAGwgcABwAFkBwAGAAcABwAFkBwAGAAcABwAGwgcA//sQxBQAAAGkAAAAAAAAA0gAAAAAAEhJU1RPUlk=";
      const p = a.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          // pausa imediato — só queríamos desbloquear o elemento.
          try { a.pause(); a.currentTime = 0; } catch {}
        }).catch(() => {
          // ignore — já gastamos o gesture; ainda guardamos o ref pra reuso.
        });
      }
      primedAudioRef.current = a;
    } catch {}
  }, []);

  useEffect(() => () => {
    stopListening();
    stopSpeaking();
  }, [stopListening, stopSpeaking]);

  return { listening, speaking, pendingPlay, startListening, stopListening, speak, stopSpeaking, warmUpTTS, resumePendingPlay, audioRef };
}
