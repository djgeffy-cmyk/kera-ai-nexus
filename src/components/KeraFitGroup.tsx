 import { Dumbbell, Lock, ChevronDown, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  KERA_FIT_AGENT_KEYS,
  KERA_FIT_LABEL,
  KERA_FIT_DESCRIPTION,
  BUILTIN_AGENTS,
} from "@/lib/agents";
import { useState, type ReactNode } from "react";

 type Props = {
   renderAgent: (agentKey: string) => ReactNode;
   unlocked: boolean;
   badgeLabel?: string;
   label?: string;
   description?: string;
   customKeys?: string[];
   icon?: LucideIcon;
   /** Se aberto inicialmente. Padrão: fechado (clica pra abrir os subagentes). */
   defaultOpen?: boolean;
 };

/**
 * Header visual que agrupa os 3 agentes do pacote Kera Fit.
 * Card único clicável: ao clicar, expande mostrando os subagentes
 * (Nutricionista, Treinador, Iron). Igual estilo Gemini/ChatGPT.
 */
 export const KeraFitGroup = ({ 
   renderAgent, 
   unlocked, 
   badgeLabel, 
   label, 
   description, 
   customKeys,
   icon: IconProp,
   defaultOpen = false,
 }: Props) => {
   const displayKeys = (customKeys || KERA_FIT_AGENT_KEYS) as string[];
   const displayLabel = label || KERA_FIT_LABEL;
   const displayDescription = description || KERA_FIT_DESCRIPTION;
   const Icon = IconProp || Dumbbell;
 
   const activeAgents = displayKeys.filter((k) =>
     BUILTIN_AGENTS.some((a) => a.key === k),
   );
   const [open, setOpen] = useState<boolean>(defaultOpen);
   const count = activeAgents.length;
   const titleWithEmoji = displayLabel.includes("🔥") ? displayLabel : `🔥 ${displayLabel}`;
 
   return (
     <Collapsible open={open} onOpenChange={setOpen} asChild>
       <Card
         className={`overflow-hidden p-0 panel border-2 transition-all ${
           unlocked
             ? "border-primary/40 bg-primary/5 shadow-[0_0_24px_-12px_hsl(var(--primary)/0.4)]"
             : "border-dashed border-primary/25 bg-primary/[0.02]"
         } ${open ? "shadow-[0_0_30px_-10px_hsl(var(--primary)/0.45)]" : ""}`}
       >
         <CollapsibleTrigger
           className="w-full text-left p-4 md:p-5 flex items-start gap-3 group/trigger hover:bg-primary/[0.04] transition-colors"
           aria-label={`${open ? "Recolher" : "Expandir"} ${displayLabel} — ${count} subagentes`}
         >
           <div className="size-10 rounded-xl bg-gradient-to-br from-primary/30 to-secondary/20 flex items-center justify-center text-primary shrink-0 transition-transform group-hover/trigger:scale-105">
             <Icon className="size-5" />
           </div>
           <div className="flex-1 min-w-0">
             <div className="flex items-center gap-2 flex-wrap">
               <h3 className="font-display text-base md:text-lg text-primary/90">
                 {titleWithEmoji}
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
               <Badge
                 variant="outline"
                 className="border-primary/20 text-muted-foreground/80 text-[10px] font-medium"
               >
                 {count} {count === 1 ? "agente" : "agentes"}
               </Badge>
             </div>
             <p className="text-xs text-muted-foreground mt-1">
               {displayDescription}
             </p>
             <p className="text-[11px] text-primary/60 mt-1.5 font-medium">
               {open ? "Toque pra recolher" : "Toque pra ver os subagentes"}
             </p>
           </div>
           <ChevronDown
             className={`size-5 text-primary/70 shrink-0 transition-transform duration-300 ${
               open ? "rotate-180" : ""
             }`}
             aria-hidden="true"
           />
         </CollapsibleTrigger>
         <CollapsibleContent className="overflow-hidden data-[state=open]:animate-[fade-in_300ms_ease-out] data-[state=closed]:animate-[fade-out_200ms_ease-in]">
           <div
             className={`px-4 pb-4 md:px-5 md:pb-5 pt-1 grid grid-cols-1 ${
               count >= 3 ? "sm:grid-cols-3" : count === 2 ? "sm:grid-cols-2" : "sm:grid-cols-1"
             } gap-3 border-t border-primary/15`}
           >
             {activeAgents.map((key) => (
               <div key={key} className="animate-fade-in-up">{renderAgent(key)}</div>
             ))}
           </div>
         </CollapsibleContent>
       </Card>
     </Collapsible>
   );
 };