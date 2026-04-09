import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ML_API = 'https://api.mercadolibre.com'

async function getMlToken(admin: ReturnType<typeof createAdminClient>) {
  const { data } = await admin
    .from('ml_tokens')
    .select('access_token, user_id')
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function POST() {
  const admin = createAdminClient()
  const tokenRow = await getMlToken(admin)
  if (!tokenRow) return NextResponse.json({ error: 'No token' }, { status: 500 })

  const { access_token, user_id } = tokenRow
  const headers = { Authorization: `Bearer ${access_token}` }

  // ── 1. Catalog prices ─────────────────────────────────────────────────────
  // Fetch products that have either catalog_product_id or user_product_id (MLUU universal catalogs)
  const { data: products } = await admin
    .from('ml_products')
    .select('id, catalog_product_id, user_product_id, seller_id')
    .or('catalog_product_id.not.is.null,user_product_id.not.is.null')

  const catalogUpdates: {
    id: string
    catalog_price: number | null
    buybox_price: number | null
    buybox_seller_id: number | null
  }[] = []

  // Batch catalog lookups (25 concurrent max)
  const BATCH = 25
  const items = (products ?? []).filter(p => p.catalog_product_id || p.user_product_id)
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH)
    await Promise.all(chunk.map(async (p) => {
      // Prefer catalog_product_id (classic catalog); fall back to user_product_id (MLUU universal)
      const catalogId = p.catalog_product_id ?? p.user_product_id
      try {
        const res = await fetch(
          `${ML_API}/products/${catalogId}/items`,
          { headers }
        )
        if (!res.ok) return
        const data = await res.json()
        const results: Array<{ seller_id: number; price: number }> = data.results ?? []
        if (results.length === 0) return

        const ourSellerId = Number(p.seller_id ?? user_id)

        // Our price within the catalog (null if we don't participate)
        const ourItem = results.find(r => r.seller_id === ourSellerId)
        const catalog_price = ourItem?.price ?? null

        // Buy-box winner: cheapest across all sellers
        const buyboxItem = results.reduce((a, b) => a.price <= b.price ? a : b)
        const buybox_price = buyboxItem.price
        const buybox_seller_id = buyboxItem.seller_id

        catalogUpdates.push({ id: p.id, catalog_price, buybox_price, buybox_seller_id })
      } catch { /* skip */ }
    }))
  }

  // Upsert catalog prices
  for (const upd of catalogUpdates) {
    await admin
      .from('ml_products')
      .update({
        catalog_price: upd.catalog_price,
        buybox_price: upd.buybox_price,
        buybox_seller_id: upd.buybox_seller_id,
      })
      .eq('id', upd.id)
  }

  // ── 2. Category names ─────────────────────────────────────────────────────
  const { data: allProducts } = await admin
    .from('ml_products')
    .select('category_id')

  const categoryIds = [
    ...new Set((allProducts ?? []).map(p => p.category_id).filter(Boolean)),
  ] as string[]

  const categoryRows: { id: string; name: string; full_path: string }[] = []

  await Promise.all(categoryIds.map(async (catId) => {
    try {
      const res = await fetch(`${ML_API}/categories/${catId}`, { headers })
      if (!res.ok) return
      const data = await res.json()
      if (data.name) {
        const pathParts: string[] = (data.path_from_root ?? []).map((p: { name: string }) => p.name)
        // Remove generic top-level nodes, keep last 2-3 meaningful segments
        const meaningfulPath = pathParts
          .filter((p: string) => !['Uruguay', 'Accesorios para Vehículos', 'Herramientas'].includes(p))
        const full_path = meaningfulPath.join(' › ') || pathParts.join(' › ')
        categoryRows.push({ id: catId, name: data.name, full_path })
      }
    } catch { /* skip */ }
  }))

  if (categoryRows.length > 0) {
    await admin.from('ml_categories').upsert(categoryRows)
  }

  return NextResponse.json({
    ok: true,
    catalog_prices_updated: catalogUpdates.length,
    categories_synced: categoryRows.length,
  })
}
