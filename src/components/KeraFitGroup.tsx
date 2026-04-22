 import { Dumbbell, Lock, Scale, Code2, type LucideIcon } from "lucide-react";
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
   renderAgent: (agentKey: string) => ReactNode;
   unlocked: boolean;
   badgeLabel?: string;
   label?: string;
   description?: string;
   customKeys?: string[];
   icon?: LucideIcon;
 };

/**
 * Header visual que agrupa os 3 agentes do pacote Kera Fit.
 * Renderiza o título do pacote + descrição + os 3 cards (via renderAgent).
 */
 export const KeraFitGroup = ({ 
   renderAgent, 
   unlocked, 
   badgeLabel, 
   label, 
   description, 
   customKeys,
   icon: IconProp
 }: Props) => {
   const displayKeys = (customKeys || KERA_FIT_AGENT_KEYS) as string[];
   const displayLabel = label || KERA_FIT_LABEL;
   const displayDescription = description || KERA_FIT_DESCRIPTION;
   const Icon = IconProp || Dumbbell;
 
   const activeAgents = displayKeys.filter((k) =>
     BUILTIN_AGENTS.some((a) => a.key === k),
   );
 
   return (
     <Card
       className={`p-4 md:p-5 panel border-2 transition-all ${
         unlocked
           ? "border-primary/40 bg-primary/5 shadow-[0_0_24px_-12px_hsl(var(--primary)/0.4)]"
           : "border-dashed border-primary/25 bg-primary/[0.02]"
       }`}
     >
       <header className="flex items-start gap-3 mb-4">
         <div className="size-10 rounded-xl bg-gradient-to-br from-primary/30 to-secondary/20 flex items-center justify-center text-primary shrink-0">
           <Icon className="size-5" />
         </div>
         <div className="flex-1 min-w-0">
           <div className="flex items-center gap-2 flex-wrap">
             <h3 className="font-display text-base md:text-lg text-primary/90">
               {displayLabel.includes("🔥") ? displayLabel : `🔥 ${displayLabel}`}
             </h3>
             {unlocked ? (
               <Badge className="bg-primary/20 text-primary border border-primary/40 hover:bg-primary/20">
                 {badgeLabel ?? "Pacote ativo"}
               </Badge>
             ) : (
               <Badge
                 variant="outline"
                 className="border-primary/30 text-primary/70 gap-1"
               >
                 <Lock className="size-2.5" />
                 {badgeLabel ?? "Pacote bloqueado"}
               </Badge>
             )}
           </div>
           <p className="text-xs text-muted-foreground mt-1">
             {displayDescription}
           </p>
         </div>
       </header>
       <div className={`grid grid-cols-1 sm:grid-cols-${Math.min(displayKeys.length, 3)} gap-3 pl-0 sm:pl-2 sm:border-l-2 sm:border-primary/20`}>
         {activeAgents.map((key) => (
           <div key={key}>{renderAgent(key)}</div>
         ))}
       </div>
     </Card>
   );
 };