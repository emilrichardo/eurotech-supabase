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

async function mlFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${ML_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`ML API ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── Seller info + reputación ────────────────────────────────────────────────

interface SellerData {
  id: number;
  nickname: string;
  first_name: string;
  last_name: string;
  email: string;
  contact_email: string;
  registration_date: string;
  country_id: string;
  site_id: string;
  user_type: string;
  seller_experience: string;
  points: number;
  permalink: string;
  tags: string[];
  logo: string | null;
  address: unknown;
  phone: unknown;
  identification: unknown;
  seller_reputation: {
    level_id: string;
    power_seller_status: string;
    metrics: {
      sales: { period: string; completed: number };
      claims: { period: string; rate: number; value: number };
      delayed_handling_time: { period: string; rate: number; value: number };
      cancellations: { period: string; rate: number; value: number };
    };
    transactions: {
      total: number;
      completed: number;
      canceled: number;
      ratings: { positive: number; neutral: number; negative: number };
    };
  };
}

async function syncSeller(token: string, userId: number) {
  const data = await mlFetch<SellerData>(
    `/users/${userId}?attributes=id,nickname,first_name,last_name,email,contact_email,registration_date,country_id,site_id,user_type,seller_experience,points,permalink,tags,logo,address,phone,identification,seller_reputation`,
    token
  );

  const rep = data.seller_reputation;
  const row = {
    id: data.id,
    nickname: data.nickname,
    first_name: data.first_name,
    last_name: data.last_name,
    email: data.email,
    contact_email: data.contact_email,
    registration_date: data.registration_date,
    country_id: data.country_id,
    site_id: data.site_id,
    user_type: data.user_type,
    seller_experience: data.seller_experience,
    points: data.points,
    permalink: data.permalink,
    tags: data.tags ?? null,
    logo: data.logo ?? null,
    address: data.address ?? null,
    phone: data.phone ?? null,
    identification: data.identification ?? null,
    reputation_level: rep?.level_id ?? null,
    power_seller_status: rep?.power_seller_status ?? null,
    sales_period: rep?.metrics?.sales?.period ?? null,
    sales_completed: rep?.metrics?.sales?.completed ?? null,
    claims_rate: rep?.metrics?.claims?.rate ?? null,
    claims_value: rep?.metrics?.claims?.value ?? null,
    delayed_handling_rate: rep?.metrics?.delayed_handling_time?.rate ?? null,
    delayed_handling_value: rep?.metrics?.delayed_handling_time?.value ?? null,
    cancellations_rate: rep?.metrics?.cancellations?.rate ?? null,
    cancellations_value: rep?.metrics?.cancellations?.value ?? null,
    transactions_total: rep?.transactions?.total ?? null,
    transactions_completed: rep?.transactions?.completed ?? null,
    transactions_canceled: rep?.transactions?.canceled ?? null,
    ratings_positive: rep?.transactions?.ratings?.positive ?? null,
    ratings_neutral: rep?.transactions?.ratings?.neutral ?? null,
    ratings_negative: rep?.transactions?.ratings?.negative ?? null,
    synced_at: new Date().toISOString(),
  };

  const { error } = await supabase.schema("ml").from("ml_seller").upsert(row, { onConflict: "id" });
  if (error) throw new Error(`Error upserting seller: ${error.message}`);
  return row;
}

// ─── Visitas diarias (nivel cuenta) ─────────────────────────────────────────

interface VisitDay {
  date: string;
  total: number;
}

interface VisitsResponse {
  results: VisitDay[];
  total_visits: number;
}

async function syncSellerVisits(token: string, userId: number) {
  // Traemos los últimos 30 días
  const data = await mlFetch<VisitsResponse>(
    `/users/${userId}/items_visits/time_window?last=30&unit=day`,
    token
  );

  const rows = data.results.map((r) => ({
    date: r.date.split("T")[0], // solo la fecha YYYY-MM-DD
    total: r.total,
    synced_at: new Date().toISOString(),
  }));

  if (rows.length === 0) return { days: 0, total_visits: 0 };

  const { error } = await supabase
    .schema("ml").from("ml_seller_visits")
    .upsert(rows, { onConflict: "date" });

  if (error) throw new Error(`Error upserting seller visits: ${error.message}`);
  return { days: rows.length, total_visits: data.total_visits };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    console.log("=== ML Sync Seller iniciado ===");
    const { token, userId } = await getToken();

    const [sellerRow, visitsResult] = await Promise.all([
      syncSeller(token, userId),
      syncSellerVisits(token, userId),
    ]);

    const result = {
      success: true,
      seller: {
        id: sellerRow.id,
        nickname: sellerRow.nickname,
        reputation: sellerRow.reputation_level,
        power_seller: sellerRow.power_seller_status,
        sales_120d: sellerRow.sales_completed,
      },
      seller_visits: visitsResult,
      synced_at: new Date().toISOString(),
    };

    console.log("=== ML Sync Seller finalizado ===", result);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("ML Sync Seller error:", message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
});
