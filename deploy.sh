#!/usr/bin/env bash
set -e

PROJECT_REF="ncgvyabucowccaddyjna"

echo "▶ Linking project..."
supabase link --project-ref $PROJECT_REF

echo "▶ Pushing secrets to Supabase..."
# Reemplaza estos valores antes de ejecutar
supabase secrets set \
  ML_CLIENT_ID="your_client_id_here" \
  ML_CLIENT_SECRET="your_client_secret_here" \
  ML_USER_ID="92078889" \
  ML_ACCESS_TOKEN="APP_USR-2833938877527700-032415-366c475540603e045df8ece2163f4f42-92078889" \
  ML_REFRESH_TOKEN="your_refresh_token_here"

echo "▶ Running migrations..."
supabase db push

echo "▶ Deploying edge function..."
supabase functions deploy ml-sync --no-verify-jwt

echo "✅ Deploy completado."
echo ""
echo "📌 Próximos pasos:"
echo "  1. Ir a Supabase Dashboard → Project Settings → API"
echo "  2. Copiar la URL de funciones y el service role key"
echo "  3. Ejecutar en SQL Editor:"
echo "     select set_config('app.supabase_functions_url', 'https://$PROJECT_REF.functions.supabase.co', false);"
echo "     select set_config('app.supabase_service_key', '<tu_service_role_key>', false);"
echo ""
echo "  4. Para insertar el token inicial en la DB, ejecutar en SQL Editor:"
echo "     insert into ml_tokens (access_token, refresh_token, expires_at, user_id)"
echo "     values ('APP_USR-2833938877527700-032415-366c475540603e045df8ece2163f4f42-92078889',"
echo "             'TU_REFRESH_TOKEN',"
echo "             now() + interval '6 hours',"
echo "             92078889);"
