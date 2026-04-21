import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Rule {
  label: string;
  test: (pwd: string) => boolean;
}

const RULES: Rule[] = [
  { label: "Mínimo 12 caracteres", test: (p) => p.length >= 12 },
  { label: "Letra maiúscula (A-Z)", test: (p) => /[A-Z]/.test(p) },
  { label: "Letra minúscula (a-z)", test: (p) => /[a-z]/.test(p) },
  { label: "Número (0-9)", test: (p) => /[0-9]/.test(p) },
  { label: "Caractere especial (!@#...)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const LEVELS = [
  { label: "Muito fraca", color: "bg-destructive", text: "text-destructive" },
  { label: "Fraca", color: "bg-destructive/80", text: "text-destructive" },
  { label: "Razoável", color: "bg-yellow-500", text: "text-yellow-500" },
  { label: "Boa", color: "bg-yellow-400", text: "text-yellow-400" },
  { label: "Forte", color: "bg-primary/80", text: "text-primary" },
  { label: "NASA-Grade", color: "bg-primary", text: "text-primary" },
];

interface Props {
  password: string;
  className?: string;
}

export const PasswordStrengthMeter = ({ password, className }: Props) => {
  if (!password) return null;

  const passed = RULES.map((r) => r.test(password));
  const score = passed.filter(Boolean).length; // 0..5
  const level = LEVELS[score];
  const pct = (score / RULES.length) * 100;

  return (
    <div className={cn("mt-2 space-y-2", className)}>
      <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
        <div
          className={cn("h-full transition-all duration-300 ease-out", level.color)}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={RULES.length}
          aria-label={`Força da senha: ${level.label}`}
        />
      </div>
      <p className={cn("text-xs font-medium tracking-wide", level.text)}>
        {level.label}
      </p>
      <ul className="space-y-1 text-xs">
        {RULES.map((rule, i) => {
          const ok = passed[i];
          return (
            <li
              key={rule.label}
              className={cn(
                "flex items-center gap-1.5 transition-colors",
                ok ? "text-primary" : "text-muted-foreground/70",
              )}
            >
              {ok ? (
                <Check className="size-3.5 shrink-0" aria-hidden />
              ) : (
                <X className="size-3.5 shrink-0 opacity-60" aria-hidden />
              )}
              <span>{rule.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
