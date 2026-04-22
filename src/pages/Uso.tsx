import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, Mic, Code2, Shield, ExternalLink, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ImageQuotaCard } from "@/components/ImageQuotaCard";

export default function Uso() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Meu consumo</h1>
            <p className="text-sm text-muted-foreground">Acompanhe quanto você já usou hoje no seu plano.</p>
          </div>
        </div>

        <ImageQuotaCard />

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold text-lg">Tabela de planos</h2>
            <Button size="sm" variant="outline" onClick={() => navigate("/planos")}>
              Ver detalhes <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-border">
                  <th className="px-2 py-2 font-medium">Plano</th>
                  <th className="px-2 py-2 font-medium">Preço/mês</th>
                  <th className="px-2 py-2 font-medium">Imagens/dia</th>
                  <th className="px-2 py-2 font-medium">Destaque</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-2 py-2 font-semibold">Free</td>
                  <td className="px-2 py-2">R$ 0</td>
                  <td className="px-2 py-2 text-muted-foreground">—</td>
                  <td className="px-2 py-2 text-muted-foreground">Demo Kera</td>
                </tr>
                <tr>
                  <td className="px-2 py-2 font-semibold">Essencial</td>
                  <td className="px-2 py-2">R$ 29,90</td>
                  <td className="px-2 py-2">1</td>
                  <td className="px-2 py-2 text-muted-foreground">3 agentes à escolha</td>
                </tr>
                <tr className="bg-primary/5">
                  <td className="px-2 py-2 font-semibold inline-flex items-center gap-1">
                    Pro <Check className="h-3 w-3 text-primary" />
                  </td>
                  <td className="px-2 py-2">R$ 79,90</td>
                  <td className="px-2 py-2">3</td>
                  <td className="px-2 py-2 text-muted-foreground">Todos os especialistas + voz</td>
                </tr>
                <tr>
                  <td className="px-2 py-2 font-semibold">Master</td>
                  <td className="px-2 py-2">R$ 149,90</td>
                  <td className="px-2 py-2">10</td>
                  <td className="px-2 py-2 text-muted-foreground">NASA + Sentinela ilimitados</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6 space-y-3">
          <h2 className="font-semibold text-lg">O foco da Kera não é gerar imagens</h2>
          <p className="text-sm text-muted-foreground">
            A Kera é uma <strong className="text-foreground">copiloto inteligente</strong> —
            ela faz imagens e vídeos muito bem, mas isso é um bônus. O coração dela está em:
          </p>
          <ul className="grid sm:grid-cols-2 gap-3 text-sm">
            <li className="flex gap-2"><MessageSquare className="h-4 w-4 text-primary mt-0.5" /> Chat ilimitado com agentes especialistas</li>
            <li className="flex gap-2"><Mic className="h-4 w-4 text-primary mt-0.5" /> Modo voz natural (TTS premium)</li>
            <li className="flex gap-2"><Code2 className="h-4 w-4 text-primary mt-0.5" /> Análise e correção de código</li>
            <li className="flex gap-2"><Shield className="h-4 w-4 text-primary mt-0.5" /> Segurança, NASA e Sentinela 24/7</li>
          </ul>
          <p className="text-xs text-muted-foreground pt-2 border-t border-border">
            Por isso a cota de imagem é diária e enxuta — manter os planos acessíveis pra todo mundo.
            Se precisar de muito volume de imagem, fale com a gente para um plano sob medida.
          </p>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Em breve: consumo de mensagens, voz e análise de código.
        </p>
      </div>
    </div>
  );
}