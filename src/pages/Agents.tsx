import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Sparkles, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { BUILTIN_AGENTS } from "@/lib/agents";
import keraLogo from "@/assets/kera-logo.png";

type Agent = {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  icon: string;
  color: string;
};

const AgentsPage = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", system_prompt: "" });

  useEffect(() => {
    document.title = "Kera AI — Agentes";
    load();
  }, []);

  const load = async () => {
    const { data, error } = await supabase.from("agents").select("*").order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setAgents(data as Agent[]);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", description: "", system_prompt: "" });
    setOpen(true);
  };

  const openEdit = (a: Agent) => {
    setEditing(a);
    setForm({ name: a.name, description: a.description || "", system_prompt: a.system_prompt });
    setOpen(true);
  };

  const save = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (!form.name.trim() || !form.system_prompt.trim()) {
      toast.error("Nome e prompt são obrigatórios.");
      return;
    }
    if (editing) {
      const { error } = await supabase.from("agents")
        .update({ name: form.name, description: form.description, system_prompt: form.system_prompt })
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Agente atualizado.");
    } else {
      const { error } = await supabase.from("agents").insert({
        user_id: u.user.id, name: form.name, description: form.description, system_prompt: form.system_prompt,
        icon: "sparkles", color: "cyan",
      });
      if (error) return toast.error(error.message);
      toast.success("Agente criado.");
    }
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este agente?")) return;
    const { error } = await supabase.from("agents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setAgents(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border panel flex items-center px-4 md:px-6 gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}><ArrowLeft className="size-5" /></Button>
        <img src={keraLogo} alt="Kera AI" className="h-7" />
        <h1 className="font-display text-glow text-lg ml-2">AGENTES</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="ml-auto bg-gradient-cyber text-primary-foreground shadow-glow">
              <Plus className="size-4 mr-1" /> Novo agente
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-display text-glow">{editing ? "Editar" : "Criar"} agente</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Nome</label>
                <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ex: Kera Marketing" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Descrição (opcional)</label>
                <Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Breve resumo do que faz" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">System prompt</label>
                <Textarea value={form.system_prompt} onChange={e => setForm({...form, system_prompt: e.target.value})}
                  rows={8} placeholder="Você é a Kera Marketing, especialista em..." />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={save} className="bg-gradient-cyber text-primary-foreground">Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <section>
          <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-3">Agentes prontos</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {BUILTIN_AGENTS.map(a => {
              const Icon = a.icon;
              return (
                <Card key={a.key} className="p-4 panel border-border">
                  <div className="flex items-start gap-3">
                    <div className={`size-10 rounded-xl bg-secondary flex items-center justify-center ${a.iconColor}`}>
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-medium">{a.name}</h3>
                      <p className="text-xs text-muted-foreground">{a.description}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-1">Seus agentes customizados</h2>
          <p className="text-xs text-muted-foreground/70 mb-3">Crie aqui agentes extras com prompt personalizado — os agentes prontos acima já estão ativos no chat.</p>
          {agents.length === 0 ? (
            <Card className="p-6 panel border-dashed border-border/60 text-center">
              <Sparkles className="size-6 text-primary/60 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Você ainda não criou nenhum agente customizado.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Use "Novo agente" no topo pra montar um especialista do seu jeito.</p>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {agents.map(a => (
                <Card key={a.id} className="p-4 panel border-border group">
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                      <Sparkles className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{a.name}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">{a.description || "Sem descrição"}</p>
                    </div>
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => openEdit(a)} className="p-1 hover:text-primary"><Pencil className="size-4" /></button>
                      <button onClick={() => remove(a.id)} className="p-1 hover:text-destructive"><Trash2 className="size-4" /></button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default AgentsPage;
