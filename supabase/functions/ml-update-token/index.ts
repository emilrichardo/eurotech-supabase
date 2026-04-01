import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UPDATE_TOKEN_SECRET = Deno.env.get("UPDATE_TOKEN_SECRET")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Validar secret de acceso
  const authHeader = req.headers.get("x-update-secret");
  if (!authHeader || authHeader !== UPDATE_TOKEN_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    user_id?: number;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { access_token, refresh_token, expires_in, user_id } = body;

  if (!access_token) {
    return Response.json({ error: "access_token is required" }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + (expires_in ?? 21600) * 1000);

  // Buscar fila existente
  const { data: existing } = await supabase
    .from("ml_tokens")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .single();

  let error;

  if (existing) {
    ({ error } = await supabase
      .from("ml_tokens")
      .update({
        access_token,
        ...(refresh_token ? { refresh_token } : {}),
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id));
  } else {
    ({ error } = await supabase
      .from("ml_tokens")
      .insert({
        access_token,
        refresh_token: refresh_token ?? null,
        expires_at: expiresAt.toISOString(),
        user_id: user_id ?? 470234745,
      }));
  }

  if (error) {
    console.error("Error updating token:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  console.log(`Token actualizado. Expira: ${expiresAt.toISOString()}`);
  return Response.json({
    success: true,
    expires_at: expiresAt.toISOString(),
  });
});
