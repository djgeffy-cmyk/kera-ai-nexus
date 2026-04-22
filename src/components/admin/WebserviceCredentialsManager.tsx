import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { KeyRound, Eye, EyeOff, Play, AlertTriangle, ShieldCheck, Trash2 } from "lucide-react";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-secrets`;
const PURGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-purge-credentials`;

type SecretSpec = {
  name: string;
  label: string;
  hint?: string;
  group: "Atende.net" | "GovDigital";
  isUrl?: boolean;
};

const SPECS: SecretSpec[] = [
  { name: "ATENDE_WS_BASE_URL", label: "URL base do WSDL", group: "Atende.net", isUrl: true,
    hint: "Ex: https://guaramirim.atende.net/?pg=services&service=WPTProcessoDigital" },
  { name: "ATENDE_WS_USER", label: "Usuário do webservice", group: "Atende.net" },
  { name: "ATENDE_WS_PASS", label: "Senha do webservice", group: "Atende.net" },
  { name: "GOVDIGITAL_BASE_URL", label: "URL base", group: "GovDigital", isUrl: true,
    hint: "Ex: https://guaramirimnamao.govdigital.app" },
  { name: "GOVDIGITAL_USER", label: "Usuário", group: "GovDigital" },
  { name: "GOVDIGITAL_PASS", label: "Senha", group: "GovDigital" },
];

async function authedFetch(url: string, body: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sessão expirada");
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}

