import { createClient } from "jsr:@supabase/supabase-js@2";

const ML_API = "https://api.mercadolibre.com";
const ML_OAUTH = "https://api.mercadolibre.com/oauth/token";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ML_CLIENT_ID = Deno.env.get("ML_CLIENT_ID")!;
const ML_CLIENT_SECRET = Deno.env.get("ML_CLIENT_SECRET")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Token Management ────────────────────────────────────────────────────────

interface TokenRow {
  id: number;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  user_id: number;
}

async function getValidToken(): Promise<TokenRow> {
  const { data, error } = await supabase
    .from("ml_tokens")
    .select("*")
    .order("id", { ascending: false })
    .limit(1)
    .single<TokenRow>();

  if (error || !data) {
    throw new Error(`No token found in database: ${error?.message}`);
  }

  const expiresAt = new Date(data.expires_at);
  const now = new Date();
  const bufferMs = 30 * 60 * 1000;

  if (expiresAt.getTime() - now.getTime() > bufferMs) {
    return data;
  }

  console.log("Token próximo a expirar, intentando renovar...");
  try {
    const newAccessToken = await refreshToken(data);
    return { ...data, access_token: newAccessToken };
  } catch (err) {
    console.warn("No se pudo renovar token:", err instanceof Error ? err.message : err);
    return data;
  }
}

async function refreshToken(tokenRow: TokenRow): Promise<string> {
  if (!tokenRow.refresh_token) {
    throw new Error("No hay refresh_token almacenado.");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: ML_CLIENT_ID,
    client_secret: ML_CLIENT_SECRET,
    refresh_token: tokenRow.refresh_token,
  });

  const res = await fetch(ML_OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error renovando token ML: ${res.status} ${err}`);
  }

  const newToken = await res.json();
  const expiresAt = new Date(Date.now() + (newToken.expires_in ?? 21600) * 1000);

  await supabase
    .from("ml_tokens")
    .update({
      access_token: newToken.access_token,
      refresh_token: newToken.refresh_token ?? tokenRow.refresh_token,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", tokenRow.id);

  console.log(`Token renovado. Expira: ${expiresAt.toISOString()}`);
  return newToken.access_token;
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface CompetitorItem {
  id: string;
  our_sku: string;
  price: number | null;
  previous_price: number | null;
  permalink: string | null;
}

// Catalog product IDs are stored with /p/ or /up/ permalinks
function isCatalogItem(item: CompetitorItem): boolean {
  return !!(item.permalink?.includes("/p/") || item.permalink?.includes("/up/"));
}

interface CatalogItemResult {
  seller_id: number;
  price: number;
  currency_id: string;
  condition: string;
}

async function fetchCatalogPrice(
  catalogId: string,
  token: string,
  ourUserId: number
): Promise<{ price: number | null; sellerId: number | null }> {
  const res = await fetch(
    `${ML_API}/products/${catalogId}/items?status=active&limit=20`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return { price: null, sellerId: null };

  const data = await res.json();
  const results: CatalogItemResult[] = data.results ?? [];
  if (results.length === 0) return { price: null, sellerId: null };

  // Pick cheapest competitor (exclude our own seller ID)
  const competitors = results.filter((r) => r.seller_id !== ourUserId);
  const pool = competitors.length > 0 ? competitors : results;
  const best = pool.reduce((a, b) => (a.price <= b.price ? a : b));
  return { price: best.price, sellerId: best.seller_id };
}

interface MLItemPrice {
  id: string;
  code: number;
  body: {
    id: string;
    price: number | null;
    original_price: number | null;
    available_quantity: number | null;
    sold_quantity: number | null;
    status: string | null;
    health: number | null;
  };
}

type AlertRuleType =
  | "price_changed"
  | "competitor_cheaper"
  | "competitor_pricier"
  | "price_diff_pct_above"
  | "price_diff_pct_below";

interface AlertRule {
  id: string;
  name: string;
  sku: string | null;
  rule_type: AlertRuleType;
  threshold_pct: number | null;
  enabled: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ─── ML API ──────────────────────────────────────────────────────────────────

async function fetchItemPrices(
  ids: string[],
  token: string
): Promise<MLItemPrice[]> {
  const idsParam = ids.join(",");
  const res = await fetch(
    `${ML_API}/items?ids=${idsParam}&attributes=id,price,original_price,available_quantity,sold_quantity,status,health`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ML API /items → ${res.status}: ${err}`);
  }
  return res.json() as Promise<MLItemPrice[]>;
}

// ─── Reglas ──────────────────────────────────────────────────────────────────

