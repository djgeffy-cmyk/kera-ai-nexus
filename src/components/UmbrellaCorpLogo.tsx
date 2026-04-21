import { cn } from "@/lib/utils";

interface UmbrellaCorpLogoProps {
  className?: string;
  size?: number;
  /**
   * Variante visual do centro:
   * - "default": ponto sólido (estilo Umbrella Corp clássico)
   * - "realistic-eye": olho realista no centro (íris, pupila, reflexos, cílios)
   */
  variant?: "default" | "realistic-eye";
}

/**
 * Logo inspirado no octógono da Umbrella Corp (Resident Evil),
 * adaptado às cores do tema Kera (primary).
 * 8 pétalas alternadas formando um guarda-chuva geométrico de cima.
 */
export const UmbrellaCorpLogo = ({ className, size = 96, variant = "default" }: UmbrellaCorpLogoProps) => {
  const uid = `ucl-${variant}`;
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
        <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </radialGradient>

        {/* Gradientes do olho realista */}
        <radialGradient id={`${uid}-iris`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
          <stop offset="40%" stopColor="hsl(var(--primary))" stopOpacity="0.85" />
          <stop offset="75%" stopColor="hsl(var(--primary))" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.9" />
        </radialGradient>
        <radialGradient id={`${uid}-iris-inner`} cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.25" />
          <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-sclera`} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="80%" stopColor="#e8eaef" stopOpacity="1" />
          <stop offset="100%" stopColor="#9aa1ad" stopOpacity="1" />
        </radialGradient>
        <radialGradient id={`${uid}-pupil`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" stopOpacity="1" />
          <stop offset="80%" stopColor="#0a0a0a" stopOpacity="1" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
        </radialGradient>
        <clipPath id={`${uid}-eye-clip`}>
          {/* forma de olho amendoado */}
          <path d="M50,42 C58,42 64,46 66,50 C64,54 58,58 50,58 C42,58 36,54 34,50 C36,46 42,42 50,42 Z" />
        </clipPath>
      </defs>

      {/* Halo glow */}
      <circle cx="50" cy="50" r="48" fill={`url(#${uid}-glow)`} />

      {/* Outer octagonal frame */}
      <polygon
        points="50,4 82,18 96,50 82,82 50,96 18,82 4,50 18,18"
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* 8 pétalas alternadas (cheia / vazia) — sentido horário a partir do topo */}
      {/* Vértices do octógono: T(50,8) TR(76,24) R(92,50) BR(76,76) B(50,92) BL(24,76) L(8,50) TL(24,24) */}
      {/* 1 - topo → topo-direita (cheia) */}
      <path d="M50,50 L50,8 L76,24 Z" fill="hsl(var(--primary))" />
      {/* 2 - topo-direita → direita (vazia) */}
      <path d="M50,50 L76,24 L92,50 Z" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1" />
      {/* 3 - direita → baixo-direita (cheia) */}
      <path d="M50,50 L92,50 L76,76 Z" fill="hsl(var(--primary))" />
      {/* 4 - baixo-direita → baixo (vazia) */}
      <path d="M50,50 L76,76 L50,92 Z" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1" />
      {/* 5 - baixo → baixo-esquerda (cheia) */}
      <path d="M50,50 L50,92 L24,76 Z" fill="hsl(var(--primary))" />
      {/* 6 - baixo-esquerda → esquerda (vazia) */}
      <path d="M50,50 L24,76 L8,50 Z" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1" />
      {/* 7 - esquerda → cima-esquerda (cheia) */}
      <path d="M50,50 L8,50 L24,24 Z" fill="hsl(var(--primary))" />
      {/* 8 - cima-esquerda → topo (vazia) */}
      <path d="M50,50 L24,24 L50,8 Z" fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1" />

      {/* Centro — variante */}
      {variant === "default" ? (
        <>
          <circle cx="50" cy="50" r="5" fill="hsl(var(--primary))" />
          <circle cx="50" cy="50" r="2" fill="hsl(var(--background))" />
        </>
      ) : (
        <g>
          {/* Esclera (branco do olho) com clip amendoado */}
          <g clipPath={`url(#${uid}-eye-clip)`}>
            <rect x="32" y="40" width="36" height="20" fill={`url(#${uid}-sclera)`} />
            {/* Veias sutis */}
            <path d="M35,52 Q40,53 44,51" stroke="#d4838a" strokeWidth="0.18" fill="none" opacity="0.6" />
            <path d="M65,49 Q60,48 56,50" stroke="#d4838a" strokeWidth="0.18" fill="none" opacity="0.5" />
            {/* Sombra superior (pálpebra) */}
            <ellipse cx="50" cy="42" rx="18" ry="3.5" fill="#000" opacity="0.35" />
            {/* Sombra inferior */}
            <ellipse cx="50" cy="58" rx="16" ry="1.8" fill="#000" opacity="0.18" />
          </g>

          {/* Íris */}
          <circle cx="50" cy="50" r="6" fill={`url(#${uid}-iris)`} />
          {/* Anel externo da íris (limbus) */}
          <circle cx="50" cy="50" r="6" fill="none" stroke="#000" strokeWidth="0.4" opacity="0.85" />
          {/* Estrias radiais da íris */}
          <g stroke="hsl(var(--primary))" strokeWidth="0.25" opacity="0.7">
            {Array.from({ length: 24 }).map((_, i) => {
              const angle = (i * Math.PI * 2) / 24;
              const x1 = 50 + Math.cos(angle) * 2.2;
              const y1 = 50 + Math.sin(angle) * 2.2;
              const x2 = 50 + Math.cos(angle) * 5.6;
              const y2 = 50 + Math.sin(angle) * 5.6;
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
            })}
          </g>
          {/* Brilho interno da íris */}
          <circle cx="50" cy="50" r="6" fill={`url(#${uid}-iris-inner)`} />

          {/* Pupila */}
          <circle cx="50" cy="50" r="2.4" fill={`url(#${uid}-pupil)`} />

          {/* Reflexos especulares (catchlights) */}
          <ellipse cx="48.4" cy="48.4" rx="1.1" ry="0.7" fill="#fff" opacity="0.95" />
          <circle cx="51.6" cy="51.4" r="0.4" fill="#fff" opacity="0.8" />

          {/* Pálpebra superior — linha forte */}
          <path
            d="M34,50 C36,46 42,42 50,42 C58,42 64,46 66,50"
            fill="none"
            stroke="#000"
            strokeWidth="0.7"
            strokeLinecap="round"
            opacity="0.9"
          />
          {/* Pálpebra inferior */}
          <path
            d="M34,50 C36,54 42,58 50,58 C58,58 64,54 66,50"
            fill="none"
            stroke="#000"
            strokeWidth="0.5"
            strokeLinecap="round"
            opacity="0.7"
          />

          {/* Cílios superiores */}
          <g stroke="#000" strokeWidth="0.4" strokeLinecap="round" opacity="0.85">
            <line x1="38" y1="44.5" x2="37" y2="42.5" />
            <line x1="42" y1="43" x2="41.5" y2="40.8" />
            <line x1="46" y1="42.3" x2="46" y2="40" />
            <line x1="50" y1="42" x2="50" y2="39.6" />
            <line x1="54" y1="42.3" x2="54" y2="40" />
            <line x1="58" y1="43" x2="58.5" y2="40.8" />
            <line x1="62" y1="44.5" x2="63" y2="42.5" />
          </g>

          {/* Canto interno (caruncle) */}
          <ellipse cx="34.5" cy="50" rx="0.9" ry="0.6" fill="#c98a92" opacity="0.7" />
        </g>
      )}

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