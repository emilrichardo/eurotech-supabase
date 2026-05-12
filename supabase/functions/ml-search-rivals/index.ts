const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-5-mini";
const RIVAL_SEARCH_STRICT_JSON = Deno.env.get("RIVAL_SEARCH_STRICT_JSON") === "true";
const RIVAL_SEARCH_RETRY_ON_PARSE_ERROR = Deno.env.get("RIVAL_SEARCH_RETRY_ON_PARSE_ERROR") === "true";
const RIVAL_SEARCH_TOOL_CHOICE = Deno.env.get("RIVAL_SEARCH_TOOL_CHOICE") ?? "required";
const RIVAL_SEARCH_SECRET = Deno.env.get("RIVAL_SEARCH_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SearchPayload = {
  productId?: string;
  sku?: string;
  title?: string;
  description?: string | null;
  categoryId?: string | null;
  domainId?: string | null;
  price?: number | null;
  currencyId?: string | null;
  existingCompetitorIds?: string[];
  existingCompetitorUrls?: string[];
  limit?: number;
};

type RivalCandidate = {
  title: string;
  url: string;
  item_id: string | null;
  seller_name: string | null;
  price: number | null;
  currency_id: string | null;
  thumbnail: string | null;
  confidence: number;
  reason: string;
  matched_terms: string[];
};

type RivalSearchResult = {
  query: string;
  summary: string;
  candidates: RivalCandidate[];
};

class OpenAIRequestError extends Error {}

const MIN_RIVAL_CONFIDENCE = 0.76;
const GENERIC_MATCH_TOKENS = new Set([
  "a",
  "al",
  "con",
  "de",
  "del",
  "el",
  "en",
  "eurotech",
  "juego",
  "kit",
  "la",
  "las",
  "libre",
  "los",
  "mercado",
  "ml",
  "mlu",
  "nuevo",
  "nueva",
  "o",
  "pack",
  "para",
  "por",
  "set",
  "sin",
  "un",
  "una",
  "uno",
  "uruguay",
  "x",
  "y",
]);

const resultSchema = {
  type: "object",
  additionalProperties: false,
  required: ["query", "summary", "candidates"],
  properties: {
    query: { type: "string" },
    summary: { type: "string" },
    candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "url",
          "item_id",
          "seller_name",
          "price",
          "currency_id",
          "thumbnail",
          "confidence",
          "reason",
          "matched_terms",
        ],
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          item_id: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
          seller_name: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
          price: {
            anyOf: [{ type: "number" }, { type: "null" }],
          },
          currency_id: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
          thumbnail: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
          confidence: { type: "number" },
          reason: { type: "string" },
          matched_terms: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
  },
};

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}

