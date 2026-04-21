import { cn } from "@/lib/utils";

interface UmbrellaCorpLogoProps {
  className?: string;
  size?: number;
}

/**
 * Logo inspirado no octógono da Umbrella Corp (Resident Evil),
 * adaptado às cores do tema Kera (primary).
 * 8 pétalas alternadas formando um guarda-chuva geométrico de cima.
 */
export const UmbrellaCorpLogo = ({ className, size = 96 }: UmbrellaCorpLogoProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn("drop-shadow-[0_0_12px_hsl(var(--primary)/0.6)]", className)}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="umbrella-glow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Halo glow */}
      <circle cx="50" cy="50" r="48" fill="url(#umbrella-glow)" />

      {/* Outer octagonal frame */}
      <polygon
        points="50,4 82,18 96,50 82,82 50,96 18,82 4,50 18,18"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* 8 pétalas alternadas (cheia / vazia) — top, top-right, right, bottom-right, ... */}
      {/* Pétala 1 - topo (cheia) */}
      <path d="M50,8 L50,50 L24,24 Z" fill="hsl(var(--primary))" />
      {/* Pétala 2 - topo-direita (vazia) */}
      <path d="M50,8 L50,50 L76,24 Z" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1.2" />
      {/* Pétala 3 - direita (cheia) */}
      <path d="M92,50 L50,50 L76,76 Z" fill="hsl(var(--primary))" />
      {/* Pétala 4 - baixo-direita (vazia) */}
      <path d="M92,50 L50,50 L76,24 Z" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1.2" />
      {/* Pétala 5 - baixo (cheia) */}
      <path d="M50,92 L50,50 L76,76 Z" fill="hsl(var(--primary))" />
      {/* Pétala 6 - baixo-esquerda (vazia) */}
      <path d="M50,92 L50,50 L24,76 Z" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1.2" />
      {/* Pétala 7 - esquerda (cheia) */}
      <path d="M8,50 L50,50 L24,24 Z" fill="hsl(var(--primary))" />
      {/* Pétala 8 - cima-esquerda (vazia) */}
      <path d="M8,50 L50,50 L24,76 Z" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1.2" />

      {/* Centro */}
      <circle cx="50" cy="50" r="5" fill="hsl(var(--primary))" />
      <circle cx="50" cy="50" r="2" fill="hsl(var(--background))" />

      {/* Linhas radiais (bastões do guarda-chuva) */}
      <g stroke="hsl(var(--primary))" strokeWidth="0.8" opacity="0.9">
        <line x1="50" y1="8" x2="50" y2="50" />
        <line x1="92" y1="50" x2="50" y2="50" />
        <line x1="50" y1="92" x2="50" y2="50" />
        <line x1="8" y1="50" x2="50" y2="50" />
        <line x1="76" y1="24" x2="50" y2="50" />
        <line x1="76" y1="76" x2="50" y2="50" />
        <line x1="24" y1="76" x2="50" y2="50" />
        <line x1="24" y1="24" x2="50" y2="50" />
      </g>
    </svg>
  );
};

export default UmbrellaCorpLogo;