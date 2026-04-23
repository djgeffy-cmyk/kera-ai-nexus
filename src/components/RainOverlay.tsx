import { useEffect, useRef } from "react";

/**
 * RainOverlay — chuva suave e realista em canvas.
 * - Fica por cima de qualquer fundo (vídeo da Kera, gradiente, etc).
 * - 3 camadas de profundidade (longe / meio / perto) para parallax sutil.
 * - Gotas finas com leve trilha vertical, variação de velocidade e opacidade.
 * - pointer-events: none — não bloqueia cliques.
 *
 * Props:
 *  - intensity: "soft" | "normal" | "storm"  → tamanho MÁXIMO do pool de gotas
 *  - level: 0..1 → fator dinâmico (densidade visível, opacidade e velocidade).
 *           Use pra sincronizar com volume do som ambiente.
 *           Transição é suavizada internamente (não dá "salto").
 *  - className: classes extras
 */
type Intensity = "soft" | "normal" | "storm";

interface RainOverlayProps {
  intensity?: Intensity;
  level?: number;
  className?: string;
}

interface Drop {
  x: number;
  y: number;
  len: number;
  speed: number;
  thickness: number;
  alpha: number;
  layer: 0 | 1 | 2;
}

const INTENSITY_COUNT: Record<Intensity, number> = {
  soft: 110,
  normal: 200,
  storm: 360,
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Perfil responsivo baseado na largura da viewport.
 * - mobile  (<640px):   menos gotas, menores e mais lentas (não polui a tela)
 * - tablet  (<1024px):  meio termo
 * - desktop (>=1024px): valores cheios
 * Também respeita prefers-reduced-motion → reduz drasticamente.
 */
const getResponsiveProfile = () => {
  if (typeof window === "undefined") {
    return { countMul: 1, sizeMul: 1, speedMul: 1 };
  }
  const w = window.innerWidth;
  const reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let profile;
  if (w < 640) {
    profile = { countMul: 0.45, sizeMul: 0.7, speedMul: 0.75 };
  } else if (w < 1024) {
    profile = { countMul: 0.7, sizeMul: 0.85, speedMul: 0.88 };
  } else {
    profile = { countMul: 1, sizeMul: 1, speedMul: 1 };
  }

  if (reduced) {
    profile.countMul *= 0.4;
    profile.speedMul *= 0.6;
  }
  return profile;
};

const RainOverlay = ({ intensity = "soft", level = 1, className = "" }: RainOverlayProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const dropsRef = useRef<Drop[]>([]);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  // level alvo (atualizado por prop) e level suavizado (usado no render)
  const targetLevelRef = useRef(clamp01(level));
  const smoothLevelRef = useRef(clamp01(level));

  // Atualiza alvo quando a prop muda — sem reiniciar o canvas
  useEffect(() => {
    targetLevelRef.current = clamp01(level);
  }, [level]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let profile = getResponsiveProfile();
    let target = Math.max(20, Math.round(INTENSITY_COUNT[intensity] * profile.countMul));

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      sizeRef.current = { w, h, dpr };
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const makeDrop = (initial: boolean): Drop => {
      const { w, h } = sizeRef.current;
      const r = Math.random();
      const layer: 0 | 1 | 2 = r < 0.5 ? 0 : r < 0.85 ? 1 : 2;

      const speeds = [2.2 * profile.speedMul, 4.0 * profile.speedMul, 6.4 * profile.speedMul];
      const lens = [9 * profile.sizeMul, 14 * profile.sizeMul, 22 * profile.sizeMul];
      const thickness = [
        Math.max(0.4, 0.5 * profile.sizeMul),
        Math.max(0.5, 0.8 * profile.sizeMul),
        Math.max(0.6, 1.2 * profile.sizeMul),
      ];
      const alphas = [0.18, 0.32, 0.5];

      const jitter = 0.6 + Math.random() * 0.8;

      return {
        x: Math.random() * (w + 100) - 50,
        y: initial ? Math.random() * h : -Math.random() * 60,
        len: lens[layer] * jitter,
        speed: speeds[layer] * jitter,
        thickness: thickness[layer],
        alpha: alphas[layer] * (0.7 + Math.random() * 0.5),
        layer,
      };
    };

    const init = () => {
      dropsRef.current = Array.from({ length: target }, () => makeDrop(true));
    };

    resize();
    init();

    let t = 0;

    const tick = () => {
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);

      // Smoothing exponencial do level (sobe rápido, desce mais devagar pra som
      // que cai não cortar a chuva de uma vez)
      const tgt = targetLevelRef.current;
      const cur = smoothLevelRef.current;
      const k = tgt > cur ? 0.06 : 0.025;
      smoothLevelRef.current = cur + (tgt - cur) * k;
      const lvl = smoothLevelRef.current;

      // Mapeamentos não-lineares pra parecer natural
      // - densidade: cresce mais rápido nos volumes baixos (pouco som já mostra umas gotas)
      // - velocidade: chuva mais lenta quando está fraca
      // - opacidade: idem
      const densityFactor = Math.pow(lvl, 0.7);          // 0..1
      const speedFactor = 0.55 + 0.55 * lvl;             // 0.55 .. 1.10
      const alphaFactor = Math.pow(lvl, 0.85);           // 0..1
      const visibleCount = Math.round(target * densityFactor);

      t += 0.005;
      const wind = Math.sin(t) * 0.6 * (0.5 + 0.5 * lvl);

      // Só desenha as primeiras `visibleCount` gotas — mas TODAS continuam se movendo,
      // então quando o som sobe de novo elas já estão em posição (sem "pop")
      const drops = dropsRef.current;
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        const layerWind = wind * (0.3 + d.layer * 0.45);

        const localSpeed = d.speed * speedFactor;
        const x2 = d.x + layerWind * (d.len / 6);
        const y2 = d.y + d.len;

        if (i < visibleCount && alphaFactor > 0.01) {
          const a = d.alpha * alphaFactor;
          const grad = ctx.createLinearGradient(d.x, d.y, x2, y2);
          grad.addColorStop(0, `rgba(190, 220, 240, 0)`);
          grad.addColorStop(1, `rgba(190, 220, 240, ${a})`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = d.thickness;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        d.x += layerWind;
        d.y += localSpeed;

        if (d.y > h + 20) {
          const fresh = makeDrop(false);
          d.x = fresh.x;
          d.y = fresh.y;
          d.len = fresh.len;
          d.speed = fresh.speed;
          d.thickness = fresh.thickness;
          d.alpha = fresh.alpha;
          d.layer = fresh.layer;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    let resizeRaf = 0;
    const onResize = () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resize();
        // Recalcula perfil responsivo (mobile <-> desktop, rotação de tablet, etc)
        profile = getResponsiveProfile();
        target = Math.max(20, Math.round(INTENSITY_COUNT[intensity] * profile.countMul));
        const diff = target - dropsRef.current.length;
        if (diff > 0) {
          for (let i = 0; i < diff; i++) dropsRef.current.push(makeDrop(true));
        } else if (diff < 0) {
          dropsRef.current.length = target;
        }
        // Atualiza tamanho/velocidade das gotas existentes pra refletir o novo perfil
        const sm = profile.sizeMul;
        const spm = profile.speedMul;
        for (const d of dropsRef.current) {
          const baseLen = [9, 14, 22][d.layer];
          const baseSpd = [2.2, 4.0, 6.4][d.layer];
          const baseTh = [0.5, 0.8, 1.2][d.layer];
          // Mantém o jitter relativo aproximado
          const jLen = d.len / ([9, 14, 22][d.layer] || 1) || 1;
          const jSpd = d.speed / ([2.2, 4.0, 6.4][d.layer] || 1) || 1;
          d.len = baseLen * sm * (jLen / (jLen || 1));
          d.len = baseLen * sm * Math.max(0.6, Math.min(1.4, jLen));
          d.speed = baseSpd * spm * Math.max(0.6, Math.min(1.4, jSpd));
          d.thickness = Math.max(0.4, baseTh * sm);
        }
      });
    };
    window.addEventListener("resize", onResize);
    // Reage a mudança de prefers-reduced-motion
    const mql =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    const onMotionChange = () => onResize();
    mql?.addEventListener?.("change", onMotionChange);

    const onVisibility = () => {
      if (document.hidden) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      } else if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(resizeRaf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-10 mix-blend-screen ${className}`}
    />
  );
};

export default RainOverlay;
