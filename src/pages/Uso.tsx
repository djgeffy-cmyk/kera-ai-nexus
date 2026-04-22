import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
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

        <p className="text-xs text-muted-foreground text-center">
          Em breve: consumo de mensagens, voz e análise de código.
        </p>
      </div>
    </div>
  );
}