function isAuthorized(req: Request): boolean {
  if (!RIVAL_SEARCH_SECRET) return false;

  const authToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  const apiKey = req.headers.get("apikey")?.trim();
  const internalSecret = req.headers.get("x-rival-search-secret")?.trim();

  return [authToken, apiKey, internalSecret].some((value) => value === RIVAL_SEARCH_SECRET);
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function clampLimit(value: unknown): number {
  const parsed = asNumber(value) ?? 5;
  return Math.max(1, Math.min(6, Math.round(parsed)));
}

function extractMlId(value: string): string | null {
  const articleMatch = value.match(/ML[A-Z]+-?(\d+)/i);
  if (articleMatch) {
    const prefix = articleMatch[0].match(/^ML[A-Z]+/i)?.[0] ?? "MLU";
    return `${prefix}${articleMatch[1]}`.toUpperCase();
  }
  const directMatch = value.match(/ML[A-Z]+\d+/i);
  return directMatch?.[0].toUpperCase() ?? null;
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("www.")) return `https://${trimmed}`;
  return trimmed;
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[|()[\]{}.,;:_+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

function extractMeaningfulTokens(value: string): string[] {
  const tokens = normalizeSearchText(value).match(/[a-z0-9]+(?:\/[0-9]+)?/g) ?? [];
  return uniqueValues(tokens.filter((token) => {
    if (token.length <= 1) return false;
    if (GENERIC_MATCH_TOKENS.has(token)) return false;
    return true;
  }));
}

function extractSpecs(value: string): string[] {
  const normalized = normalizeSearchText(value);
  const specs = normalized.match(/\bm?\d+(?:[.,]\d+)?(?:\/\d+)?\b/g) ?? [];
  return uniqueValues(specs.map((spec) => spec.replace(",", ".")));
}

function getSharedValues(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

function isExactCompetitorCandidate(
  product: Required<Pick<SearchPayload, "title">> & SearchPayload,
  candidate: RivalCandidate,
): boolean {
  if (candidate.confidence < MIN_RIVAL_CONFIDENCE) return false;

  const productText = [product.title, product.description ?? ""].join(" ");
  const candidateText = [
    candidate.title,
    candidate.reason,
    candidate.matched_terms.join(" "),
  ].join(" ");

  const productTokens = extractMeaningfulTokens(productText);
  const candidateTokens = extractMeaningfulTokens(candidateText);
  const sharedTokens = getSharedValues(productTokens, candidateTokens);
  const productSpecs = extractSpecs(product.title);
  const candidateSpecs = extractSpecs(candidateText);
  const sharedSpecs = getSharedValues(productSpecs, candidateSpecs);
  const titleTokens = extractMeaningfulTokens(product.title);
  const titleSharedTokens = getSharedValues(titleTokens, candidateTokens);
  const overlapBase = Math.max(1, Math.min(titleTokens.length, 7));
  const titleOverlapRatio = titleSharedTokens.length / overlapBase;

  if (titleSharedTokens.length >= 3) return true;
  if (titleSharedTokens.length >= 2 && titleOverlapRatio >= 0.28) return true;
  if (titleSharedTokens.length >= 1 && sharedSpecs.length >= 2) return true;
  if (sharedTokens.length >= 2 && sharedSpecs.length >= 1) return true;

  return false;
}

function normalizeCandidate(candidate: RivalCandidate): RivalCandidate | null {
  const url = normalizeUrl(candidate.url);
  const itemId = candidate.item_id ?? extractMlId(url) ?? extractMlId(candidate.title);

  if (!url && !itemId) return null;

  return {
    title: candidate.title?.trim() || itemId || "Producto rival",
    url: url || `https://www.mercadolibre.com.uy/${itemId}`,
    item_id: itemId,
    seller_name: candidate.seller_name?.trim() || null,
    price: asNumber(candidate.price),
    currency_id: candidate.currency_id?.trim() || null,
    thumbnail: candidate.thumbnail?.trim() || null,
    confidence: Math.max(0, Math.min(1, asNumber(candidate.confidence) ?? 0.5)),
    reason: candidate.reason?.trim() || "Coincidencia por título y características.",
    matched_terms: Array.isArray(candidate.matched_terms)
      ? candidate.matched_terms.map((term) => String(term).trim()).filter(Boolean).slice(0, 6)
      : [],
  };
}

function extractOutputText(data: Record<string, unknown>): string | null {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text;

  const output = data.output;
  if (!Array.isArray(output)) return null;
  const chunks: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (typeof content === "string") {
      chunks.push(content);
      continue;
    }
    if (!Array.isArray(content)) continue;

    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) chunks.push(text);
    }
  }

  return chunks.length > 0 ? chunks.join("\n") : null;
}

function extractSources(data: Record<string, unknown>): string[] {
  const urls = new Set<string>();
  const output = data.output;
  if (!Array.isArray(output)) return [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const action = (item as { action?: unknown }).action;
    if (!action || typeof action !== "object") continue;
    const sources = (action as { sources?: unknown }).sources;
    if (!Array.isArray(sources)) continue;

    for (const source of sources) {
      if (!source || typeof source !== "object") continue;
      const url = (source as { url?: unknown }).url;
      if (typeof url === "string" && url.includes("mercadolibre.com.uy")) {
        urls.add(url);
      }
    }
  }

  return [...urls];
}

function summarizeOutput(data: Record<string, unknown>) {
  const output = data.output;
  if (!Array.isArray(output)) {
    return {
      status: data.status ?? null,
      output_type: typeof output,
    };
  }

  return {
    status: data.status ?? null,
    output: output.map((item) => {
      if (!item || typeof item !== "object") return { type: typeof item };
      const typed = item as { type?: unknown; status?: unknown; content?: unknown };
      return {
        type: typed.type ?? null,
        status: typed.status ?? null,
        content_types: Array.isArray(typed.content)
          ? typed.content.map((part) =>
            part && typeof part === "object" ? (part as { type?: unknown }).type ?? null : typeof part
          )
          : [],
      };
    }),
  };
}

function buildSearchHints(payload: Required<Pick<SearchPayload, "title">> & SearchPayload): string[] {
  const title = payload.title
    .replace(/\bEurotech\b/gi, " ")
    .replace(/\bSKU[:\s-]*[\w-]+\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9]+(?:\/[0-9]+)?/g) ?? [];

  const stop = new Set([
    "para",
    "con",
    "sin",
    "por",
    "del",
    "las",
    "los",
    "una",
    "uno",
    "kit",
    "set",
    "x",
  ]);
  const keywords = [...new Set(tokens.filter((token) => token.length > 1 && !stop.has(token)))].slice(0, 7);
  const compact = keywords.join(" ");

  return [
    title,
    compact,
    compact.replace(/\beurotech\b/gi, "").trim(),
    payload.domainId ? `${compact} ${payload.domainId.replace(/^MLU-/, "").replace(/_/g, " ").toLowerCase()}` : compact,
  ].map((hint) => hint.trim()).filter((hint, index, arr) => hint && arr.indexOf(hint) === index).slice(0, 4);
}

