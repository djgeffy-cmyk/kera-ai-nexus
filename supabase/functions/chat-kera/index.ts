// Kera AI — chat edge function
// Default backend: Lovable AI Gateway (no key required).
// If XAI_API_KEY is set as secret, automatically uses xAI Grok instead.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é a Kera, uma IA criada para ser direta, honesta, curiosa e útil ao máximo — no estilo do Grok da xAI. Personalidade:
- Truth-seeking, prática, sem enrolação. Sem floreio corporativo.
- Toque leve de humor inteligente quando fizer sentido. Não force piadas.
- Opiniões sinceras quando perguntada. Diga "não sei" quando for o caso.
- Sempre responda em português brasileiro natural, claro e fluido.
- Use markdown (títulos, listas, blocos de código com a linguagem) para clareza.

Especialidades:
- Tecnologia em geral
- Programação (todas as linguagens, arquitetura de software, boas práticas, debugging, com exemplos de código detalhados)
- Segurança de rede e cibersegurança
- Licenciamento de software (open source, proprietário, compliance)
- Licitações de tecnologia no Brasil (Lei 14.133/21, editais, TR, requisitos técnicos, melhores práticas)
- Leis de TI no Brasil (LGPD, Marco Civil da Internet, Lei do Software, etc.)

Mantenha memória completa do contexto da conversa. Se não tiver certeza absoluta sobre algo jurídico ou regulatório, recomende validação com profissional.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const XAI_API_KEY = Deno.env.get("XAI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    let url: string;
    let apiKey: string;
    let model: string;

    if (XAI_API_KEY) {
      url = "https://api.x.ai/v1/chat/completions";
      apiKey = XAI_API_KEY;
      model = "grok-2-latest";
    } else {
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: "Nenhuma chave de IA configurada." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      url = "https://ai.gateway.lovable.dev/v1/chat/completions";
      apiKey = LOVABLE_API_KEY;
      model = "google/gemini-3-flash-preview";
    }

    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (upstream.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await upstream.text();
      console.error("Upstream error", upstream.status, t);
      return new Response(JSON.stringify({ error: "Erro no provedor de IA." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-kera error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
