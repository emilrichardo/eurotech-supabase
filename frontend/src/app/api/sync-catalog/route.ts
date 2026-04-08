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
  const { data: products } = await admin
    .from('ml_products')
    .select('id, catalog_product_id, seller_id')
    .not('catalog_product_id', 'is', null)

  const catalogUpdates: { id: string; catalog_price: number }[] = []

  // Batch catalog lookups (25 concurrent max)
  const BATCH = 25
  const items = products ?? []
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH)
    await Promise.all(chunk.map(async (p) => {
      try {
        const res = await fetch(
          `${ML_API}/products/${p.catalog_product_id}/items?status=active`,
          { headers }
        )
        if (!res.ok) return
        const data = await res.json()
        const ourItem = data.results?.find(
          (r: { seller_id: number }) => r.seller_id === (p.seller_id ?? user_id)
        )
        if (ourItem?.price != null) {
          catalogUpdates.push({ id: p.id, catalog_price: ourItem.price })
        }
      } catch { /* skip */ }
    }))
  }

  // Upsert catalog prices
  for (const upd of catalogUpdates) {
    await admin
      .from('ml_products')
      .update({ catalog_price: upd.catalog_price })
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