function evaluateRule(
  rule: AlertRule,
  priceBefore: number | null,
  priceAfter: number | null,
  ourPrice: number | null
): boolean {
  if (priceAfter === null) return false;

  switch (rule.rule_type) {
    case "price_changed":
      return priceBefore !== null && priceBefore !== priceAfter;

    case "competitor_cheaper":
      return ourPrice !== null && priceAfter < ourPrice;

    case "competitor_pricier":
      return ourPrice !== null && priceAfter > ourPrice;

    case "price_diff_pct_above": {
      // competidor más barato en al menos threshold_pct%
      if (ourPrice === null || ourPrice === 0 || rule.threshold_pct === null) return false;
      const diffPct = ((ourPrice - priceAfter) / ourPrice) * 100;
      return diffPct >= rule.threshold_pct;
    }

    case "price_diff_pct_below": {
      // competidor más caro en al menos threshold_pct%
      if (ourPrice === null || ourPrice === 0 || rule.threshold_pct === null) return false;
      const diffPct = ((priceAfter - ourPrice) / ourPrice) * 100;
      return diffPct >= rule.threshold_pct;
    }

    default:
      return false;
  }
}

function calcDiffPct(ourPrice: number | null, competitorPrice: number | null): number | null {
  if (ourPrice === null || ourPrice === 0 || competitorPrice === null) return null;
  return Number((((ourPrice - competitorPrice) / ourPrice) * 100).toFixed(2));
}

// ─── Core ────────────────────────────────────────────────────────────────────

