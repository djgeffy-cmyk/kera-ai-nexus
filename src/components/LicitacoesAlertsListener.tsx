import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Gavel } from "lucide-react";

/**
 * Listener global que escuta novos alertas de licitações em tempo real
 * e dispara um toast quando uma nova licitação aberta é detectada pelo cron.
 */
export const LicitacoesAlertsListener = () => {
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;

    // Marca os alertas existentes como "já vistos" pra não disparar toast no carregamento
    const init = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      // Verifica se é admin (RLS bloqueia se não for, então tentamos buscar)
      const { data, error } = await supabase
        .from("licitacoes_alerts")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) return; // não-admin ou tabela não acessível
      if (!active) return;
      data?.forEach((a) => seenRef.current.add(a.id));

      const channel = supabase
        .channel("licitacoes_alerts_realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "licitacoes_alerts" },
          (payload) => {
            const row = payload.new as {
              id: string;
              numero?: string;
              modalidade?: string;
              objeto?: string;
              link?: string;
              data_encerramento?: string;
            };
            if (seenRef.current.has(row.id)) return;
            seenRef.current.add(row.id);

            toast(
              `Nova licitação aberta${row.numero ? ` · ${row.numero}` : ""}`,
              {
                description: [
                  row.modalidade,
                  row.objeto?.slice(0, 100),
                  row.data_encerramento ? `Encerra: ${row.data_encerramento}` : null,
                ].filter(Boolean).join(" · "),
                icon: <Gavel className="size-4 text-primary" />,
                duration: 12000,
                action: row.link ? {
                  label: "Abrir",
                  onClick: () => window.open(row.link!, "_blank"),
                } : undefined,
              }
            );
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    const cleanupPromise = init();
    return () => {
      active = false;
      cleanupPromise.then((c) => c?.());
    };
  }, []);

  return null;
};
