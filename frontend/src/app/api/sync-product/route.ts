import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ML_API = 'https://api.mercadolibre.com'

async function getMlToken(admin: ReturnType<typeof createAdminClient>) {
  const { data } = await admin
    .schema('ml').from('ml_tokens')
    .select('access_token, user_id')
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

// POST /api/sync-product?id=MLU640834497
export async function POST(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const admin = createAdminClient()
  const tokenRow = await getMlToken(admin)
  if (!tokenRow) return NextResponse.json({ error: 'No token' }, { status: 500 })

  const { access_token, user_id } = tokenRow
  const headers = { Authorization: `Bearer ${access_token}` }

  // 1. Fetch current item data from ML
  const itemRes = await fetch(`${ML_API}/items/${id}`, { headers })
  if (!itemRes.ok) {
    return NextResponse.json({ error: `ML error ${itemRes.status}` }, { status: itemRes.status })
  }
  const item = await itemRes.json()

  const updates: Record<string, unknown> = {
    price: item.price ?? null,
    original_price: item.original_price ?? null,
    base_price: item.base_price ?? null,
    available_quantity: item.available_quantity ?? null,
    sold_quantity: item.sold_quantity ?? null,
    status: item.status ?? null,
    health: item.health ?? null,
    synced_at: new Date().toISOString(),
  }

  // 2. Resolve catalog ID (classic catalog or MLUU universal)
  const catalogId: string | null = item.catalog_product_id ?? item.user_product_id ?? null

  if (catalogId) {
    try {
      const catRes = await fetch(`${ML_API}/products/${catalogId}/items`, { headers })
      if (catRes.ok) {
        const catData = await catRes.json()
        const results: Array<{ seller_id: number; price: number }> = catData.results ?? []

        const ourSellerId = Number(item.seller_id ?? user_id)
        const ourItem = results.find(r => r.seller_id === ourSellerId)
        updates.catalog_price = ourItem?.price ?? null

        if (results.length > 0) {
          const buyboxItem = results.reduce((a, b) => a.price <= b.price ? a : b)
          updates.buybox_price = buyboxItem.price
          updates.buybox_seller_id = buyboxItem.seller_id
        }
      }
    } catch { /* skip catalog fetch errors */ }
  }

  // 3. Save to DB
  const { error } = await admin.schema('ml').from('ml_products').update(updates).eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    id,
    price: updates.price,
    catalog_price: updates.catalog_price ?? null,
    buybox_price: updates.buybox_price ?? null,
    buybox_seller_id: updates.buybox_seller_id ?? null,
    catalog_id: catalogId,
  })
}