function buildPrompt(payload: Required<Pick<SearchPayload, "title">> & SearchPayload, limit: number) {
  const description = payload.description?.trim() || "Sin descripcion disponible.";
  const existingIds = (payload.existingCompetitorIds ?? []).filter(Boolean).join(", ") || "ninguno";
  const existingUrls = (payload.existingCompetitorUrls ?? []).filter(Boolean).join("\n") || "ninguna";
  const searchHints = buildSearchHints(payload).map((hint) => `- ${hint}`).join("\n");

  return [
    "Buscá en Mercado Libre Uruguay productos actualmente disponibles que compitan contra nuestro producto.",
    "",
    "Producto propio:",
    `- ID: ${payload.productId ?? "desconocido"}`,
    `- SKU: ${payload.sku ?? "sin SKU"}`,
    `- Titulo: ${payload.title}`,
    `- Descripcion: ${description}`,
    `- Categoria ML: ${payload.categoryId ?? "desconocida"}`,
    `- Dominio ML: ${payload.domainId ?? "desconocido"}`,
    `- Precio actual: ${payload.price ?? "desconocido"} ${payload.currencyId ?? ""}`.trim(),
    "",
    "Para buscar, NO uses el SKU ni la marca propia como restriccion principal. Ignora la marca Eurotech si aparece, pero conserva tipo exacto de producto, medidas, encastre, modelo, material y cantidad cuando sean parte de la equivalencia.",
    "Probá estas consultas base y variantes equivalentes en Mercado Libre Uruguay, manteniendo siempre el mismo producto objetivo:",
    searchHints || `- ${payload.title}`,
    "",
    `Devolvé hasta ${limit} rivales reales, solo si son sustitutos directos que un comprador podria elegir en lugar del producto propio.`,
    "Incluí un candidato unicamente cuando sea el mismo tipo exacto de producto o una variante equivalente con mismas medidas/modelo/encastre/cantidad principales. No alcanza con que comparta uso, categoria, instalacion o una palabra generica.",
    "No incluyas productos de otra familia, accesorios sueltos, repuestos distintos, combos no equivalentes, publicaciones pausadas, productos usados si el nuestro es nuevo salvo que sea claramente comparable, ni resultados del mismo producto propio.",
    "Si no encontrás coincidencias exactas con evidencia suficiente, devolvé candidates: [] en vez de candidatos dudosos.",
    `No repitas competidores ya vinculados. IDs existentes: ${existingIds}. URLs existentes:\n${existingUrls}`,
    "Usá solamente URLs de mercadolibre.com.uy y preferí URLs de catálogo /p/ o /up/ cuando estén disponibles.",
    "El campo confidence debe ir de 0 a 1. Usá valores menores a 0.76 para dudas y no incluyas esos candidatos. El campo reason debe citar las coincidencias exactas que lo hacen competidor.",
    "Respondé solo con un objeto JSON valido. No uses markdown, explicaciones, ni texto fuera del JSON.",
  ].join("\n");
}

function supportsReasoning(model: string): boolean {
  return model.startsWith("gpt-5") || /^o\d/.test(model);
}

function extractJsonText(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);

  return trimmed;
}

function parseRivalSearchResult(text: string): RivalSearchResult {
  return JSON.parse(extractJsonText(text)) as RivalSearchResult;
}

