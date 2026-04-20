import { useEffect, useRef } from "react";

interface Props {
  /** Número de partículas. Padrão proporcional à tela. */
  count?: number;
  /** Cor base em HSL CSS var ou string CSS. Padrão: var(--primary). */
  colorVar?: string;
  /** Classe extra pro container absoluto. */
  className?: string;
}

/**
 * Overlay de partículas luminosas em canvas — leve, sem libs.
 * Movimento orgânico (drift lento + leve oscilação senoidal),
 * fade in/out por ciclo de vida, pulsar sutil de brilho.
 * Respeita prefers-reduced-motion (renderiza estático bem fraquinho).
 */
const ParticlesOverlay = ({ count, colorVar = "--primary", className = "" }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0, height = 0;

    // Lê o HSL da var CSS pra montar rgba dinâmico do tema
    const readColor = (): { h: number; s: number; l: number } => {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue(colorVar)
        .trim(); // ex: "186 100% 50%"
      const parts = raw.split(/\s+/);
      const h = parseFloat(parts[0]) || 186;
      const s = parseFloat(parts[1]) || 100;
      const l = parseFloat(parts[2]) || 60;
      return { h, s, l };
    };
    let { h, s, l } = readColor();

    type P = {
      x: number; y: number;
      vx: number; vy: number;
      r: number;
      life: number; maxLife: number;
      phase: number; freq: number;
      amp: number; baseAlpha: number;
    };

    const particles: P[] = [];

    const targetCount = () => {
      if (count) return count;
      // ~1 partícula a cada 9000px² — confortável e leve
      const area = width * height;
      return Math.max(40, Math.min(140, Math.round(area / 9000)));
    };

    const spawn = (initial = false): P => {
      const maxLife = 360 + Math.random() * 480; // ~6-14s a 60fps
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.12, // drift horizontal lento
        vy: -0.05 - Math.random() * 0.18, // sobe devagar (poeira)
        r: 0.6 + Math.random() * 1.8,
        life: initial ? Math.random() * maxLife : 0,
        maxLife,
        phase: Math.random() * Math.PI * 2,
        freq: 0.005 + Math.random() * 0.012,
        amp: 0.3 + Math.random() * 0.9, // amplitude do wobble horizontal
        baseAlpha: 0.25 + Math.random() * 0.55,
      };
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Re-popula pra densidade certa
      const target = targetCount();
      if (particles.length < target) {
        for (let i = particles.length; i < target; i++) particles.push(spawn(true));
      } else if (particles.length > target) {
        particles.length = target;
      }
    };

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    resize();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    // Re-lê cor caso o tema mude (light/dark)
    const themeObserver = new MutationObserver(() => {
      const c = readColor();
      h = c.h; s = c.s; l = c.l;
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });

    let lastT = performance.now();

    const render = (t: number) => {
      const dt = Math.min(48, t - lastT); // cap pra evitar jumps
      lastT = t;
      const step = dt / 16.6667; // normaliza pra ~60fps

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter"; // partículas somam brilho

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!prefersReduced) {
          p.life += step;
          p.phase += p.freq * step;
          p.x += (p.vx + Math.sin(p.phase) * p.amp * 0.04) * step;
          p.y += p.vy * step;
        }

        // Wrap horizontal, respawn quando some por cima ou termina vida
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10 || p.life >= p.maxLife) {
          Object.assign(p, spawn(false));
          p.y = height + 10; // entra por baixo
          p.x = Math.random() * width;
        }

        // Envelope de alpha: fade in início, fade out fim
        const lifeNorm = p.life / p.maxLife;
        const env = lifeNorm < 0.15
          ? lifeNorm / 0.15
          : lifeNorm > 0.85
            ? (1 - lifeNorm) / 0.15
            : 1;
        const twinkle = 0.75 + Math.sin(p.phase * 2) * 0.25;
        const alpha = p.baseAlpha * env * twinkle;

        // Glow radial — gradiente rápido
        const r = p.r;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 6);
        grad.addColorStop(0, `hsla(${h}, ${s}%, ${Math.min(85, l + 20)}%, ${alpha})`);
        grad.addColorStop(0.4, `hsla(${h}, ${s}%, ${l}%, ${alpha * 0.35})`);
        grad.addColorStop(1, `hsla(${h}, ${s}%, ${l}%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 6, 0, Math.PI * 2);
        ctx.fill();

        // Núcleo brilhante
        ctx.fillStyle = `hsla(${h}, ${s}%, 92%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";

      if (!prefersReduced) {
        rafRef.current = requestAnimationFrame(render);
      }
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", onResize);
      themeObserver.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [count, colorVar]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
    />
  );
};

export default ParticlesOverlay;
