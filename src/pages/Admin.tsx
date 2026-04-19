import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, X, KeyRound, ExternalLink, Volume2, Play } from "lucide-react";
import { PROVIDERS, SECRET_NAMES, getPreferredProvider, setPreferredProvider, type ProviderId } from "@/lib/providers";
import { loadVoicesAsync, getPreferredVoiceURI, setPreferredVoiceURI, classifyVoice } from "@/lib/nativeVoice";
import { toast } from "sonner";
import keraLogo from "@/assets/kera-logo.png";
import { MonitorTargetsManager } from "@/components/admin/MonitorTargetsManager";
import { NetworkMetricsChart } from "@/components/admin/NetworkMetricsChart";
import { PasswordResetRequests } from "@/components/admin/PasswordResetRequests";
import { IpmEndpointsManager } from "@/components/admin/IpmEndpointsManager";
import { KeraPromptEditor } from "@/components/admin/KeraPromptEditor";
import { KeraVoiceSelector } from "@/components/admin/KeraVoiceSelector";
import { KeraTriggersManager } from "@/components/admin/KeraTriggersManager";
import { PronunciationFixesManager } from "@/components/admin/PronunciationFixesManager";
import { ElevenLabsQuotaCard } from "@/components/admin/ElevenLabsQuotaCard";

type Status = Record<string, boolean>;

