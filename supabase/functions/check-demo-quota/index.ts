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

    // Fingerprint do navegador: user-agent + accept-language + (opcional) hash do client.
    // Funciona como segunda chave de bloqueio — se o usuário trocar de IP (Wi-Fi → 4G)
    // mas continuar no mesmo navegador, o limite continua valendo.
    const userAgent = req.headers.get("user-agent") ?? "";
    const acceptLang = req.headers.get("accept-language") ?? "";

    let body: { action?: "check" | "consume"; clientFingerprint?: string } = {};
    try { body = await req.json(); } catch { /* ok */ }
    const action = body.action === "consume" ? "consume" : "check";
    const clientFp = (body.clientFingerprint ?? "").slice(0, 256);
    const fpHash = await sha256Hex(
      `kera-demo-fp:${userAgent}|${acceptLang}|${clientFp}`,
    );

    // Lê estado de AMBAS as chaves (IP e fingerprint) e usa o MAIOR — assim,
    // bloquear por uma das vias é suficiente.
    const [{ data: byIp }, { data: byFp }] = await Promise.all([
      supabase.from("demo_usage").select("count").eq("ip_hash", ipHash).maybeSingle(),
      supabase.from("demo_usage").select("count").eq("ip_hash", fpHash).maybeSingle(),
    ]);

    const used = Math.max(byIp?.count ?? 0, byFp?.count ?? 0);
    const remaining = Math.max(0, DEMO_LIMIT - used);

    if (action === "check") {
      return json(200, { used, remaining, limit: DEMO_LIMIT, blocked: remaining === 0 });
    }

    // action === "consume"
    if (used >= DEMO_LIMIT) {
      // Registra tentativa de abuso (já estava bloqueado e tentou de novo)
      const { error: logErr } = await supabase
        .from("demo_abuse_log")
        .insert({
          ip_hash: ipHash,
          attempted_count: used,
          user_agent: userAgent || null,
        });
      if (logErr) {
        console.error("[check-demo-quota] failed to log abuse attempt", logErr);
      } else {
        console.log("[check-demo-quota] abuse attempt logged", {
          ip_hash_prefix: ipHash.slice(0, 8),
          fp_hash_prefix: fpHash.slice(0, 8),
          attempted_count: used,
        });
      }

      return json(429, {
        used,
        remaining: 0,
        limit: DEMO_LIMIT,
        blocked: true,
        error: "demo_limit_reached",
      });
    }

    const newCount = used + 1;
    const nowIso = new Date().toISOString();
    // Grava nas DUAS chaves — IP e fingerprint — sempre com o maior count atual.
    // Assim, qualquer tentativa futura por IP OU navegador detecta o bloqueio.
    const [{ error: ipErr }, { error: fpErr }] = await Promise.all([
      supabase.from("demo_usage").upsert(
        { ip_hash: ipHash, count: newCount, last_seen_at: nowIso },
        { onConflict: "ip_hash" },
      ),
      supabase.from("demo_usage").upsert(
        { ip_hash: fpHash, count: newCount, last_seen_at: nowIso },
        { onConflict: "ip_hash" },
      ),
    ]);

    if (ipErr || fpErr) {
      console.error("[check-demo-quota] upsert failed", ipErr || fpErr);
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