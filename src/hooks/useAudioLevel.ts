import { useEffect, useRef, useState } from "react";

/**
 * useAudioLevel — mede o volume RMS efetivo de um <audio>/<video> em tempo real.
 *
 * Retorna um número 0..1 atualizado ~30Hz, já com:
 *  - smoothing exponencial (não pisca)
 *  - normalização (RMS típico de música cai entre 0.05 e 0.4 → mapeamos pra 0..1)
 *  - respeita o estado .muted e .volume do elemento
 *
 * Funciona depois da primeira interação do usuário (autoplay policy). Antes
 * disso devolve 0 — o que naturalmente deixa a chuva discreta.
 */
export function useAudioLevel(elementRef: React.RefObject<HTMLMediaElement>) {
  const [level, setLevel] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const smoothRef = useRef(0);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    let cancelled = false;

    const ensureGraph = () => {
      if (ctxRef.current) return ctxRef.current.state;
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return "unsupported";
        const ctx = new Ctx();
        const source = ctx.createMediaElementSource(el);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        // Mantém o áudio audível: source -> analyser e source -> destination
        source.connect(ctx.destination);
        ctxRef.current = ctx;
        analyserRef.current = analyser;
        sourceRef.current = source;
        return ctx.state;
      } catch {
        return "error";
      }
    };

    const buf = new Uint8Array(1024);

    const tick = () => {
      const analyser = analyserRef.current;
      const ctx = ctxRef.current;
      if (!analyser || !ctx) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      let raw = 0;
      if (!el.muted && el.volume > 0 && !el.paused && ctx.state === "running") {
        analyser.getByteTimeDomainData(buf);
        // RMS no domínio do tempo
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128; // -1..1
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length); // ~ 0..0.5 pra audio comum
        // Normaliza: 0..0.35 → 0..1 (chuva ambiente raramente passa disso)
        raw = Math.min(1, rms / 0.35);
        // Multiplica pelo volume real do elemento (mute parcial reflete na chuva)
        raw *= el.volume;
      }

      // Smoothing assimétrico: sobe rápido, desce devagar (sensação natural)
      const cur = smoothRef.current;
      const k = raw > cur ? 0.25 : 0.06;
      const next = cur + (raw - cur) * k;
      smoothRef.current = next;
      if (!cancelled) setLevel(next);

      rafRef.current = requestAnimationFrame(tick);
    };

    // Cria o grafo na primeira interação (regra de autoplay)
    const arm = () => {
      const state = ensureGraph();
      if (state === "suspended") {
        ctxRef.current?.resume().catch(() => {});
      }
    };
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    // Tenta uma vez imediatamente (caso o navegador permita)
    arm();

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
      // Não fechamos o AudioContext: o elemento pode ser reusado e
      // createMediaElementSource só pode ser chamado UMA vez por elemento.
    };
  }, [elementRef]);

  return level;
}
