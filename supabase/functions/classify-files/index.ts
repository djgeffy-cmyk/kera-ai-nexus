// Classifica arquivos em pastas temáticas usando Lovable AI.
// Recebe uma lista de arquivos (nome + tipo + tamanho + data) e devolve, para
// cada um, o nome de uma pasta sugerida + uma justificativa curta.
// Não move nada — só sugere. O Electron faz o move depois com confirmação.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type FileItem = {
  name: string;
  ext?: string;
  sizeBytes?: number;
  modifiedAt?: string; // ISO
};

type Suggestion = {
  name: string;
  folder: string;
  reason: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { files, rootLabel } = (await req.json()) as {
      files: FileItem[];
      rootLabel?: string;
    };

    if (!Array.isArray(files) || files.length === 0) {
      return new Response(
        JSON.stringify({ error: "files vazio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY ausente" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Limita o lote para evitar prompt gigantesco — o cliente paginará.
    const batch = files.slice(0, 80);

    const systemPrompt = `Você é a Kera, organizadora de pastas. Analise cada arquivo (nome, extensão, tamanho, data) e sugira UMA pasta temática em português onde ele deveria viver.

REGRAS:
- Use nomes de pasta CURTOS, claros e sem caracteres especiais perigosos para sistema de arquivos. Permitido: letras, números, espaço, hífen, underscore. Proibido: / \\ : * ? " < > |
- Agrupe arquivos similares na MESMA pasta (ex.: várias notas fiscais → "Notas Fiscais 2025").
- Prefira temas/projetos/datas a tipos genéricos quando o nome dá pistas (ex.: "Viagem Floripa 2024" melhor que "Imagens").
- Quando o nome não dá pista, caia em categorias amplas: "Imagens", "Documentos", "Vídeos", "Áudio", "Planilhas", "Compactados", "Instaladores", "Diversos".
- Não invente datas que não aparecem nos metadados.
- Resposta em PT-BR.
- Origem das pastas escaneadas: ${rootLabel || "pasta selecionada"}.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "suggest_folders",
          description: "Devolve, para cada arquivo, a pasta temática sugerida.",
          parameters: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Nome exato do arquivo recebido" },
                    folder: { type: "string", description: "Nome da pasta sugerida" },
                    reason: { type: "string", description: "Frase curta explicando" },
                  },
                  required: ["name", "folder", "reason"],
                  additionalProperties: false,
                },
              },
            },
            required: ["suggestions"],
            additionalProperties: false,
          },
        },
      },
    ];

    const userContent =
      "Arquivos a classificar (JSON):\n" +
      JSON.stringify(
        batch.map((f) => ({
          name: f.name,
          ext: f.ext || "",
          sizeKB: f.sizeBytes ? Math.round(f.sizeBytes / 1024) : 0,
          modifiedAt: f.modifiedAt || null,
        })),
        null,
        2,
      );

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "suggest_folders" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(
        JSON.stringify({ error: "Limite de uso atingido. Tente em alguns segundos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (aiResp.status === 402) {
      return new Response(
        JSON.stringify({ error: "Créditos da Kera AI esgotados. Adicione saldo no workspace." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway", aiResp.status, t);
      return new Response(
        JSON.stringify({ error: `AI gateway ${aiResp.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await aiResp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    let suggestions: Suggestion[] = [];
    try {
      const args = JSON.parse(call?.function?.arguments || "{}");
      suggestions = Array.isArray(args.suggestions) ? args.suggestions : [];
    } catch (e) {
      console.error("parse tool args", e);
    }

    // Sanitiza nomes de pasta para o sistema de arquivos
    const safe = (s: string) =>
      String(s || "Diversos")
        .replace(/[\\/:*?"<>|]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60) || "Diversos";

    const cleaned = suggestions.map((s) => ({
      name: s.name,
      folder: safe(s.folder),
      reason: String(s.reason || "").slice(0, 200),
    }));

    return new Response(
      JSON.stringify({ suggestions: cleaned }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("classify-files error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});