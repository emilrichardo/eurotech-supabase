import { createClient } from "jsr:@supabase/supabase-js@2";

const ML_API = "https://api.mercadolibre.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function getToken(): Promise<{ token: string; userId: number }> {
  const { data, error } = await supabase
    .schema("ml").from("ml_tokens")
    .select("access_token, user_id")
    .order("id", { ascending: false })
    .limit(1)
    .single();
  if (error || !data) throw new Error(`No token: ${error?.message}`);
  return { token: data.access_token, userId: data.user_id };
}

interface Answer {
  text: string;
  status: string;
  date_created: string;
}

interface Question {
  id: number;
  item_id: string;
  seller_id: number;
  from: { id: number };
  status: string;
  text: string;
  tags: unknown[];
  hold: boolean;
  deleted_from_listing: boolean;
  date_created: string;
  answer: Answer | null;
}

interface QuestionsResponse {
  total: number;
  questions: Question[];
}

function mapQuestion(q: Question) {
  return {
    id: q.id,
    item_id: q.item_id,
    seller_id: q.seller_id,
    from_user_id: q.from?.id ?? null,
    status: q.status,
    text: q.text,
    tags: q.tags ?? null,
    hold: q.hold ?? false,
    deleted_from_listing: q.deleted_from_listing ?? false,
    date_created: q.date_created ?? null,
    answer_text: q.answer?.text ?? null,
    answer_status: q.answer?.status ?? null,
    answer_date_created: q.answer?.date_created ?? null,
    synced_at: new Date().toISOString(),
  };
}

// Trae todas las preguntas de un item (pocas por item, sin riesgo de superar offset 1000)
async function fetchQuestionsForItem(
  token: string,
  itemId: string
): Promise<Question[]> {
  const questions: Question[] = [];
  const limit = 50;
  let offset = 0;
  let total = Infinity;

  while (offset < total && offset < 1000) {
    const res = await fetch(
      `${ML_API}/questions/search?item=${itemId}&limit=${limit}&offset=${offset}&api_version=4`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) break;

    const data: QuestionsResponse = await res.json();
    total = data.total;
    if (data.questions.length === 0) break;

    questions.push(...data.questions);
    offset += limit;
  }

  return questions;
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    console.log("=== ML Sync Questions iniciado ===");
    const { token } = await getToken();

    // Traer TODOS los item_ids paginando de a 1000 (límite Supabase)
    const products: { id: string }[] = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error: prodError } = await supabase
        .schema("ml").from("ml_products")
        .select("id")
        .range(from, from + PAGE - 1);
      if (prodError) throw new Error(`Error fetching products: ${prodError.message}`);
      if (!data || data.length === 0) break;
      products.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }

    if (products.length === 0) {
      return Response.json({ success: true, upserted: 0, message: "No products found" });
    }

    let totalUpserted = 0;
    let itemsWithQuestions = 0;
    const BATCH_SIZE = 10; // items en paralelo para no sobrecargar

    // Procesar en batches paralelos
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map((p) => fetchQuestionsForItem(token, p.id))
      );

      const allRows: ReturnType<typeof mapQuestion>[] = [];
      for (const questions of batchResults) {
        if (questions.length > 0) {
          itemsWithQuestions++;
          allRows.push(...questions.map(mapQuestion));
        }
      }

      if (allRows.length > 0) {
        const { error } = await supabase
          .schema("ml").from("ml_questions")
          .upsert(allRows, { onConflict: "id" });

        if (error) {
          console.error(`Upsert error batch ${i}: ${error.message}`);
        } else {
          totalUpserted += allRows.length;
        }
      }

      if (i % 100 === 0) {
        console.log(`Progreso: ${i}/${products.length} items procesados, ${totalUpserted} preguntas`);
      }
    }

    const result = {
      success: true,
      items_processed: products.length,
      items_with_questions: itemsWithQuestions,
      upserted: totalUpserted,
      synced_at: new Date().toISOString(),
    };

    console.log("=== ML Sync Questions finalizado ===", result);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("ML Sync Questions error:", message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
});
