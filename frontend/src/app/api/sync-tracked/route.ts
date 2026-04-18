import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ML_API = 'https://api.mercadolibre.com'

interface MLItemBody {
  id: string
  price: number | null
  original_price: number | null
  sale_price: { amount?: number; price_id?: string } | null
  available_quantity: number | null
  sold_quantity: number | null
  status: string | null
  health: number | null
  title: string | null
  thumbnail: string | null
  seller_id: number | null
  permalink: string | null
}

async function tryRefreshToken(admin: ReturnType<typeof createAdminClient>): Promise<string | null> {
  console.log('[sync-tracked] intentando renovar token via ml-sync...')
  try {
    const { error } = await admin.functions.invoke('ml-sync', { method: 'POST' })
    if (error) console.warn('[sync-tracked] ml-sync invoke error:', error.message)
    else console.log('[sync-tracked] ml-sync invocado OK')
  } catch (e) {
    console.warn('[sync-tracked] ml-sync invoke exception:', e)
  }
  const { data } = await admin
    .from('ml_tokens')
    .select('access_token')
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.access_token ?? null
}

export async function POST() {
  const admin = createAdminClient()

  const { data: tokenRow } = await admin
    .from('ml_tokens')
    .select('access_token')
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!tokenRow?.access_token) {
    return NextResponse.json({ error: 'No token ML disponible. Renovar autenticación.' }, { status: 500 })
  }

  let accessToken = tokenRow.access_token
  const mlHeaders = { Authorization: `Bearer ${accessToken}` }

  // Load active tracked items
  const { data: items, error: itemsError } = await admin
    .from('ml_tracked_items')
    .select('id, ml_item_id')
    .eq('active', true)

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })
  if (!items || items.length === 0) {
    return NextResponse.json({ success: true, scraped: 0, snapshots_stored: 0 })
  }

  console.log(`[sync-tracked] items activos: ${items.length}`, items.map(i => i.ml_item_id))

  // Load latest snapshot per item (for change detection)
  const trackedIds = items.map(i => i.id)
  const { data: allSnapshots, error: snapLoadError } = await admin
    .from('ml_tracked_snapshots')
    .select('tracked_item_id, price, sale_price, original_price, available_quantity, sold_quantity, status')
    .in('tracked_item_id', trackedIds)
    .order('scraped_at', { ascending: false })
  if (snapLoadError) console.error('[sync-tracked] error cargando snapshots previos:', snapLoadError.message)

  type LatestSnapshot = { tracked_item_id: string; price: number | null; sale_price: number | null; original_price: number | null; available_quantity: number | null; sold_quantity: number | null; status: string | null }
  const latestMap = new Map<string, LatestSnapshot>()
  for (const snap of (allSnapshots ?? []) as LatestSnapshot[]) {
    if (!latestMap.has(snap.tracked_item_id)) latestMap.set(snap.tracked_item_id, snap)
  }

  let snapshotsStored = 0
  const now = new Date().toISOString()

  const CONCURRENCY = 5
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY)
    await Promise.all(batch.map(async (item) => {
      try {
        // Catalog product IDs have >= 10 digits (e.g. MLUU catalog items)
        const digits = item.ml_item_id.replace(/^ML[A-Z]+/i, '')
        const isCatalog = digits.length >= 10

        async function fetchItem(headers: Record<string, string>): Promise<MLItemBody | null> {
          if (isCatalog) {
            const res = await fetch(`${ML_API}/products/${item.ml_item_id}/items?limit=20`, { headers })
            if (!res.ok) return null
            const data = await res.json()
            const results: Array<{ item_id: string; price: number }> = data.results ?? []
            if (results.length === 0) return null
            const best = results.reduce((a, b) => a.price <= b.price ? a : b)
            let title: string | null = null
            let thumbnail: string | null = null
            const prodRes = await fetch(`${ML_API}/products/${item.ml_item_id}`, { headers })
            if (prodRes.ok) {
              const pd = await prodRes.json()
              title = pd.name ?? null
              thumbnail = (pd.pictures?.[0] as { url?: string } | undefined)?.url ?? null
            }
            return { id: item.ml_item_id, price: best.price, sale_price: null, original_price: null, available_quantity: null, sold_quantity: null, status: 'active', health: null, title, thumbnail, seller_id: null, permalink: null }
          } else {
            const res = await fetch(`${ML_API}/items/${item.ml_item_id}`, { headers })
            if (!res.ok) return null
            return await res.json() as MLItemBody
          }
        }

        let body = await fetchItem(mlHeaders)

        // If auth failed, try to refresh token once and retry
        if (body === null) {
          const freshToken = await tryRefreshToken(admin)
          if (freshToken && freshToken !== accessToken) {
            accessToken = freshToken
            mlHeaders.Authorization = `Bearer ${freshToken}`
            body = await fetchItem(mlHeaders)
          }
          // Last resort: try without auth (public items only)
          if (body === null && !isCatalog) {
            const res = await fetch(`${ML_API}/items/${item.ml_item_id}`)
            if (res.ok) body = await res.json() as MLItemBody
          }
        }

        if (!body) {
          console.error(`[sync-tracked] no se pudo obtener datos para ${item.ml_item_id}`)
          return
        }

        const salePrice = body.sale_price?.amount ?? null

        console.log(`[sync-tracked] ${item.ml_item_id}: price=${body.price} original_price=${body.original_price} sale_price=${salePrice} stock=${body.available_quantity} sold=${body.sold_quantity} status=${body.status}`)

        const latest = latestMap.get(item.id)
        const changed = !latest ||
          latest.price !== body.price ||
          latest.sale_price !== salePrice ||
          latest.original_price !== (body.original_price ?? null) ||
          latest.available_quantity !== body.available_quantity ||
          latest.sold_quantity !== body.sold_quantity ||
          latest.status !== body.status

        if (changed) {
          const { error: snapError } = await admin.from('ml_tracked_snapshots').insert({
            tracked_item_id: item.id,
            price: body.price ?? null,
            original_price: body.original_price ?? null,
            sale_price: salePrice,
            available_quantity: body.available_quantity ?? null,
            sold_quantity: body.sold_quantity ?? null,
            status: body.status ?? null,
            health: body.health ?? null,
          })
          if (snapError) console.error(`[sync-tracked] Error snapshot ${item.ml_item_id}:`, snapError.message)
          else snapshotsStored++
        }

        if (body.title) {
          await admin
            .from('ml_tracked_items')
            .update({ title: body.title, thumbnail: body.thumbnail ?? null, last_scraped_at: now })
            .eq('id', item.id)
        }
      } catch (e) {
        console.error(`[sync-tracked] exception for ${item.ml_item_id}:`, e)
      }
    }))
  }

  return NextResponse.json({ success: true, scraped: items.length, snapshots_stored: snapshotsStored })
}