const STATUS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/providers-status`;

const Admin = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>({});
  const [loading, setLoading] = useState(true);
  const [pref, setPref] = useState<ProviderId>(getPreferredProvider());
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string | null>(getPreferredVoiceURI());

  useEffect(() => {
    document.title = "Kera AI — Painel Admin";
    fetch(STATUS_URL)
      .then(r => r.json())
      .then(setStatus)
      .catch(() => toast.error("Não foi possível carregar status dos provedores."))
      .finally(() => setLoading(false));
    loadVoicesAsync().then(setVoices);
  }, []);

  // Apenas vozes femininas em português — a Kera é feminina
  const femaleVoices = useMemo(
    () => voices.filter(v => v.lang.toLowerCase().startsWith("pt") && classifyVoice(v) === "feminina"),
    [voices]
  );
  const ptAll = useMemo(
    () => voices.filter(v => v.lang.toLowerCase().startsWith("pt")),
    [voices]
  );
  const displayVoices = femaleVoices.length > 0 ? femaleVoices : ptAll;

  const chooseVoice = (uri: string) => {
    setVoiceURI(uri);
    setPreferredVoiceURI(uri);
    const v = voices.find(x => x.voiceURI === uri);
    toast.success(`Voz: ${v?.name ?? "padrão"}`);
  };

  const previewVoice = (v: SpeechSynthesisVoice) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance("Olá, eu sou a Kera. Esta é a minha voz.");
    u.voice = v;
    u.lang = v.lang;
    u.rate = 1.05;
    u.pitch = 1.05;
    window.speechSynthesis.speak(u);
  };

  const choose = (id: ProviderId) => {
    setPref(id);
    setPreferredProvider(id);
    toast.success(`Provedor padrão: ${PROVIDERS.find(p => p.id === id)?.label}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border panel flex items-center px-4 md:px-6 gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="size-5" />
        </Button>
        <img src={keraLogo} alt="Kera AI" className="h-7" />
        <h1 className="font-display text-glow text-lg ml-2">PAINEL ADMIN</h1>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6 overflow-x-hidden">
        <section>
          <h2 className="font-display text-xl text-glow mb-1">Provedores de IA</h2>
          <p className="text-sm text-muted-foreground">
            Conecte chaves opcionais. A Kera escolhe a primeira disponível ou a que você fixar abaixo.
            Para adicionar/remover chaves, peça no chat: <span className="text-primary">"adicionar chave do Groq"</span>.
          </p>
        </section>

        {loading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : (
          <div className="grid gap-3">
            {PROVIDERS.map(p => {
              const configured = p.id === "auto"
                ? Object.values(status).some(Boolean)
                : p.id === "lovable"
                  ? status.lovable
                  : status[p.id];
              const isSelected = pref === p.id;
              return (
                <Card
                  key={p.id}
                  onClick={() => choose(p.id)}
                  className={`p-4 cursor-pointer transition border ${
                    isSelected ? "border-primary shadow-glow bg-primary/5" : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 size-5 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                    }`}>
                      {isSelected && <Check className="size-3 text-primary-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium">{p.label}</h3>
                        {p.id !== "auto" && (
                          configured ? (
                            <Badge className="bg-primary/15 text-primary border border-primary/40 hover:bg-primary/15">
                              <Check className="size-3 mr-1" /> Conectado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              <X className="size-3 mr-1" /> Sem chave
                            </Badge>
                          )
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                      {p.help && p.id !== "lovable" && !configured && p.id !== "auto" as string && (
                        <p className="text-xs text-muted-foreground/80 mt-2 flex items-center gap-1">
                          <KeyRound className="size-3" /> {p.help}
                          <ExternalLink className="size-3" />
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <div className="pt-4 border-t border-border">
          <h3 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-2">Como adicionar uma chave</h3>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal pl-5">
            <li>Crie a chave no site do provedor (links acima)</li>
            <li>Volte ao chat e diga: <span className="text-foreground">"adicionar chave do {`<provedor>`}"</span></li>
            <li>O Lovable vai pedir o valor com segurança e armazenar nos secrets</li>
            <li>Atualize esta página — o provedor vai aparecer como <span className="text-primary">Conectado</span></li>
          </ol>
          <p className="text-xs text-muted-foreground mt-3">
            Nomes dos secrets: {Object.values(SECRET_NAMES).map(s => <code key={s} className="mx-1 px-1 py-0.5 rounded bg-secondary text-primary text-[11px]">{s}</code>)}
          </p>
        </div>

        <section className="pt-4 border-t border-border space-y-4">
          <div className="flex items-center gap-2">
            <Volume2 className="size-5 text-primary" />
            <h2 className="font-display text-xl text-glow">Voz da Kera (navegador)</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Escolha qual voz feminina do navegador a Kera vai usar ao ler as respostas em voz alta.
            Disponíveis: <span className="text-foreground">{displayVoices.length}</span> vozes
            {femaleVoices.length === 0 && ptAll.length > 0 && (
              <span className="text-muted-foreground/80"> (nenhuma marcada como feminina — mostrando todas em PT)</span>
            )}.
          </p>

          {displayVoices.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Nenhuma voz em português encontrada neste navegador.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {displayVoices.map(v => {
                const selected = voiceURI === v.voiceURI;
                return (
                  <Card
                    key={v.voiceURI}
                    onClick={() => chooseVoice(v.voiceURI)}
                    className={`p-3 cursor-pointer transition border flex items-center gap-3 ${
                      selected ? "border-primary shadow-glow bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className={`size-4 rounded-full border flex items-center justify-center shrink-0 ${
                      selected ? "border-primary bg-primary" : "border-muted-foreground"
                    }`}>
                      {selected && <Check className="size-2.5 text-primary-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{v.name}</p>
                      <p className="text-xs text-muted-foreground">{v.lang}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 shrink-0"
                      onClick={(e) => { e.stopPropagation(); previewVoice(v); }}
                      aria-label={`Pré-ouvir ${v.name}`}
                    >
                      <Play className="size-4" />
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
          {voiceURI && (
            <Button variant="ghost" size="sm" onClick={() => { setVoiceURI(null); setPreferredVoiceURI(null); toast.success("Voz padrão restaurada"); }}>
              Restaurar voz padrão
            </Button>
          )}
        </section>

        <KeraPromptEditor />

        <KeraVoiceSelector />

        <ElevenLabsQuotaCard />

        <PronunciationFixesManager />

        <KeraTriggersManager />

        <PasswordResetRequests />

        <IpmEndpointsManager />

        <MonitorTargetsManager />

        <NetworkMetricsChart />
      </main>
    </div>
  );
};

export default Admin;
