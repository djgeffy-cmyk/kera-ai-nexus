import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { BUILTIN_AGENTS } from "@/lib/agents";
import { useUserAccess } from "@/hooks/useUserAccess";
import { KERA_FIT_AGENT_KEYS } from "@/lib/agents";
import { KeraFitGroup } from "@/components/KeraFitGroup";
import keraWaterHero from "@/assets/kera-water-hero.jpg";

// Vídeo animado da Kera (mesmo usado na tela de login). `?v=` invalida cache do CDN.
const KERA_AVATAR_VIDEO =
  "https://ytixqgkzqgeoxrbmjqbo.supabase.co/storage/v1/object/public/kera-videos//kera-avatar-rain.mp4?v=2026-04-22";

/**
 * Tela mostrada uma única vez após o cadastro.
 * O usuário escolhe quais áreas/agentes da Kera quer liberar.
 * A "Kera" generalista é sempre incluída automaticamente.
 */
const Onboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEditing = searchParams.get("edit") === "1";
  const [selected, setSelected] = useState<Set<string>>(new Set(["kera"]));
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { canSee } = useUserAccess();

  useEffect(() => {
    document.title = isEditing ? "Kera AI — Minhas áreas" : "Kera AI — Escolha sua área";
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate("/auth");
        return;
      }
      setUserId(data.user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed, selected_agents")
        .eq("user_id", data.user.id)
        .maybeSingle();

      // Se já completou e NÃO está editando, manda pro chat
      if (profile?.onboarding_completed && !isEditing) {
        navigate("/", { replace: true });
        return;
      }

      // Se está editando, pré-seleciona o que ele já tinha
      if (isEditing && profile?.selected_agents) {
        const current = new Set<string>(profile.selected_agents as string[]);
        current.add("kera"); // Kera sempre marcada
        setSelected(current);
      }
    })();
  }, [navigate, isEditing]);

  const toggle = (key: string) => {
    if (key === "kera") return; // sempre marcada
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const finish = async () => {
    if (!userId) return;
    setSaving(true);
    const list = Array.from(selected);
    const { error } = await supabase
      .from("profiles")
      .update({
        selected_agents: list,
        onboarding_completed: true,
      })
      .eq("user_id", userId);
    setSaving(false);
    if (error) {
      toast.error("Não consegui salvar sua escolha: " + error.message);
      return;
    }
    toast.success(
      isEditing
        ? "Suas áreas foram atualizadas!"
        : `${list.length} ${list.length === 1 ? "área liberada" : "áreas liberadas"}!`
    );
    navigate("/", { replace: true });
  };

  // Os agentes do pacote Kera Fit são renderizados separadamente (no grupo).
  const fitKeys = new Set<string>(KERA_FIT_AGENT_KEYS);

  // ordena: Kera principal primeiro, depois o resto. Remove os do pacote Fit.
  const ordered = [...BUILTIN_AGENTS]
    .filter((a) => canSee(a.key) && !fitKeys.has(a.key))
    .sort((a, b) => {
      if (a.key === "kera") return -1;
      if (b.key === "kera") return 1;
      return a.name.localeCompare(b.name);
    });

  // Verifica se algum agente Fit é visível pro usuário (pra decidir mostrar o grupo)
  const fitVisible = KERA_FIT_AGENT_KEYS.some((k) => canSee(k));
  const anyFitSelected = KERA_FIT_AGENT_KEYS.some((k) => selected.has(k));

  // Renderiza um card de agente Fit dentro do grupo (mesmo visual dos demais cards)
  const renderFitAgent = (agentKey: string) => {
    const a = BUILTIN_AGENTS.find((x) => x.key === agentKey);
    if (!a) return null;
    const Icon = a.icon;
    const isSelected = selected.has(a.key);
    return (
      <Card
        onClick={() => toggle(a.key)}
        className={`p-3 panel cursor-pointer transition-all relative h-full ${
          isSelected
            ? "border-primary shadow-glow bg-primary/5"
            : "border-border hover:border-primary/40"
        }`}
      >
        {isSelected && (
          <div className="absolute top-2 right-2 size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <Check className="size-3" />
          </div>
        )}
        <div className="flex items-start gap-2">
          <div
            className={`size-9 rounded-lg bg-secondary flex items-center justify-center shrink-0 ${a.iconColor}`}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0 flex-1 pr-5">
            <h4 className="font-medium text-sm">{a.name}</h4>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {a.description}
            </p>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none" />
      <main className="relative max-w-5xl mx-auto px-4 py-8 md:py-12">
        {isEditing && (
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="size-4" />
            Voltar ao chat
          </button>
        )}
        <header className="text-center mb-8 md:mb-10">
          <div className="relative mx-auto mb-5 size-28 md:size-36 rounded-full overflow-hidden ring-2 ring-primary/60 shadow-glow bg-background">
            <video
              src={KERA_AVATAR_VIDEO}
              poster={keraWaterHero}
              autoPlay
              loop
              muted
              playsInline
              disablePictureInPicture
              aria-label="Kera — IA"
              className="w-full h-full object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-0 rounded-full ring-1 ring-primary/40 pointer-events-none"
            />
          </div>
          <h1 className="font-display text-2xl md:text-4xl text-glow mb-2">
            {isEditing ? "Suas áreas liberadas" : "Bem-vindo à Kera"}
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-xl mx-auto">
            {isEditing
              ? "Marque ou desmarque áreas a qualquer momento. As alterações são salvas ao confirmar."
              : "Escolha as áreas que você quer desbloquear agora. Você pode liberar mais a qualquer momento."}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-2">
            <Sparkles className="inline size-3 mr-1 text-primary" />
            A <span className="text-primary font-medium">Kera generalista</span> já vem ativa por padrão.
          </p>
        </header>

        {fitVisible && (
          <div className="mb-4">
            <KeraFitGroup
              renderAgent={renderFitAgent}
              unlocked={anyFitSelected}
              badgeLabel={anyFitSelected ? `${KERA_FIT_AGENT_KEYS.filter((k) => selected.has(k)).length}/3 selecionados` : "Marque qualquer um pra incluir"}
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-8">
          {ordered.map(a => {
            const Icon = a.icon;
            const isSelected = selected.has(a.key);
            const isLocked = a.key === "kera";
            return (
              <Card
                key={a.key}
                onClick={() => toggle(a.key)}
                className={`p-4 panel cursor-pointer transition-all relative ${
                  isSelected
                    ? "border-primary shadow-glow bg-primary/5"
                    : "border-border hover:border-primary/40"
                } ${isLocked ? "cursor-default" : ""}`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="size-4" />
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className={`size-11 rounded-xl bg-secondary flex items-center justify-center shrink-0 ${a.iconColor}`}>
                    <Icon className="size-6" />
                  </div>
                  <div className="min-w-0 flex-1 pr-6">
                    <h3 className="font-medium text-sm md:text-base flex items-center gap-2">
                      {a.name}
                      {isLocked && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 font-bold tracking-wider">
                          INCLUSA
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {a.description}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="sticky bottom-4 flex flex-col sm:flex-row gap-3 items-center justify-between bg-card/80 backdrop-blur-md border border-border rounded-2xl p-4 shadow-glow">
          <p className="text-sm text-muted-foreground text-center sm:text-left">
            <span className="text-primary font-bold">{selected.size}</span>{" "}
            {selected.size === 1 ? "área selecionada" : "áreas selecionadas"}
          </p>
          <Button
            onClick={finish}
            disabled={saving}
            size="lg"
            className="bg-gradient-cyber text-primary-foreground shadow-glow w-full sm:w-auto"
          >
            {saving ? "Salvando..." : isEditing ? "Salvar alterações" : "Liberar e continuar"}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Onboarding;