import { createClient } from "jsr:@supabase/supabase-js@2";

const ML_API = "https://api.mercadolibre.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const PAGE_SIZE = 150; // items por invocación (safe dentro del timeout de 150s)

async function getToken(): Promise<string> {
  const { data, error } = await supabase
    .from("ml_tokens")
    .select("access_token")
    .order("id", { ascending: false })
    .limit(1)
    .single();
  if (error || !data) throw new Error(`No token: ${error?.message}`);
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // El body puede indicar qué página procesar: { "page": 0 }
    let page = 0;
    try {
      const body = await req.json();
      page = body.page ?? 0;
    } catch { /* default page 0 */ }

    console.log(`=== ML Item Visits - página ${page} ===`);
    const token = await getToken();
    const today = new Date().toISOString().split("T")[0];

    // Traer los items de esta página ordenados por last_updated
    const from = page * PAGE_SIZE;
    const { data: products, error: prodError } = await supabase
      .from("ml_products")
      .select("id")
      .order("last_updated", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (prodError) throw new Error(`Error fetching products: ${prodError.message}`);
    if (!products || products.length === 0) {
      return Response.json({ success: true, page, synced: 0, message: "No more items" });
    }

    // Disparar todas las llamadas en paralelo en grupos de 20
    let synced = 0;
    const CONCURRENT = 20;

    for (let i = 0; i < products.length; i += CONCURRENT) {
      const chunk = products.slice(i, i + CONCURRENT);

      await Promise.all(chunk.map(async (product) => {
        try {
          const res = await fetch(
            `${ML_API}/visits/items?ids=${product.id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!res.ok) return;

          const data: Record<string, number> = await res.json();
          const visits = data[product.id] ?? 0;

          await supabase
            .from("ml_item_visits")
            .upsert(
              { item_id: product.id, date: today, visits, synced_at: new Date().toISOString() },
              { onConflict: "item_id,date" }
            );
          synced++;
        } catch {
          // Seguir con los demás
        }
      }));
    }

    // Calcular si hay más páginas
    const { count } = await supabase
      .from("ml_products")
      .select("id", { count: "exact", head: true });

    const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);
    const hasMore = page + 1 < totalPages;

    // Auto-disparar la siguiente página si hay más
    if (hasMore) {
      const nextPage = page + 1;
      console.log(`Disparando página siguiente: ${nextPage}/${totalPages}`);
      // Fire-and-forget la siguiente página
      fetch(
        `${SUPABASE_URL}/functions/v1/ml-sync-item-visits`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({ page: nextPage }),
        }
      ).catch(() => {});
    }

    const result = {
      success: true,
      page,
      synced,
      total_pages: totalPages,
      has_more: hasMore,
      synced_at: today,
    };

    console.log(`Página ${page} completada:`, result);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("ML Item Visits error:", message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
});
