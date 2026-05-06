const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-5";
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
  const parsed = asNumber(value) ?? 8;
  return Math.max(1, Math.min(10, Math.round(parsed)));
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
  if (typeof data.output_text === "string") return data.output_text;

  const output = data.output;
  if (!Array.isArray(output)) return null;

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;

    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") return text;
    }
  }

  return null;
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

function buildPrompt(payload: Required<Pick<SearchPayload, "title">> & SearchPayload, limit: number) {
  const description = payload.description?.trim() || "Sin descripcion disponible.";
  const existingIds = (payload.existingCompetitorIds ?? []).filter(Boolean).join(", ") || "ninguno";
  const existingUrls = (payload.existingCompetitorUrls ?? []).filter(Boolean).join("\n") || "ninguna";

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
    `Devolvé hasta ${limit} rivales reales. Priorizá publicaciones activas, mismo tipo de producto, marca/modelo compatible, dimensiones o especificaciones similares y vendedores distintos.`,
    "No incluyas accesorios, repuestos, publicaciones pausadas, productos usados si el nuestro es nuevo salvo que sea claramente comparable, ni resultados del mismo producto propio.",
    `No repitas competidores ya vinculados. IDs existentes: ${existingIds}. URLs existentes:\n${existingUrls}`,
    "Usá solamente URLs de mercadolibre.com.uy y preferí URLs de catálogo /p/ o /up/ cuando estén disponibles.",
    "El campo confidence debe ir de 0 a 1. El campo reason debe explicar brevemente por qué compite.",
    "Respondé solo con JSON que cumpla el schema.",
  ].join("\n");
}

function supportsReasoning(model: string): boolean {
  return model.startsWith("gpt-5") || /^o\d/.test(model);
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
          search_context_size: "medium",
        },
      ],
      tool_choice: "auto",
      instructions: [
        "Sos un analista senior de e-commerce en Uruguay.",
        "Tu tarea es encontrar publicaciones rivales reales en Mercado Libre Uruguay.",
        "No inventes URLs, precios, vendedores ni IDs. Si no hay evidencia suficiente, devolve menos candidatos.",
      ].join(" "),
      input: buildPrompt({ ...payload, title }, limit),
      text: {
        format: {
          type: "json_schema",
          name: "ml_rival_search",
          strict: true,
          schema: resultSchema,
        },
      },
      max_output_tokens: 3000,
    };

    if (supportsReasoning(OPENAI_MODEL)) {
      requestBody.reasoning = { effort: "low" };
    }

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
      return jsonResponse({ error: message }, 502);
    }

    const outputText = extractOutputText(raw);
    if (!outputText) {
      return jsonResponse({
        error: "OpenAI no devolvio contenido parseable",
        debug: summarizeOutput(raw),
      }, 502);
    }

    const parsed = JSON.parse(outputText) as RivalSearchResult;
    const existing = new Set((payload.existingCompetitorIds ?? []).map((id) => id.toUpperCase()));
    const candidates = (parsed.candidates ?? [])
      .map(normalizeCandidate)
      .filter((candidate): candidate is RivalCandidate => {
        if (!candidate) return false;
        if (candidate.item_id && existing.has(candidate.item_id.toUpperCase())) return false;
        return candidate.url.includes("mercadolibre.com.uy");
      })
      .slice(0, limit);

    return jsonResponse({
      success: true,
      model: OPENAI_MODEL,
      query: parsed.query,
      summary: parsed.summary,
      candidates,
      sources: extractSources(raw),
      searched_at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("ml-search-rivals error:", message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