export const WebserviceCredentialsManager = () => {
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [purgeResult, setPurgeResult] = useState<{ found: number; updated: number; sample: { hits: string[]; preview: string }[] } | null>(null);

  const load = async () => {
    try {
      const r = await authedFetch(FN_URL, { action: "list" });
      if (!r.ok) throw new Error(r.data?.error ?? `HTTP ${r.status}`);
      setStatus(r.data.status ?? {});
    } catch (e) {
      toast.error(`Falha ao listar: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (name: string) => {
    const value = drafts[name]?.trim();
    if (!value) { toast.error("Informe um valor"); return; }
    setBusy(name);
    try {
      const r = await authedFetch(FN_URL, { action: "set", name, value });
      if (!r.ok) {
        if (r.data?.requires_manual) {
          toast.warning("Cadastre manualmente em Cloud → Secrets", {
            description: `Nome do secret: ${name}. Depois clique em Atualizar status.`,
            duration: 10000,
          });
        } else {
          toast.error(r.data?.error ?? `HTTP ${r.status}`);
        }
        return;
      }
      toast.success(`${name} salvo`, { description: r.data?.note });
      setDrafts((d) => ({ ...d, [name]: "" }));
      await load();
    } finally { setBusy(null); }
  };

  const testAtende = async () => {
    setTesting(true); setTestResult(null);
    try {
      const r = await authedFetch(FN_URL, { action: "test_atende" });
      setTestResult(`HTTP ${r.data?.http_status ?? r.status}\n${r.data?.response_preview ?? r.data?.error ?? ""}`);
      if (r.data?.ok) toast.success("Atende respondeu OK");
      else toast.warning(`Atende retornou ${r.data?.http_status ?? "erro"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setTesting(false); }
  };

  const purge = async (apply: boolean) => {
    setBusy(apply ? "purge-apply" : "purge-scan");
    try {
      let before: string | null = null;
      let totalFound = 0;
      let totalUpdated = 0;
      let totalScanned = 0;
      const sample: { hits: string[]; preview: string }[] = [];
      // Loop em lotes pequenos pra não estourar CPU do edge.
      for (let i = 0; i < 30; i++) {
        const r = await authedFetch(PURGE_URL, { apply, limit: 200, before });
        if (!r.ok) throw new Error(r.data?.error ?? `HTTP ${r.status}`);
        totalScanned += r.data.scanned ?? 0;
        totalFound += r.data.found ?? 0;
        totalUpdated += r.data.updated ?? 0;
        if (sample.length < 10 && Array.isArray(r.data.sample)) {
          sample.push(...r.data.sample.slice(0, 10 - sample.length));
        }
        before = r.data.next_before ?? null;
        if (!before) break;
      }
      setPurgeResult({ found: totalFound, updated: totalUpdated, sample });
      toast.success(
        apply
          ? `${totalUpdated} mensagens mascaradas (${totalScanned} varridas)`
          : `${totalFound} mensagens com credencial em ${totalScanned} varridas`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally { setBusy(null); }
  };

  const groups = Array.from(new Set(SPECS.map((s) => s.group)));

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-start gap-3">
        <KeyRound className="size-5 text-primary mt-1" />
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Credenciais de Webservice</h2>
          <p className="text-sm text-muted-foreground">
            Valores ficam apenas no backend (Lovable Cloud Secrets). Nunca aparecem no chat, logs ou frontend.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={load}>Atualizar status</Button>
      </div>

      {groups.map((g) => (
        <section key={g} className="space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{g}</h3>
          <div className="space-y-3">
            {SPECS.filter((s) => s.group === g).map((spec) => {
              const set = !!status[spec.name];
              const showVal = !!reveal[spec.name];
              return (
                <div key={spec.name} className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Label className="text-sm font-medium">{spec.label}</Label>
                      <p className="text-xs text-muted-foreground font-mono">{spec.name}</p>
                    </div>
                    <Badge variant={set ? "default" : "secondary"}>
                      {set ? "Configurado" : "Vazio"}
                    </Badge>
                  </div>
                  {spec.hint && <p className="text-xs text-muted-foreground">{spec.hint}</p>}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={spec.isUrl || showVal ? "text" : "password"}
                        placeholder={set ? "•••••••• (definido — cole para sobrescrever)" : "Cole aqui"}
                        value={drafts[spec.name] ?? ""}
                        onChange={(e) => setDrafts((d) => ({ ...d, [spec.name]: e.target.value }))}
                        autoComplete="off"
                      />
                      {!spec.isUrl && (
                        <Button
                          type="button" variant="ghost" size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 size-7"
                          onClick={() => setReveal((r) => ({ ...r, [spec.name]: !showVal }))}
                          aria-label={showVal ? "Ocultar" : "Mostrar"}
                        >
                          {showVal ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </Button>
                      )}
                    </div>
                    <Button
                      onClick={() => save(spec.name)}
                      disabled={busy === spec.name || !(drafts[spec.name]?.trim())}
                    >
                      {busy === spec.name ? "Salvando…" : "Salvar"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="border-t border-border pt-4 space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-2"><Play className="size-4" /> Testar conexão Atende</h3>
        <Button variant="secondary" onClick={testAtende} disabled={testing}>
          {testing ? "Chamando…" : "Testar listarOperacoes"}
        </Button>
        {testResult && (
          <pre className="text-xs bg-muted p-2 rounded max-h-48 overflow-auto whitespace-pre-wrap break-all">
            {testResult}
          </pre>
        )}
      </section>

      <section className="border-t border-border pt-4 space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" /> Limpeza retroativa do histórico
        </h3>
        <p className="text-xs text-muted-foreground">
          Varre o histórico em lotes de 200 mensagens (até 6.000 por execução) e mascara qualquer credencial colada no passado.
          Faça primeiro um <b>scan</b> (não altera nada) e depois <b>aplicar</b> se concordar com o resultado.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => purge(false)} disabled={busy?.startsWith("purge")}>
            {busy === "purge-scan" ? "Procurando…" : "Scan (dry-run)"}
          </Button>
          <Button variant="destructive" onClick={() => purge(true)} disabled={busy?.startsWith("purge") || (purgeResult?.found ?? 0) === 0}>
            <Trash2 className="size-4 mr-1" />
            {busy === "purge-apply" ? "Mascarando…" : "Aplicar mascaramento"}
          </Button>
        </div>
        {purgeResult && (
          <div className="text-xs space-y-1">
            <p>
              <b>{purgeResult.found}</b> mensagens com padrão de credencial.
              {purgeResult.updated > 0 && <> <b>{purgeResult.updated}</b> atualizadas.</>}
            </p>
            {purgeResult.sample.length > 0 && (
              <ul className="space-y-1 max-h-40 overflow-auto">
                {purgeResult.sample.map((s, i) => (
                  <li key={i} className="font-mono text-muted-foreground">
                    [{s.hits.join(", ")}] {s.preview}…
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded">
        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
        <p>
          Se você já colou alguma senha no chat antes, <b>troque a senha no sistema de origem</b>.
          O mascaramento só protege daqui pra frente — quem viu o histórico antes da limpeza pode ter capturado.
        </p>
      </div>
    </Card>
  );
};