async function syncCompetitorPrices(tokenRow: TokenRow): Promise<{
  items_processed: number;
  items_updated: number;
  alerts_fired: number;
}> {
  // 1. Cargar todos los competitor items
  const { data: competitorItems, error: ciError } = await supabase
    .from("ml_competitor_items")
    .select("id, our_sku, price, previous_price, permalink");

  if (ciError) throw new Error(`Error cargando competitor items: ${ciError.message}`);
  if (!competitorItems || competitorItems.length === 0) {
    console.log("No hay competitor items registrados.");
    return { items_processed: 0, items_updated: 0, alerts_fired: 0 };
  }

  // 2. Cargar todas las reglas habilitadas
  const { data: rules, error: rulesError } = await supabase
    .from("ml_price_alert_rules")
    .select("*")
    .eq("enabled", true);

  if (rulesError) throw new Error(`Error cargando reglas: ${rulesError.message}`);
  const allRules: AlertRule[] = rules ?? [];

  // 3. Cargar precios propios agrupados por SKU
  const skus = [...new Set((competitorItems as CompetitorItem[]).map((c) => c.our_sku))];
  const { data: ownProducts, error: prodError } = await supabase
    .from("ml_products")
    .select("sku, price")
    .in("sku", skus);

  if (prodError) throw new Error(`Error cargando precios propios: ${prodError.message}`);

  const ownPriceMap = new Map<string, number>();
  for (const p of ownProducts ?? []) {
    if (p.sku && p.price !== null) {
      // Si hay múltiples con mismo SKU, quedamos con el primero (debería ser único)
      if (!ownPriceMap.has(p.sku)) ownPriceMap.set(p.sku, p.price);
    }
  }

  const token = tokenRow.access_token;

  let itemsUpdated = 0;
  let alertsFired = 0;
  const items = competitorItems as CompetitorItem[];

  const catalogItems = items.filter(isCatalogItem);
  const directItems = items.filter((i) => !isCatalogItem(i));

  console.log(`Catalog items: ${catalogItems.length}, Direct items: ${directItems.length}`);

  // ── Helper: process alerts and update for a resolved price ──────────────
  function buildUpdateAndAlerts(
    item: CompetitorItem,
    newPrice: number | null,
  ): {
    update: Record<string, unknown>;
    alerts: {
      rule_id: string;
      our_sku: string;
      competitor_item_id: string;
      our_price: number | null;
      competitor_price_before: number | null;
      competitor_price_after: number | null;
      diff_pct: number | null;
    }[];
  } {
    const prevPrice = item.price ?? null;
    const ourPrice = ownPriceMap.get(item.our_sku) ?? null;

    const update: Record<string, unknown> = {
      id: item.id,
      our_sku: item.our_sku,
      price: newPrice,
      previous_price: prevPrice,
      synced_at: new Date().toISOString(),
    };

    const applicableRules = allRules.filter(
      (r) => r.sku === null || r.sku === item.our_sku
    );
    const alerts = applicableRules
      .filter((rule) => evaluateRule(rule, prevPrice, newPrice, ourPrice))
      .map((rule) => ({
        rule_id: rule.id,
        our_sku: item.our_sku,
        competitor_item_id: item.id,
        our_price: ourPrice,
        competitor_price_before: prevPrice,
        competitor_price_after: newPrice,
        diff_pct: calcDiffPct(ourPrice, newPrice),
      }));

    return { update, alerts };
  }

  // ── 4a. Catalog items: use /products/{id}/items endpoint ─────────────────
  for (const batch of chunk(catalogItems, 10)) {
    const allAlerts: ReturnType<typeof buildUpdateAndAlerts>["alerts"] = [];
    const allUpdates: Record<string, unknown>[] = [];

    await Promise.all(batch.map(async (item) => {
      try {
        const { price: newPrice } = await fetchCatalogPrice(item.id, token, tokenRow.user_id);
        if (newPrice === null) return;
        const { update, alerts } = buildUpdateAndAlerts(item, newPrice);
        allUpdates.push(update);
        allAlerts.push(...alerts);
      } catch (err) {
        console.error(`Error fetching catalog ${item.id}: ${err instanceof Error ? err.message : err}`);
      }
    }));

    if (allUpdates.length > 0) {
      const { error: upsertError } = await supabase
        .from("ml_competitor_items")
        .upsert(allUpdates, { onConflict: "id,our_sku" });
      if (upsertError) console.error(`Error actualizando catalog items: ${upsertError.message}`);
      else itemsUpdated += allUpdates.length;
    }

    if (allAlerts.length > 0) {
      const { error: alertError } = await supabase.from("ml_price_alerts").insert(allAlerts);
      if (alertError) console.error(`Error insertando alertas: ${alertError.message}`);
      else alertsFired += allAlerts.length;
    }
  }

  // ── 4b. Direct items: batch via /items?ids= ──────────────────────────────
  for (const batch of chunk(directItems, 20)) {
    const ids = batch.map((i) => i.id);
    let mlResults: MLItemPrice[];

    try {
      mlResults = await fetchItemPrices(ids, token);
    } catch (err) {
      console.error(`Error fetching batch ${ids.join(",")}: ${err instanceof Error ? err.message : err}`);
      continue;
    }

    // 5. Para cada item del batch, actualizar y evaluar reglas
    const alertRows: {
      rule_id: string;
      our_sku: string;
      competitor_item_id: string;
      our_price: number | null;
      competitor_price_before: number | null;
      competitor_price_after: number | null;
      diff_pct: number | null;
    }[] = [];

    const updateRows: {
      id: string;
      price: number | null;
      previous_price: number | null;
      available_quantity: number | null;
      sold_quantity: number | null;
      status: string | null;
      health: number | null;
      synced_at: string;
    }[] = [];

    for (const result of mlResults) {
      if (result.code !== 200 || !result.body) continue;

      const local = batch.find((i) => i.id === result.id);
      if (!local) continue;

      const newPrice = result.body.price ?? null;
      const prevPrice = local.price ?? null;
      const ourPrice = ownPriceMap.get(local.our_sku) ?? null;

      updateRows.push({
        id: result.id,
        price: newPrice,
        previous_price: prevPrice,
        available_quantity: result.body.available_quantity ?? null,
        sold_quantity: result.body.sold_quantity ?? null,
        status: result.body.status ?? null,
        health: result.body.health ?? null,
        synced_at: new Date().toISOString(),
      });

      // Evaluar reglas aplicables: globales (sku=null) + específicas para este SKU
      const applicableRules = allRules.filter(
        (r) => r.sku === null || r.sku === local.our_sku
      );

      for (const rule of applicableRules) {
        if (evaluateRule(rule, prevPrice, newPrice, ourPrice)) {
          alertRows.push({
            rule_id: rule.id,
            our_sku: local.our_sku,
            competitor_item_id: result.id,
            our_price: ourPrice,
            competitor_price_before: prevPrice,
            competitor_price_after: newPrice,
            diff_pct: calcDiffPct(ourPrice, newPrice),
          });
        }
      }
    }

    // 6. Upsert precios actualizados
    if (updateRows.length > 0) {
      const { error: upsertError } = await supabase
        .from("ml_competitor_items")
        .upsert(updateRows, { onConflict: "id" });

      if (upsertError) {
        console.error(`Error actualizando precios: ${upsertError.message}`);
      } else {
        itemsUpdated += updateRows.length;
      }
    }

    // 7. Insertar alertas
    if (alertRows.length > 0) {
      const { error: alertError } = await supabase
        .from("ml_price_alerts")
        .insert(alertRows);

      if (alertError) {
        console.error(`Error insertando alertas: ${alertError.message}`);
      } else {
        alertsFired += alertRows.length;
        console.log(`Alertas disparadas: ${alertRows.length}`);
        for (const a of alertRows) {
          console.log(
            `  [${a.rule_id}] SKU=${a.our_sku} item=${a.competitor_item_id} before=${a.competitor_price_before} after=${a.competitor_price_after} our=${a.our_price} diff=${a.diff_pct}%`
          );
        }
      }
    }
  }

  return {
    items_processed: items.length,
    items_updated: itemsUpdated,
    alerts_fired: alertsFired,
  };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    console.log("=== ML Sync Competitor iniciado ===");

    const tokenRow = await getValidToken();
    const stats = await syncCompetitorPrices(tokenRow);

    const result = { success: true, ...stats, synced_at: new Date().toISOString() };
    console.log("=== ML Sync Competitor finalizado ===", result);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("ML Sync Competitor error:", message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
});
