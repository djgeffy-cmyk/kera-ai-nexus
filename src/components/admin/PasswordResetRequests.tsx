import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Check, Trash2, Mail } from "lucide-react";
import { toast } from "sonner";

type ResetReq = {
  id: string;
  email: string;
  status: string;
  note: string | null;
  requested_at: string;
  resolved_at: string | null;
};

export function PasswordResetRequests() {
  const [items, setItems] = useState<ResetReq[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("password_reset_requests")
      .select("*")
      .order("requested_at", { ascending: false })
      .limit(50);
    if (error) toast.error(error.message);
    else setItems((data || []) as ResetReq[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("password-reset-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "password_reset_requests" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const markResolved = async (id: string) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("password_reset_requests")
      .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: u.user?.id })
      .eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Pedido marcado como resolvido");
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este pedido?")) return;
    const { error } = await supabase.from("password_reset_requests").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Excluído");
  };

  const pending = items.filter((i) => i.status === "pending");
  const resolved = items.filter((i) => i.status !== "pending");

  return (
    <section className="pt-4 border-t border-border space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="size-5 text-primary" />
        <h2 className="font-display text-xl text-glow">Pedidos de reset de senha</h2>
        {pending.length > 0 && (
          <Badge className="bg-destructive/20 text-destructive border-destructive/40">
            {pending.length} pendente{pending.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Quando alguém clica em "Esqueci minha senha", o pedido aparece aqui.
        Entre em contato e redefina manualmente em <span className="text-primary">Cloud → Users</span>.
      </p>

      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {!loading && items.length === 0 && (
        <p className="text-sm text-muted-foreground italic">Nenhum pedido por enquanto.</p>
      )}

      {pending.length > 0 && (
        <div className="space-y-2">
          {pending.map((r) => (
            <Card key={r.id} className="p-4 border-primary/30 bg-primary/5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Mail className="size-4 text-primary shrink-0" />
                    <a href={`mailto:${r.email}`} className="font-medium text-primary hover:underline truncate">
                      {r.email}
                    </a>
                    <Badge variant="outline" className="text-xs">Pendente</Badge>
                  </div>
                  {r.note && (
                    <p className="text-sm text-muted-foreground mt-2 italic">"{r.note}"</p>
                  )}
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {new Date(r.requested_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => markResolved(r.id)}>
                    <Check className="size-4 mr-1" /> Resolvido
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-primary">
            Resolvidos ({resolved.length})
          </summary>
          <div className="mt-2 space-y-1.5">
            {resolved.map((r) => (
              <div key={r.id} className="flex items-center justify-between border border-border rounded-md p-2 text-xs">
                <span className="truncate">{r.email}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {r.resolved_at ? new Date(r.resolved_at).toLocaleDateString("pt-BR") : "—"}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
