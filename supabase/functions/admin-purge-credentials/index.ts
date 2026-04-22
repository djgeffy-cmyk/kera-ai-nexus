// Varre messages, mascara conteúdo com padrões de credencial.
// SOMENTE admin. Modo dry-run por padrão.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PATTERNS: { type: string; rx: RegExp }[] = [
  { type: "cnpj_pwd", rx: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\s*[:|\s]\s*\S{4,}/g },
  { type: "cpf_pwd", rx: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\s*[:|]\s*\S{4,}/g },
  { type: "kv_pwd", rx: /\b(?:senha|password|passwd|pwd|pass|secret|token|api[_-]?key)\s*[:=]\s*['"]?[^\s'"<>]{4,}/gi },
  { type: "user_pwd", rx: /\b[A-Za-z0-9._-]{3,}@?[A-Za-z0-9.-]*\s*:\s*[^\s:]{6,32}(?=[#$@!%&*])/g },
  { type: "bearer", rx: /\bBearer\s+[A-Za-z0-9._\-]{20,}/gi },
  { type: "api_key", rx: /\b(?:sk|pk|rk)[-_](?:live|test)?[-_]?[A-Za-z0-9]{20,}/g },
];

function redact(text: string): { redacted: string; hits: string[] } {
  let out = text;
  const hits: string[] = [];
  for (const { type, rx } of PATTERNS) {
    if (rx.test(out)) hits.push(type);
    out = out.replace(rx, "[REDACTED-CREDENTIAL]");
  }
  return { redacted: out, hits };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleData } = await adminClient
      .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const apply = body.apply === true;
    const limit = Math.min(Number(body.limit ?? 200), 500);
    const before: string | null = body.before ?? null;

    let q = adminClient
      .from("messages")
      .select("id, content, created_at")
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (before) q = q.lt("created_at", before);
    const { data: rows, error } = await q;
    if (error) throw error;

    const dirty: { id: string; hits: string[]; preview: string; redacted: string }[] = [];
    for (const row of rows ?? []) {
      const text = String(row.content ?? "");
      if (!text) continue;
      const { redacted, hits } = redact(text);
      if (hits.length > 0) {
        dirty.push({ id: row.id, hits, preview: text.slice(0, 60), redacted });
      }
    }

    let updated = 0;
    if (apply && dirty.length > 0) {
      for (const d of dirty) {
        const { error: updErr } = await adminClient.from("messages").update({ content: d.redacted }).eq("id", d.id);
        if (!updErr) updated++;
      }
    }

    return new Response(JSON.stringify({
      ok: true, scanned: rows?.length ?? 0, found: dirty.length, updated,
      sample: dirty.slice(0, 10).map((d) => ({ id: d.id, hits: d.hits, preview: d.preview })),
      apply,
      next_before: rows && rows.length === limit ? rows[rows.length - 1].created_at : null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
