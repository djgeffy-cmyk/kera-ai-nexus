import { useEffect, useRef } from "react";

/**
 * RainOverlay — chuva suave e realista em canvas.
 * - Fica por cima de qualquer fundo (vídeo da Kera, gradiente, etc).
 * - 3 camadas de profundidade (longe / meio / perto) para parallax sutil.
 * - Gotas finas com leve trilha vertical, variação de velocidade e opacidade.
 * - pointer-events: none — não bloqueia cliques.
 *
 * Props:
 *  - intensity: "soft" | "normal" | "storm"  (default: "soft")
 *  - className: classes extras (ex.: "opacity-80")
 */
type Intensity = "soft" | "normal" | "storm";

interface RainOverlayProps {
  intensity?: Intensity;
  className?: string;
}

interface Drop {
  x: number;
  y: number;
  len: number;     // comprimento do traço
  speed: number;   // px / frame
  thickness: number;
  alpha: number;
  layer: 0 | 1 | 2; // longe (0) ... perto (2)
}

const INTENSITY_COUNT: Record<Intensity, number> = {
  soft: 110,
  normal: 200,
  storm: 360,
};

const RainOverlay = ({ intensity = "soft", className = "" }: RainOverlayProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const dropsRef = useRef<Drop[]>([]);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const target = INTENSITY_COUNT[intensity];

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
      // 3 camadas: 50% longe, 35% meio, 15% perto
      const r = Math.random();
      const layer: 0 | 1 | 2 = r < 0.5 ? 0 : r < 0.85 ? 1 : 2;

      const speeds = [2.2, 4.0, 6.4];
      const lens = [9, 14, 22];
      const thickness = [0.5, 0.8, 1.2];
      const alphas = [0.18, 0.32, 0.5];

      // Leve aleatoriedade pra não parecer regular
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

    // Vento suave que oscila com o tempo (senoidal)
    let t = 0;

    const tick = () => {
      const { w, h } = sizeRef.current;
      // Limpa em vez de fazer trilhas: mantém o overlay leve e sem fundo escurecendo
      ctx.clearRect(0, 0, w, h);

      t += 0.005;
      const wind = Math.sin(t) * 0.6; // -0.6 .. 0.6 px/frame

      for (const d of dropsRef.current) {
        // Gotas perto sofrem mais vento; longe quase não mexem
        const layerWind = wind * (0.3 + d.layer * 0.45);

        // Traço com leve gradiente (mais transparente no topo)
        const x2 = d.x + layerWind * (d.len / 6);
        const y2 = d.y + d.len;

        const grad = ctx.createLinearGradient(d.x, d.y, x2, y2);
        grad.addColorStop(0, `rgba(190, 220, 240, 0)`);
        grad.addColorStop(1, `rgba(190, 220, 240, ${d.alpha})`);

        ctx.strokeStyle = grad;
        ctx.lineWidth = d.thickness;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        d.x += layerWind;
        d.y += d.speed;

        if (d.y > h + 20) {
          // recicla a gota
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
        // re-densifica suavemente sem reiniciar tudo
        const diff = target - dropsRef.current.length;
        if (diff > 0) {
          for (let i = 0; i < diff; i++) dropsRef.current.push(makeDrop(true));
        } else if (diff < 0) {
          dropsRef.current.length = target;
        }
      });
    };
    window.addEventListener("resize", onResize);

    // Pausa quando aba perde foco (poupa bateria)
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
