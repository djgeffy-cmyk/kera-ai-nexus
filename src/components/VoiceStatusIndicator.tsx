import { Mic, Loader2, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

type VoiceState = "listening" | "thinking" | "speaking" | "idle";

interface Props {
  listening: boolean;
  thinking: boolean;
  speaking: boolean;
}

export function VoiceStatusIndicator({ listening, thinking, speaking }: Props) {
  const state: VoiceState = listening
    ? "listening"
    : thinking
    ? "thinking"
    : speaking
    ? "speaking"
    : "idle";

  if (state === "idle") return null;

  const config = {
    listening: {
      icon: Mic,
      label: "Ouvindo...",
      bar: "bg-destructive",
      ring: "ring-destructive/40",
      text: "text-destructive",
      pulse: true,
    },
    thinking: {
      icon: Loader2,
      label: "Pensando...",
      bar: "bg-accent",
      ring: "ring-accent/40",
      text: "text-accent",
      pulse: false,
    },
    speaking: {
      icon: Volume2,
      label: "Falando...",
      bar: "bg-primary",
      ring: "ring-primary/40",
      text: "text-primary",
      pulse: true,
    },
  }[state];

  const Icon = config.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
    >
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-full bg-background/90 backdrop-blur-md border border-border shadow-lg ring-2",
          config.ring
        )}
      >
        <Icon
          className={cn(
            "size-4",
            config.text,
            state === "thinking" && "animate-spin",
            state === "listening" && "animate-pulse"
          )}
        />
        <span className={cn("text-xs font-medium", config.text)}>
          {config.label}
        </span>
        {/* Barras de áudio animadas */}
        <div className="flex items-end gap-0.5 h-4">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                "w-1 rounded-full",
                config.bar,
                config.pulse ? "animate-voice-bar" : "h-1.5 opacity-40"
              )}
              style={
                config.pulse
                  ? {
                      animationDelay: `${i * 120}ms`,
                      animationDuration: state === "listening" ? "0.8s" : "1s",
                    }
                  : undefined
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
