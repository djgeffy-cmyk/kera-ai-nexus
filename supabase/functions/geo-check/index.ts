import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const ALLOWED_COUNTRIES = new Set(["BR"]);

// IPs privados / loopback / link-local — devem ser ignorados na detecção
function isPublicIp(ip: string): boolean {
  if (!ip) return false;
  if (ip === "::1" || ip === "127.0.0.1") return false;
  if (/^10\./.test(ip)) return false;
  if (/^192\.168\./.test(ip)) return false;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return false;
  if (/^169\.254\./.test(ip)) return false; // link-local
  if (/^fc00:/i.test(ip) || /^fd/i.test(ip)) return false; // IPv6 ULA
  if (/^fe80:/i.test(ip)) return false; // IPv6 link-local
  return true;
}

function pickClientIp(req: Request): string {
  // x-forwarded-for pode trazer múltiplos: "client, proxy1, proxy2" — pega o primeiro público
  const xff = req.headers.get("x-forwarded-for") || "";
  for (const raw of xff.split(",")) {
    const ip = raw.trim();
    if (isPublicIp(ip)) return ip;
  }
  const candidates = [
    req.headers.get("cf-connecting-ip"),
    req.headers.get("true-client-ip"),
    req.headers.get("x-real-ip"),
    req.headers.get("fly-client-ip"),
    req.headers.get("x-client-ip"),
  ];
  for (const c of candidates) {
    const ip = (c || "").trim();
    if (isPublicIp(ip)) return ip;
  }
  return "";
}

function pickHeaderCountry(req: Request): string {
  const candidates = [
    req.headers.get("cf-ipcountry"),
    req.headers.get("x-vercel-ip-country"),
    req.headers.get("x-country-code"),
    req.headers.get("fly-region"), // não é país, mas serve de hint (ex: gru)
  ];
  for (const c of candidates) {
    const v = (c || "").trim().toUpperCase();
    if (v && v.length === 2 && /^[A-Z]{2}$/.test(v) && v !== "XX" && v !== "T1") {
      return v;
    }
  }
  return "";
}

async function lookupCountry(ip: string): Promise<{ country: string; source: string }> {
  if (!ip) return { country: "", source: "none" };

  // Provedor 1: ipapi.co
  try {
    const r = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { "User-Agent": "kera-geo-check/1.0" },
      signal: AbortSignal.timeout(2500),
    });
    if (r.ok) {
      const j = await r.json().catch(() => null) as { country_code?: string; country?: string } | null;
      const c = (j?.country_code || j?.country || "").toUpperCase();
      if (/^[A-Z]{2}$/.test(c)) return { country: c, source: "ipapi.co" };
    } else {
      await r.text().catch(() => {});
    }
  } catch {}

  // Provedor 2: ipwho.is (fallback gratuito)
  try {
    const r = await fetch(`https://ipwho.is/${ip}?fields=country_code,success`, {
      headers: { "User-Agent": "kera-geo-check/1.0" },
      signal: AbortSignal.timeout(2500),
    });
    if (r.ok) {
      const j = await r.json().catch(() => null) as { country_code?: string; success?: boolean } | null;
      const c = (j?.country_code || "").toUpperCase();
      if (j?.success && /^[A-Z]{2}$/.test(c)) return { country: c, source: "ipwho.is" };
    } else {
      await r.text().catch(() => {});
    }
  } catch {}

  return { country: "", source: "lookup_failed" };
}

function maskIp(ip: string): string | null {
  if (!ip) return null;
  if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":") + "::x"; // IPv6
  return ip.replace(/\.\d+$/, ".x"); // IPv4
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const ip = pickClientIp(req);
  let country = pickHeaderCountry(req);
  let source = country ? "header" : "";

  if (!country && ip) {
    const looked = await lookupCountry(ip);
    country = looked.country;
    source = looked.source;
  }

  const detected = !!country;
  const allowed = detected ? ALLOWED_COUNTRIES.has(country) : true; // fail-open quando não dá pra detectar

  return new Response(
    JSON.stringify({
      allowed,
      detected,
      country: country || "UNKNOWN",
      source: source || "none",
      ip: maskIp(ip),
      reason: !detected ? "geo_unknown" : allowed ? "allowed" : "country_blocked",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
  );
});