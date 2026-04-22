// licitacoes-cron — roda 6/6h, raspa licitações via ipm-query, detecta novas e cria alertas
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function makeHash(it: Record<string, unknown>): string {
  // Hash estável: numero + objeto (primeiros 80) + data_encerramento
  const numero = String(it.numero ?? "").trim().toLowerCase();
  const obj = String(it.objeto ?? "").trim().toLowerCase().slice(0, 80);
  const enc = String(it.data_encerramento ?? "").trim();
  return `${numero}|${obj}|${enc}`;
}

function isOpen(status?: unknown): boolean {
  const s = String(status ?? "").toLowerCase();
  return s.includes("abert") || s.includes("andament") || s.includes("ativ") || s.includes("public");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = new Date().toISOString();
  console.log(`[licitacoes-cron] início ${startedAt}`);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // 1) Chama ipm-query pra buscar licitações
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ipm-query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: "licitacoes", filtro_status: "abert" }),
    });
    const data = await r.json();

    if (!r.ok || data.success === false) {
      throw new Error(`ipm-query falhou: ${data.error ?? r.status}`);
    }

    // ipm-query retorna { results: [{ items, url, ... }] }
    const allItems: Array<{ item: Record<string, unknown>; url: string }> = [];
    for (const res of (data.results ?? [])) {
      const url = String(res.url ?? res.base_url ?? "");
      for (const it of (res.items ?? [])) {
        if (it && typeof it === "object") allItems.push({ item: it as Record<string, unknown>, url });
      }
    }

    console.log(`[licitacoes-cron] ${allItems.length} licitações brutas`);

    let novasCount = 0;
    let atualizadasCount = 0;
    const novasAlertas: Array<Record<string, unknown>> = [];

    for (const { item, url } of allItems) {
      const hash = makeHash(item);
      if (!hash || hash === "||") continue;

      const open = isOpen(item.status);

      // upsert por hash
      const { data: existing } = await supabase
        .from("licitacoes_snapshot")
        .select("id, first_seen_at")
        .eq("hash", hash)
        .maybeSingle();

      const payload = {
        hash,
        numero: String(item.numero ?? "") || null,
        modalidade: String(item.modalidade ?? "") || null,
        objeto: String(item.objeto ?? "") || null,
        status: String(item.status ?? "") || null,
        data_abertura: String(item.data_abertura ?? "") || null,
        data_encerramento: String(item.data_encerramento ?? "") || null,
        valor: String(item.valor ?? "") || null,
        vencedor: String(item.vencedor ?? "") || null,
        link: String(item.link ?? "") || null,
        raw: item,
        source_url: url,
        last_seen_at: new Date().toISOString(),
        is_open: open,
      };

      if (existing) {
        await supabase.from("licitacoes_snapshot").update(payload).eq("id", existing.id);
        atualizadasCount++;
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from("licitacoes_snapshot")
          .insert({ ...payload, first_seen_at: new Date().toISOString() })
          .select("id")
          .single();

        if (insErr) {
          console.warn("[licitacoes-cron] insert snapshot erro:", insErr.message);
          continue;
        }

        novasCount++;

        // Cria alerta apenas para licitações ABERTAS novas
        if (open && inserted) {
          const alertPayload = {
            snapshot_id: inserted.id,
            numero: payload.numero,
            modalidade: payload.modalidade,
            objeto: payload.objeto,
            status: payload.status,
            data_encerramento: payload.data_encerramento,
            valor: payload.valor,
            link: payload.link,
          };
          await supabase.from("licitacoes_alerts").insert(alertPayload);
          novasAlertas.push(alertPayload);
        }
      }
    }

    const summary = {
      success: true,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      total_extraido: allItems.length,
      novas: novasCount,
      atualizadas: atualizadasCount,
      novos_alertas: novasAlertas.length,
    };
    console.log(`[licitacoes-cron] ${JSON.stringify(summary)}`);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[licitacoes-cron] erro:", e);
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : "erro desconhecido",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
