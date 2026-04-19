// Kera AI — geração de imagem via Lovable AI Gateway (Gemini Image)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reforça que queremos uma IMAGEM — Gemini às vezes responde só texto se o prompt
    // for ambíguo. Prefixo garante intenção visual.
    const imagePrompt =
      `Generate a single high-quality image based on this description. ` +
      `Output ONLY the image, no text. Description: ${prompt}`;

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: imagePrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error("[generate-image] erro:", upstream.status, errText);
      if (upstream.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de imagens atingido. Aguarde alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (upstream.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `Erro do gerador (${upstream.status})` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await upstream.json();
    const imageUrl: string | undefined =
      data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      const textReply: string =
        data?.choices?.[0]?.message?.content?.toString?.()?.slice(0, 200) ?? "";
      console.error("[generate-image] sem imagem na resposta:", JSON.stringify(data).slice(0, 400));
      // 422 = entendido, mas não dava pra processar como imagem.
      return new Response(
        JSON.stringify({
          error: "O modelo respondeu com texto em vez de imagem. Tente descrever visualmente o que quer ver.",
          modelReply: textReply,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ imageUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
