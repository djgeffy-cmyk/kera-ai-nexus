// useAlwaysListening — modo "sempre escutando" estilo Grok/Hey Google.
// Mantém o microfone aberto via ElevenLabs Scribe Realtime (WebSocket + VAD).
// Quando detecta a wake word ("kera"), envia o restante da frase pra um callback.
//
// Fluxo:
// 1. start() → busca token da edge function `scribe-token`, conecta no Scribe.
// 2. Mic fica aberto, transcrições parciais aparecem em `partial`.
// 3. Quando o VAD detecta silêncio, o trecho é "commitado" — checamos se contém wake word.
// 4. Se contém, extraímos o que vem DEPOIS dela e chamamos onCommand(texto).
// 5. Mantém escutando indefinidamente até stop().

import { useScribe } from "@elevenlabs/react";
import { CommitStrategy } from "@elevenlabs/client";
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SCRIBE_TOKEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scribe-token`;

// Regex pra wake word "kera" — STT em PT-BR comumente erra pra MUITAS variações.
// Cobertura: kera, kéra, kerá, kerra, querá, quera, queira, querida, queret, keret,
// karen, kara, kará, cara, kira, carla, kerê, querer (início)
const WAKE_WORD_REGEX = /\b(k[eéêia]r+(?:[aáeio]|et|en)\w{0,3}|qu?er+(?:[aáei]|ida|et)\w{0,3}|qu?eira|c[aá]r[aáel]\w{0,3}|kir[aá])\b[\s,!?:.\-]*/i;

export type AlwaysListeningStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "heard-wake"
  | "error";

export type UseAlwaysListeningOptions = {
  // Callback disparado quando a wake word é detectada e a frase termina.
  // Recebe APENAS o texto APÓS a wake word.
  onCommand: (text: string) => void;
  // Se true, ignora a wake word e dispara onCommand pra QUALQUER frase commitada.
  noWakeWord?: boolean;
  // Callback opcional pra erros
  onError?: (msg: string) => void;
};

export function useAlwaysListening(opts: UseAlwaysListeningOptions) {
  const { onCommand, noWakeWord, onError } = opts;
  const [status, setStatus] = useState<AlwaysListeningStatus>("idle");
  const [partial, setPartial] = useState<string>("");
  const [lastHeard, setLastHeard] = useState<string>("");
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;
  const noWakeWordRef = useRef(noWakeWord);
  noWakeWordRef.current = noWakeWord;

  // Buffer dos commits recentes — junta caso wake word venha em um commit
  // e o comando venha no próximo (silêncio rápido entre "kera" e o pedido).
  const recentBufferRef = useRef<string>("");
  const bufferTimerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Bip de confirmação tipo Alexa (dois tons rápidos subindo)
  const playWakeBeep = useCallback(() => {
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      if (!Ctx) return;
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current!;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const now = ctx.currentTime;

      const playTone = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.18, start + 0.01);
        gain.gain.linearRampToValueAtTime(0.18, start + dur - 0.04);
        gain.gain.linearRampToValueAtTime(0, start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur);
      };

      playTone(880, now, 0.09);          // A5
      playTone(1318.5, now + 0.1, 0.12); // E6 — sobe de tom (positivo)
    } catch (e) {
      console.warn("[AlwaysListen] beep failed:", e);
    }
  }, []);

  const flashStatus = useCallback((s: AlwaysListeningStatus, ms = 1200) => {
    setStatus(s);
    if (bufferTimerRef.current) window.clearTimeout(bufferTimerRef.current);
    bufferTimerRef.current = window.setTimeout(() => {
      setStatus((cur) => (cur === s ? "listening" : cur));
    }, ms);
  }, []);

  const handleCommitted = useCallback((text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setLastHeard(clean);
    console.log("[AlwaysListen] Committed:", clean);

    // Modo sem wake word — dispara direto
    if (noWakeWordRef.current) {
      onCommandRef.current(clean);
      flashStatus("heard-wake");
      return;
    }

    // Junta com buffer recente (caso wake word tenha caído num commit anterior)
    const combined = (recentBufferRef.current + " " + clean).trim();
    const match = combined.match(WAKE_WORD_REGEX);

    if (match) {
      console.log("[AlwaysListen] ✓ Wake word match:", match[0], "in:", combined);
      playWakeBeep(); // 🔔 confirmação sonora estilo Alexa
      // Pega o texto APÓS a wake word
      const idx = combined.search(WAKE_WORD_REGEX);
      const afterWake = combined.slice(idx + match[0].length).trim();
      recentBufferRef.current = ""; // limpa buffer
      if (afterWake.length >= 2) {
        // Tem comando — dispara
        console.log("[AlwaysListen] → Sending command:", afterWake);
        onCommandRef.current(afterWake);
        flashStatus("heard-wake");
      } else {
        // Só falou "kera" sem comando — guarda buffer pra próxima frase ser o comando
        console.log("[AlwaysListen] Wake word sem comando, aguardando próxima frase");
        recentBufferRef.current = match[0];
        flashStatus("heard-wake");
        window.setTimeout(() => {
          if (recentBufferRef.current === match[0]) recentBufferRef.current = "";
        }, 8000);
      }
    } else {
      console.log("[AlwaysListen] ✗ No wake word in:", combined);
      // Não tem wake word — guarda só os últimos 60 chars como contexto curto
      const tail = clean.slice(-60);
      recentBufferRef.current = tail;
      window.setTimeout(() => {
        if (recentBufferRef.current === tail) recentBufferRef.current = "";
      }, 4000);
    }
  }, [flashStatus, playWakeBeep]);

  // Estado pra evitar disparar a wake word duas vezes pro mesmo trecho
  const wakeFiredForRef = useRef<string>("");
  const partialDebounceRef = useRef<number | null>(null);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    languageCode: "por",
    onSessionStarted: () => console.log("[AlwaysListen] Session started"),
    onConnect: () => console.log("[AlwaysListen] WebSocket connected"),
    onDisconnect: () => console.log("[AlwaysListen] WebSocket disconnected"),
    onError: (e) => console.error("[AlwaysListen] Scribe error:", e),
    onPartialTranscript: (data: { text: string }) => {
      console.log("[AlwaysListen] Partial:", data.text);
      setPartial(data.text);

      // ⚡ Detecção AGRESSIVA no partial — não espera o commit (pode demorar 30s+)
      if (noWakeWordRef.current) return;
      const text = data.text;
      const match = text.match(WAKE_WORD_REGEX);
      if (!match) return;

      // Pega o ÚLTIMO match (caso o partial tenha várias ocorrências)
      let lastIdx = -1;
      let lastMatch: RegExpExecArray | null = null;
      const re = new RegExp(WAKE_WORD_REGEX.source, "gi");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        lastIdx = m.index;
        lastMatch = m;
      }
      if (!lastMatch || lastIdx < 0) return;

      const afterWake = text.slice(lastIdx + lastMatch[0].length).trim();
      // Marca o trecho específico (wake + comando) pra não disparar duas vezes
      const fingerprint = `${lastMatch[0]}|${afterWake.slice(0, 40)}`;
      if (wakeFiredForRef.current === fingerprint) return;

      // Aguarda 500ms de "silêncio" no partial antes de disparar (pra dar tempo do usuário terminar a frase)
      if (partialDebounceRef.current) window.clearTimeout(partialDebounceRef.current);
      partialDebounceRef.current = window.setTimeout(() => {
        if (afterWake.length < 2) {
          // Só "kera" sozinho — toca beep e aguarda próximo
          if (wakeFiredForRef.current !== fingerprint) {
            console.log("[AlwaysListen] ⚡ Wake (sem comando) no partial:", lastMatch![0]);
            playWakeBeep();
            wakeFiredForRef.current = fingerprint;
            flashStatus("heard-wake");
            // Limpa pra reabrir detecção em ~6s
            window.setTimeout(() => { wakeFiredForRef.current = ""; }, 6000);
          }
        } else if (afterWake.length >= 3 && /[\.\?!]\s*$|.{8,}/.test(afterWake)) {
          // Tem comando substancial (termina com pontuação OU 8+ chars)
          console.log("[AlwaysListen] ⚡ Wake + comando no partial:", lastMatch![0], "→", afterWake);
          playWakeBeep();
          wakeFiredForRef.current = fingerprint;
          onCommandRef.current(afterWake);
          flashStatus("heard-wake");
          // Reseta após 3s
          window.setTimeout(() => { wakeFiredForRef.current = ""; }, 3000);
        }
      }, 600);
    },
    onCommittedTranscript: (data: { text: string }) => {
      setPartial("");
      // Limpa o fingerprint quando vier um commit (nova "rodada")
      handleCommitted(data.text);
    },
  });

  const start = useCallback(async () => {
    if (status === "connecting" || status === "listening" || status === "heard-wake") return;
    setStatus("connecting");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess.session?.access_token;
      if (!accessToken) throw new Error("Faça login pra usar o modo sempre escutando.");

      const r = await fetch(SCRIBE_TOKEN_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `Falha ao obter token (${r.status})`);
      }
      const { token } = await r.json();
      if (!token) throw new Error("Token vazio");

      await scribe.connect({
        token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      setStatus("listening");
    } catch (e: any) {
      const msg = e?.message || "Erro ao iniciar modo sempre escutando";
      setStatus("error");
      onError?.(msg);
    }
  }, [scribe, status, onError]);

  const stop = useCallback(async () => {
    try {
      await scribe.disconnect();
    } catch {
      /* ignore */
    }
    recentBufferRef.current = "";
    setPartial("");
    setStatus("idle");
  }, [scribe]);

  return {
    status,
    partial,
    lastHeard,
    isActive: status === "listening" || status === "heard-wake" || status === "connecting",
    start,
    stop,
  };
}
