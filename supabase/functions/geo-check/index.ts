import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // IP do cliente — Supabase passa via cf-connecting-ip / x-forwarded-for
  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "";

  // País via header do edge runtime, com fallback pra lookup externo
  let country = req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || "";

  if (!country && ip) {
    try {
      const r = await fetch(`https://ipapi.co/${ip}/country/`, {
        headers: { "User-Agent": "kera-geo-check" },
        signal: AbortSignal.timeout(3000),
      });
      if (r.ok) country = (await r.text()).trim().toUpperCase();
    } catch {}
  }

  country = (country || "").toUpperCase();
  const allowed = country === "BR" || country === ""; // se não conseguir detectar, libera (fail-open p/ não travar usuário legítimo)

  return new Response(
    JSON.stringify({ allowed, country: country || "UNKNOWN", ip: ip ? ip.replace(/\.\d+$/, ".x") : null }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
  );
});