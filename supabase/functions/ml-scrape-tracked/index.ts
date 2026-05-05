import { createClient } from "jsr:@supabase/supabase-js@2";

const ML_API = "https://api.mercadolibre.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function getToken(): Promise<string> {
  const { data, error } = await supabase
    .schema("ml").from("ml_tokens")
    .select("access_token")
    .order("id", { ascending: false })
    .limit(1)
    .single();
  if (error || !data) throw new Error(`No token: ${error?.message}`);
  return data.access_token;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

interface MLItemBody {
  id: string;
  price: number | null;
  original_price: number | null;
  available_quantity: number | null;
  sold_quantity: number | null;
  status: string | null;
  health: number | null;
  title: string | null;
  thumbnail: string | null;
  seller_id: number | null;
  permalink: string | null;
}

interface LatestSnapshot {
  tracked_item_id: string;
  price: number | null;
  available_quantity: number | null;
  sold_quantity: number | null;
  status: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  try {
    console.log("=== ml-scrape-tracked iniciado ===");
    const token = await getToken();

    // Load all active tracked items
    const { data: items, error: itemsError } = await supabase
      .schema("ml").from("ml_tracked_items")
      .select("id, ml_item_id")
      .eq("active", true);

    if (itemsError) throw new Error(itemsError.message);
    if (!items || items.length === 0) {
      return Response.json({ success: true, scraped: 0, snapshots_stored: 0 }, { headers: CORS_HEADERS });
    }

    console.log(`Tracked items activos: ${items.length}`);

    // Load latest snapshot for each item (for change detection)
    const trackedIds = items.map((i) => i.id);
    const { data: allSnapshots } = await supabase
      .schema("ml").from("ml_tracked_snapshots")
      .select("tracked_item_id, price, available_quantity, sold_quantity, status")
      .in("tracked_item_id", trackedIds)
      .order("scraped_at", { ascending: false });

    const latestMap = new Map<string, LatestSnapshot>();
    for (const snap of (allSnapshots ?? []) as LatestSnapshot[]) {
      if (!latestMap.has(snap.tracked_item_id)) {
        latestMap.set(snap.tracked_item_id, snap);
      }
    }

    let snapshotsStored = 0;
    const now = new Date().toISOString();

    for (const batch of chunk(items, 20)) {
      const idsParam = batch.map((i) => i.ml_item_id).join(",");
      const res = await fetch(
        `${ML_API}/items?ids=${idsParam}&attributes=id,title,price,original_price,available_quantity,sold_quantity,status,health,thumbnail,seller_id,permalink`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        console.error(`ML API error ${res.status} for batch ${idsParam}`);
        continue;
      }

      const results: Array<{ id: string; code: number; body: MLItemBody }> = await res.json();
      const newSnapshots: Array<{
        tracked_item_id: string;
        price: number | null;
        original_price: number | null;
        available_quantity: number | null;
        sold_quantity: number | null;
        status: string | null;
        health: number | null;
      }> = [];

      const titleUpdates: Array<{ id: string; title: string | null; thumbnail: string | null; last_scraped_at: string }> = [];

      for (const result of results) {
        if (result.code !== 200 || !result.body) continue;
        const item = batch.find((i) => i.ml_item_id === result.id);
        if (!item) continue;

        const body = result.body;
        const latest = latestMap.get(item.id);

        // Store snapshot if first time or something changed
        const changed = !latest ||
          latest.price !== body.price ||
          (latest as unknown as { original_price: number | null }).original_price !== (body.original_price ?? null) ||
          latest.available_quantity !== body.available_quantity ||
          latest.sold_quantity !== body.sold_quantity ||
          latest.status !== body.status;

        if (changed) {
          newSnapshots.push({
            tracked_item_id: item.id,
            price: body.price ?? null,
            original_price: body.original_price ?? null,
            available_quantity: body.available_quantity ?? null,
            sold_quantity: body.sold_quantity ?? null,
            status: body.status ?? null,
            health: body.health ?? null,
          });
          console.log(`  [CHANGED] ${result.id}: price=${body.price} stock=${body.available_quantity} sold=${body.sold_quantity}`);
        }

        // Update title/thumbnail if we now have it
        if (body.title) {
          titleUpdates.push({
            id: item.id,
            title: body.title,
            thumbnail: body.thumbnail ?? null,
            last_scraped_at: now,
          });
        }
      }

      if (newSnapshots.length > 0) {
        const { error: snapError } = await supabase
          .schema("ml").from("ml_tracked_snapshots")
          .insert(newSnapshots);
        if (snapError) console.error(`Error insertando snapshots: ${snapError.message}`);
        else snapshotsStored += newSnapshots.length;
      }

      // Update metadata on tracked items
      for (const upd of titleUpdates) {
        await supabase
          .schema("ml").from("ml_tracked_items")
          .update({ title: upd.title, thumbnail: upd.thumbnail, last_scraped_at: upd.last_scraped_at })
          .eq("id", upd.id);
      }
    }

    const result = { success: true, scraped: items.length, snapshots_stored: snapshotsStored, scraped_at: now };
    console.log("=== ml-scrape-tracked finalizado ===", result);
    return Response.json(result, { headers: CORS_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("ml-scrape-tracked error:", message);
    return Response.json({ success: false, error: message }, { status: 500, headers: CORS_HEADERS });
  }
});
