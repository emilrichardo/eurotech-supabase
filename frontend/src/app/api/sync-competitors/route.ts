import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ML_API = 'https://api.mercadolibre.com'

function isCatalogId(id: string, permalink: string | null): boolean {
  if (permalink?.includes('/p/') || permalink?.includes('/up/')) return true
  const digits = id.replace(/^ML[A-Z]+/i, '')
  return digits.length >= 10
}

async function fetchNickname(sellerId: number, headers: Record<string, string>): Promise<string | null> {
  try {
    const res = await fetch(`${ML_API}/users/${sellerId}`, { headers })
    if (!res.ok) return null
    const data = await res.json()
    return (data.nickname as string) ?? null
  } catch { return null }
}

export async function POST() {
  const admin = createAdminClient()

  const { data: tokenRow } = await admin
    .from('ml_tokens')
    .select('access_token, user_id')
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!tokenRow?.access_token) {
    return NextResponse.json({ error: 'No token disponible' }, { status: 500 })
  }

  const headers = { Authorization: `Bearer ${tokenRow.access_token}` }
  const ourSellerId = tokenRow.user_id as number | null

  const { data: items, error } = await admin
    .from('ml_competitor_items')
    .select('id, our_sku, permalink, seller_id, seller_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!items || items.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 })
  }

  let updated = 0
  let failed = 0

  // Phase 1: update prices/thumbnails in parallel batches
  type PendingSellerName = { id: string; our_sku: string; seller_id: number }
  const pendingSellerNames: PendingSellerName[] = []

  const BATCH = 10
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH)
    await Promise.all(chunk.map(async (item) => {
      try {
        let updateData: Record<string, unknown> | null = null
        let newSellerId: number | null = null

        if (isCatalogId(item.id, item.permalink)) {
          const productRes = await fetch(`${ML_API}/products/${item.id}`, { headers })
          const productData = productRes.ok ? await productRes.json() : {}

          const itemsRes = await fetch(`${ML_API}/products/${item.id}/items?limit=20`, { headers })
          if (!itemsRes.ok) { failed++; return }

          const itemsData = await itemsRes.json()
          const results: Array<{ seller_id: number; price: number; currency_id: string; condition: string }> =
            itemsData.results ?? []

          if (results.length === 0) { failed++; return }

          const competitors = ourSellerId
            ? results.filter(r => r.seller_id !== ourSellerId)
            : results
          const best = competitors.length > 0
            ? competitors.reduce((a, b) => a.price <= b.price ? a : b)
            : results[0]

          const pictures: Array<{ url?: string }> = productData.pictures ?? []
          newSellerId = best.seller_id

          updateData = {
            title: productData.name ?? null,
            price: best.price,
            currency_id: best.currency_id ?? 'UYU',
            condition: best.condition ?? null,
            thumbnail: pictures[0]?.url ?? null,
            seller_id: best.seller_id,
            status: 'active',
            synced_at: new Date().toISOString(),
          }
        } else {
          const res = await fetch(`${ML_API}/items/${item.id}`, { headers })
          if (!res.ok) { failed++; return }

          const data = await res.json()
          if (!data.title) { failed++; return }

          newSellerId = data.seller_id ?? null

          updateData = {
            title: data.title ?? null,
            price: data.price ?? null,
            original_price: data.original_price ?? null,
            currency_id: data.currency_id ?? null,
            available_quantity: data.available_quantity ?? null,
            sold_quantity: data.sold_quantity ?? null,
            status: data.status ?? null,
            condition: data.condition ?? null,
            thumbnail: data.thumbnail ?? null,
            seller_id: data.seller_id ?? null,
            health: data.health ?? null,
            synced_at: new Date().toISOString(),
          }
        }

        if (!updateData) { failed++; return }

        const { error: updateError } = await admin
          .from('ml_competitor_items')
          .update(updateData)
          .eq('id', item.id)
          .eq('our_sku', item.our_sku)

        if (updateError) { failed++; return }
        updated++

        // Queue seller name fetch if missing or seller changed
        if (newSellerId && (!item.seller_name || newSellerId !== Number(item.seller_id))) {
          pendingSellerNames.push({ id: item.id, our_sku: item.our_sku, seller_id: newSellerId })
        }
      } catch {
        failed++
      }
    }))
  }

  // Phase 2: fetch seller names sequentially to avoid rate limits
  for (const pending of pendingSellerNames) {
    const nickname = await fetchNickname(pending.seller_id, headers)
    if (nickname) {
      await admin
        .from('ml_competitor_items')
        .update({ seller_name: nickname })
        .eq('id', pending.id)
        .eq('our_sku', pending.our_sku)
    }
  }

  return NextResponse.json({ ok: true, updated, failed, total: items.length, seller_names_fetched: pendingSellerNames.length })
}
