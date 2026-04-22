// Kera AI — geração de imagem via Lovable AI Gateway (Gemini Image)
// Com cota diária por plano pra proteger o saldo da Lovable AI.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

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

    // 🔒 Cota diária por plano — protege saldo da Lovable AI
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u, error: uErr } = await supaUser.auth.getUser();
    if (uErr || !u?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supaAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE);
    const { data: quota, error: qErr } = await supaAdmin
      .rpc("consume_image_quota", { _user_id: u.user.id });
    if (qErr) {
      console.error("[generate-image] erro consume_image_quota:", qErr);
      return new Response(JSON.stringify({ error: "Falha ao validar cota." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const q = quota as { allowed: boolean; used: number; limit: number; plan: string };
    if (!q.allowed) {
      return new Response(
        JSON.stringify({
          error: "image_quota_exceeded",
          message: q.plan === "free"
            ? "Geração de imagem não está incluída no seu plano. Faça upgrade pra liberar."
            : `Você atingiu o limite diário de imagens do plano ${q.plan} (${q.limit}/dia). Volte amanhã ou faça upgrade.`,
          plan: q.plan,
          used: q.used,
          limit: q.limit,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
      return new Response(
        JSON.stringify({
          error: "O modelo respondeu com texto em vez de imagem. Tente descrever visualmente o que quer ver.",
          modelReply: textReply,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ imageUrl, quota: { used: q.used, limit: q.limit, plan: q.plan } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
