// check-demo-quota — controla as 3 perguntas grátis do demo da Kera por IP.
// Bloqueio definitivo (não reseta). Combinado com localStorage no client.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const DEMO_LIMIT = 3;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function extractIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const first = fwd.split(",")[0]?.trim();
  if (first) return first;
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const ip = extractIp(req);
    // Salt fixo + IP. O salt evita correlação cross-projeto se o hash vazar.
    const ipHash = await sha256Hex(`kera-demo:${ip}`);

    let body: { action?: "check" | "consume" } = {};
    try { body = await req.json(); } catch { /* ok */ }
    const action = body.action === "consume" ? "consume" : "check";

    // Lê estado atual
    const { data: existing } = await supabase
      .from("demo_usage")
      .select("count")
      .eq("ip_hash", ipHash)
      .maybeSingle();

    const used = existing?.count ?? 0;
    const remaining = Math.max(0, DEMO_LIMIT - used);

    if (action === "check") {
      return json(200, { used, remaining, limit: DEMO_LIMIT, blocked: remaining === 0 });
    }

    // action === "consume"
    if (used >= DEMO_LIMIT) {
      return json(429, {
        used,
        remaining: 0,
        limit: DEMO_LIMIT,
        blocked: true,
        error: "demo_limit_reached",
      });
    }

    const newCount = used + 1;
    const { error: upsertErr } = await supabase
      .from("demo_usage")
      .upsert(
        {
          ip_hash: ipHash,
          count: newCount,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "ip_hash" },
      );

    if (upsertErr) {
      console.error("[check-demo-quota] upsert failed", upsertErr);
      return json(500, { error: "internal" });
    }

    return json(200, {
      used: newCount,
      remaining: DEMO_LIMIT - newCount,
      limit: DEMO_LIMIT,
      blocked: newCount >= DEMO_LIMIT,
    });
  } catch (e) {
    console.error("[check-demo-quota] error", e);
    return json(500, { error: "internal" });
  }
});