function buildOpenAIRequest(
  payload: Required<Pick<SearchPayload, "title">> & SearchPayload,
  limit: number,
  strictJson: boolean,
) {
  const requestBody: Record<string, unknown> = {
    model: OPENAI_MODEL,
    store: false,
    include: ["web_search_call.action.sources"],
    tools: [
      {
        type: "web_search",
        filters: {
          allowed_domains: ["mercadolibre.com.uy"],
        },
        user_location: {
          type: "approximate",
          country: "UY",
          city: "Montevideo",
          region: "Montevideo",
          timezone: "America/Montevideo",
        },
        search_context_size: "low",
      },
    ],
    tool_choice: RIVAL_SEARCH_TOOL_CHOICE,
    instructions: [
      "Sos un analista senior de e-commerce en Uruguay.",
      "Tu tarea es encontrar publicaciones rivales reales y exactas en Mercado Libre Uruguay.",
      "No inventes URLs, precios, vendedores ni IDs. Si no hay evidencia suficiente, devolve menos candidatos.",
      "Preferí devolver cero resultados antes que devolver productos relacionados pero no sustituibles.",
      strictJson
        ? "Respondé usando el formato JSON solicitado."
        : "Respondé SOLO con un objeto JSON valido, sin markdown ni texto adicional.",
    ].join(" "),
    input: buildPrompt(payload, limit),
    text: strictJson
      ? {
        format: {
          type: "json_schema",
          name: "ml_rival_search",
          strict: true,
          schema: resultSchema,
        },
      }
      : { format: { type: "text" } },
    max_output_tokens: strictJson ? 1800 : 2200,
  };

  if (supportsReasoning(OPENAI_MODEL)) {
    requestBody.reasoning = { effort: "low" };
  }

  return requestBody;
}

async function requestOpenAI(requestBody: Record<string, unknown>) {
  const openaiRes = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const raw = await openaiRes.json() as Record<string, unknown>;
  if (!openaiRes.ok) {
    console.error("OpenAI error", raw);
    const message =
      typeof raw.error === "object" && raw.error !== null &&
        typeof (raw.error as { message?: unknown }).message === "string"
        ? (raw.error as { message: string }).message
        : "No se pudo buscar rivales con OpenAI";
    throw new OpenAIRequestError(message);
  }

  return raw;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!OPENAI_API_KEY) {
    return jsonResponse({ error: "OPENAI_API_KEY no esta configurada" }, 500);
  }

  if (!isAuthorized(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const payload = await req.json() as SearchPayload;
    const title = payload.title?.trim();
    if (!title) {
      return jsonResponse({ error: "title es requerido" }, 400);
    }

    const limit = clampLimit(payload.limit);
    const requestPayload = { ...payload, title };
    let raw = await requestOpenAI(buildOpenAIRequest(requestPayload, limit, RIVAL_SEARCH_STRICT_JSON));
    let outputText = extractOutputText(raw);
    let parsed: RivalSearchResult | null = null;

    try {
      if (outputText) parsed = parseRivalSearchResult(outputText);
    } catch (err) {
      console.warn("OpenAI strict JSON parse failed:", err instanceof Error ? err.message : err);
    }

    if (!parsed && RIVAL_SEARCH_RETRY_ON_PARSE_ERROR) {
      console.warn("Retrying rival search with alternate JSON mode", summarizeOutput(raw));
      raw = await requestOpenAI(buildOpenAIRequest(requestPayload, limit, !RIVAL_SEARCH_STRICT_JSON));
      outputText = extractOutputText(raw);
      if (!outputText) {
        return jsonResponse({
          error: "OpenAI no devolvio contenido parseable",
          debug: summarizeOutput(raw),
        }, 502);
      }

      try {
        parsed = parseRivalSearchResult(outputText);
      } catch (err) {
        return jsonResponse({
          error: "OpenAI devolvio contenido, pero no era JSON valido",
          detail: err instanceof Error ? err.message : String(err),
          debug: summarizeOutput(raw),
        }, 502);
      }
    }

    if (!parsed) {
      const sources = extractSources(raw);
      return jsonResponse({
        success: true,
        model: OPENAI_MODEL,
        query: title,
        summary: "No se pudo validar una respuesta exacta de IA. No se muestran candidatos dudosos.",
        candidates: [],
        sources,
        debug: summarizeOutput(raw),
        searched_at: new Date().toISOString(),
      });
    }

    const existing = new Set((payload.existingCompetitorIds ?? []).map((id) => id.toUpperCase()));
    const sources = extractSources(raw);
    let candidates = (parsed.candidates ?? [])
      .map(normalizeCandidate)
      .filter((candidate): candidate is RivalCandidate => {
        if (!candidate) return false;
        if (candidate.item_id && existing.has(candidate.item_id.toUpperCase())) return false;
        return candidate.url.includes("mercadolibre.com.uy") &&
          isExactCompetitorCandidate(requestPayload, candidate);
      })
      .slice(0, limit);

    return jsonResponse({
      success: true,
      model: OPENAI_MODEL,
      query: parsed.query,
      summary: candidates.length > 0
        ? parsed.summary
        : "No se encontraron competidores exactos con suficiente confianza.",
      candidates,
      sources,
      searched_at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("ml-search-rivals error:", message);
    if (err instanceof OpenAIRequestError) {
      return jsonResponse({ success: false, error: message }, 502);
    }
    return jsonResponse({ success: false, error: message }, 500);
  }
});
