import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_URL = "https://guaramirim.atende.net";
// REST API endpoint (NT 167/2021)
const REST_API_URL = `${BASE_URL}/api/wpt/processo-digital`;

/**
 * Retorna o header de Basic Auth usando ATENDENET_LOGIN + ATENDENET_PASSWORD
 */
function getBasicAuth(): string {
  const login = Deno.env.get("ATENDENET_LOGIN");
  const password = Deno.env.get("ATENDENET_PASSWORD");
  if (!login || !password) throw new Error("ATENDENET_LOGIN e ATENDENET_PASSWORD não configurados");
  return `Basic ${btoa(`${login}:${password}`)}`;
}

/**
 * Consulta processos digitais via API REST (NT 167/2021 - WPTProcessoDigitalRest)
 * Método POST com form-data, Basic Auth
 */
async function buscarProcessos(filtros: Record<string, string> = {}): Promise<{
  success: boolean;
  data: any;
  error?: string;
  status?: number;
}> {
  const authHeader = getBasicAuth();

  // Montar form-data com os filtros
  const formData = new FormData();

  // Parâmetros aceitos pela API (NT 167):
  // codigo, numero, ano, assuntoCodigo, subassuntoCodigo,
  // dataAberturaDe, dataAberturaAte, dataUltimaMovimentacaoDe, dataUltimaMovimentacaoAte
  const allowedParams = [
    "codigo", "numero", "ano", "assuntoCodigo", "subassuntoCodigo",
    "dataAberturaDe", "dataAberturaAte",
    "dataUltimaMovimentacaoDe", "dataUltimaMovimentacaoAte",
  ];

  for (const key of allowedParams) {
    if (filtros[key]) {
      formData.append(key, String(filtros[key]));
    }
  }

  // A API WPT exige UMA das seguintes combinações:
  //  - `codigo` (identificador único)
  //  - `numero` + `ano` (sempre juntos — erros 000363/000412)
  // Filtros de data sozinhos OU `ano` sozinho NÃO são aceitos pela API.
  const hasCodigo = !!filtros.codigo;
  const hasNumero = !!filtros.numero;
  const hasAno = !!filtros.ano;

  if (!hasCodigo && !(hasNumero && hasAno)) {
    return {
      success: false,
      data: { dados: [] },
      error:
        "A API WPT exige `codigo` OU `numero` + `ano` juntos. " +
        "Filtros de data ou ano sozinhos não são suportados pela API Atende.net.",
      status: 200,
    };
  }

  // Remove `ano` se `numero` não foi enviado (evita erro 000363)
  if (!hasNumero && !hasCodigo) {
    formData.delete("ano");
  }

  console.log(`[REST] POST ${REST_API_URL} com filtros:`, JSON.stringify(filtros));

  // Retry rápido — em modo varredura precisamos de muitas chamadas paralelas,
  // então cada uma precisa ser curta. 1 tentativa de 6s.
  const maxAttempts = filtros.__fast ? 1 : 2;
  const perAttemptTimeout = filtros.__fast ? 6000 : 12000;
  let lastError: unknown = null;
  let resp: Response | null = null;
  let rawText = "";
  let contentType = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), perAttemptTimeout);

    try {
      resp = await fetch(REST_API_URL, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Accept": "application/json",
          "Connection": "close",
        },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      contentType = resp.headers.get("content-type") || "";
      rawText = await resp.text();
      console.log(`[REST] Tentativa ${attempt} OK - Status: ${resp.status}, Body (300 chars): ${rawText.substring(0, 300)}`);
      break;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[REST] Tentativa ${attempt}/${maxAttempts} falhou: ${msg}`);
      if (attempt < maxAttempts) {
        // Backoff: 500ms, 1500ms
        await new Promise((r) => setTimeout(r, 500 * attempt * attempt));
      }
    }
  }

  if (!resp) {
    const msg = lastError instanceof Error ? lastError.message : String(lastError);
    return { success: false, data: null, error: `Timeout/erro de conexão após ${maxAttempts} tentativas: ${msg}`, status: 504 };
  }

  if (!resp.ok) {
    return { success: false, data: null, error: `HTTP ${resp.status}: ${rawText.substring(0, 300)}`, status: resp.status };
  }

  try {
    const json = JSON.parse(rawText);
    return { success: true, data: json, status: resp.status };
  } catch {
    return { success: false, data: rawText, error: "Resposta não é JSON válido", status: resp.status };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action, ...filtros } = body as Record<string, any>;

    console.log(`[atendenet-processos] action=${action}, filtros=${JSON.stringify(filtros)}`);

    // Test connection
    if (action === "test-connection") {
      try {
        const auth = getBasicAuth();
        // Testar com um processo conhecido (numero+ano obrigatórios)
        const formData = new FormData();
        formData.append("numero", "1");
        formData.append("ano", String(new Date().getFullYear()));

        const resp = await fetch(REST_API_URL, {
          method: "POST",
          headers: { "Authorization": auth, "Accept": "application/json" },
          body: formData,
        });

        const text = await resp.text();
        let jsonData: any = null;
        try { jsonData = JSON.parse(text); } catch {}

        return new Response(JSON.stringify({
          success: resp.ok,
          status: resp.status,
          endpoint: REST_API_URL,
          method: "POST form-data + Basic Auth",
          hasData: !!jsonData,
          sampleKeys: jsonData ? Object.keys(jsonData).slice(0, 10) : [],
          preview: text.substring(0, 500),
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({
          success: false,
          error: e.message,
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Busca de processos
    if (action === "buscar" || action === "listar" || !action) {
      const result = await buscarProcessos(filtros);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : (result.status || 500),
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Varredura: busca em paralelo uma faixa [numeroDe..numeroAte] de um ano
    // Workaround para a API WPT que NÃO suporta listagem por período.
    if (action === "varrer") {
      const ano = String(filtros.ano || new Date().getFullYear());
      const numeroDe = Math.max(1, parseInt(String(filtros.numeroDe || "1"), 10));
      const numeroAte = Math.max(numeroDe, parseInt(String(filtros.numeroAte || "150"), 10));
      const concorrencia = Math.min(30, Math.max(1, parseInt(String(filtros.concorrencia || "20"), 10)));

      const numeros: number[] = [];
      for (let n = numeroAte; n >= numeroDe; n--) numeros.push(n); // Mais recentes primeiro

      const dados: any[] = [];
      let consecutiveNotFound = 0;
      const MAX_CONSECUTIVE_NOT_FOUND = 25;
      const startedAt = Date.now();
      const HARD_DEADLINE_MS = 22000; // Sai antes do timeout do Supabase (~25s)

      for (let i = 0; i < numeros.length; i += concorrencia) {
        if (Date.now() - startedAt > HARD_DEADLINE_MS) {
          console.log(`[varrer] Deadline atingido após ${dados.length} encontrados`);
          break;
        }
        const chunk = numeros.slice(i, i + concorrencia);
        const results = await Promise.all(
          chunk.map(async (numero) => {
            try {
              const r = await buscarProcessos({ numero: String(numero), ano, __fast: true } as any);
              if (r.success && r.data?.dados?.length > 0) return r.data.dados;
              return null;
            } catch {
              return null;
            }
          })
        );

        let chunkFound = 0;
        for (const arr of results) {
          if (arr && arr.length > 0) {
            dados.push(...arr);
            chunkFound++;
          }
        }

        if (chunkFound === 0) {
          consecutiveNotFound += chunk.length;
          if (consecutiveNotFound >= MAX_CONSECUTIVE_NOT_FOUND) break;
        } else {
          consecutiveNotFound = 0;
        }
      }

      return new Response(JSON.stringify({
        success: true,
        data: { dados },
        meta: { ano, numeroDe, numeroAte, total: dados.length, elapsedMs: Date.now() - startedAt },
        status: 200,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      error: `Ação desconhecida: ${action}`,
      availableActions: ["test-connection", "buscar", "listar"],
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[atendenet-processos] Erro:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
