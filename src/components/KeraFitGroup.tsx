import { Dumbbell, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  KERA_FIT_AGENT_KEYS,
  KERA_FIT_LABEL,
  KERA_FIT_DESCRIPTION,
  BUILTIN_AGENTS,
} from "@/lib/agents";
import type { ReactNode } from "react";

type Props = {
  /** Render function pra cada agente do grupo (Onboarding usa card com toggle, /agents usa card de navegação). */
  renderAgent: (agentKey: string) => ReactNode;
  /** Se algum dos 3 está liberado pro usuário (libera todo o pacote). */
  unlocked: boolean;
  /** "Liberar Kera Fit" / "Pacote ativo" — badge contextual. */
  badgeLabel?: string;
};

/**
 * Header visual que agrupa os 3 agentes do pacote Kera Fit.
 * Renderiza o título do pacote + descrição + os 3 cards (via renderAgent).
 */
export const KeraFitGroup = ({ renderAgent, unlocked, badgeLabel }: Props) => {
  // Filtra só os agentes que existem em BUILTIN_AGENTS
  const fitAgents = KERA_FIT_AGENT_KEYS.filter((k) =>
    BUILTIN_AGENTS.some((a) => a.key === k),
  );

  return (
    <Card
      className={`p-4 md:p-5 panel border-2 transition-all ${
        unlocked
          ? "border-fuchsia-500/40 bg-fuchsia-500/5 shadow-[0_0_24px_-12px_hsl(280_70%_55%/0.4)]"
          : "border-dashed border-fuchsia-500/25 bg-fuchsia-500/[0.02]"
      }`}
    >
      <header className="flex items-start gap-3 mb-4">
        <div className="size-10 rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-amber-500/20 flex items-center justify-center text-fuchsia-300 shrink-0">
          <Dumbbell className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-base md:text-lg text-fuchsia-200">
              🔥 {KERA_FIT_LABEL}
            </h3>
            {unlocked ? (
              <Badge className="bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-500/40 hover:bg-fuchsia-500/20">
                {badgeLabel ?? "Pacote ativo"}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-fuchsia-500/30 text-fuchsia-300/70 gap-1"
              >
                <Lock className="size-2.5" />
                {badgeLabel ?? "Pacote bloqueado"}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {KERA_FIT_DESCRIPTION}
          </p>
        </div>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-0 sm:pl-2 sm:border-l-2 sm:border-fuchsia-500/20">
        {fitAgents.map((key) => (
          <div key={key}>{renderAgent(key)}</div>
        ))}
      </div>
    </Card>
  );
};