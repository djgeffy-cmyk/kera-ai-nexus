// Scraping do portal da transparência de Guaramirim via Firecrawl
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

const PRESETS: Record<string, { url: string; prompt: string; label: string }> = {
  licitacoes: {
    label: "Licitações em andamento",
    url: "https://guaramirim.atende.net/transparencia/item/licitacoes",
    prompt:
      "Extraia TODAS as licitações listadas. Para cada uma: numero/edital, modalidade (pregão, concorrência, dispensa, etc), objeto/descrição, status (aberta, em andamento, homologada, deserta), data de abertura, data de encerramento, valor estimado se houver, e link/URL do detalhamento. Marque como 'aberta' qualquer licitação cujo status indique que ainda recebe propostas.",
  },
  protocolos: {
    label: "Protocolos / Atendimentos",
    url: "https://guaramirim.atende.net/transparencia/item/protocolos",
    prompt:
      "Extraia todos os protocolos listados: número, assunto, secretaria/departamento, data de abertura, status (aberto, em andamento, concluído), tempo em aberto, requerente se público.",
  },
  contratos: {
    label: "Contratos vigentes",
    url: "https://guaramirim.atende.net/transparencia/item/contratos",
    prompt:
      "Extraia contratos vigentes: número, objeto, contratada (vencedor da licitação), valor, data assinatura, vigência, situação.",
  },
};

interface ExtractedItem {
  [key: string]: unknown;
}

async function scrapeWithJson(url: string, prompt: string) {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY não configurada");

  const schema = {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            numero: { type: "string" },
            modalidade: { type: "string" },
            objeto: { type: "string" },
            status: { type: "string" },
            data_abertura: { type: "string" },
            data_encerramento: { type: "string" },
            valor: { type: "string" },
            secretaria: { type: "string" },
            tempo_aberto: { type: "string" },
            vencedor: { type: "string" },
            link: { type: "string" },
          },
        },
      },
      total_encontrado: { type: "number" },
      observacoes: { type: "string" },
    },
    required: ["items"],
  };

  const resp = await fetch(`${FIRECRAWL_V2}/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: [
        "markdown",
        { type: "json", schema, prompt },
      ],
      onlyMainContent: true,
      waitFor: 2500,
      location: { country: "BR", languages: ["pt-BR"] },
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Firecrawl ${resp.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const tipo: string = body.tipo || "licitacoes";
    const customUrl: string | undefined = body.url;
    const customPrompt: string | undefined = body.prompt;

    let url: string;
    let prompt: string;
    let label: string;

    if (customUrl) {
      url = customUrl;
      prompt = customPrompt ||
        "Extraia todos os dados estruturados relevantes da página em formato de lista de itens.";
      label = "Customizado";
    } else {
      const preset = PRESETS[tipo];
      if (!preset) {
        return new Response(
          JSON.stringify({ error: `Tipo desconhecido: ${tipo}. Use: ${Object.keys(PRESETS).join(", ")}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      url = preset.url;
      prompt = preset.prompt;
      label = preset.label;
    }

    console.log(`[transparencia-scrape] ${label} → ${url}`);
    const result = await scrapeWithJson(url, prompt);

    // Firecrawl v2 retorna data.json e data.markdown
    const payload = result?.data ?? result;
    const json = (payload?.json ?? {}) as { items?: ExtractedItem[]; total_encontrado?: number; observacoes?: string };
    const markdown = payload?.markdown ?? "";

    return new Response(
      JSON.stringify({
        success: true,
        tipo,
        label,
        url,
        scraped_at: new Date().toISOString(),
        items: json.items ?? [],
        total: json.total_encontrado ?? json.items?.length ?? 0,
        observacoes: json.observacoes ?? null,
        markdown_preview: markdown.slice(0, 2000),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[transparencia-scrape] erro:", err);
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
