import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ML_API = 'https://api.mercadolibre.com'

function parseMLId(input: string): { catalogId: string | null; itemId: string | null } {
  const trimmed = input.trim()
  let catalogId: string | null = null
  let itemId: string | null = null
  try {
    const url = new URL(trimmed)
    const catalogMatch = url.pathname.match(/\/(?:p|up)\/(ML[A-Z]+\d+)/i)
    if (catalogMatch) catalogId = catalogMatch[1].toUpperCase()
    if (!catalogId) {
      const articleMatch = url.pathname.match(/\/(ML[A-Z]+)-?(\d+)/i)
      if (articleMatch) itemId = (articleMatch[1] + articleMatch[2]).toUpperCase()
    }
  } catch { /* not a URL */ }
  if (!catalogId && !itemId) {
    const match = trimmed.match(/ML[A-Z]+\d+/i)
    if (match) itemId = match[0].toUpperCase()
  }
  return { catalogId, itemId }
}

export async function GET() {
  const admin = createAdminClient()

  // Items with latest 2 snapshots (for delta calculation)
  const { data: items, error } = await admin
    .from('ml_tracked_items')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch latest 2 snapshots per item
  const ids = (items ?? []).map((i) => i.id)
  if (ids.length === 0) return NextResponse.json([])

  const { data: snapshots } = await admin
    .from('ml_tracked_snapshots')
    .select('*')
    .in('tracked_item_id', ids)
    .order('scraped_at', { ascending: false })

  // Build latest + prev snapshot maps
  const latestMap = new Map<string, Record<string, unknown>>()
  const prevMap = new Map<string, Record<string, unknown>>()
  for (const snap of snapshots ?? []) {
    const tid = snap.tracked_item_id as string
    if (!latestMap.has(tid)) { latestMap.set(tid, snap); continue }
    if (!prevMap.has(tid)) prevMap.set(tid, snap)
  }

  const result = (items ?? []).map((item) => ({
    ...item,
    latest_snapshot: latestMap.get(item.id) ?? null,
    prev_snapshot: prevMap.get(item.id) ?? null,
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const { url, ourSku } = await req.json()
  if (!url) return NextResponse.json({ error: 'url es requerido' }, { status: 400 })

  const { catalogId, itemId } = parseMLId(url)
  if (!catalogId && !itemId) {
    return NextResponse.json({ error: 'URL o ID de MercadoLibre inválido' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: tokenRow } = await admin
    .from('ml_tokens')
    .select('access_token, user_id')
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!tokenRow?.access_token) {
    return NextResponse.json({ error: 'No hay token ML disponible' }, { status: 500 })
  }

  const token = tokenRow.access_token
  let mlItemId: string | null = null
  let title: string | null = null
  let thumbnail: string | null = null
  let sellerName: string | null = null
  let sellerId: number | null = null
  let price: number | null = null
  let availableQty: number | null = null
  let soldQty: number | null = null
  let status: string | null = null
  let health: number | null = null
  let originalPrice: number | null = null
  let resolvedUrl: string | null = url

  if (catalogId) {
    // Catalog: resolve to cheapest competitor item
    const res = await fetch(`${ML_API}/products/${catalogId}/items?limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return NextResponse.json({ error: 'No se pudo resolver el producto de catálogo' }, { status: 404 })
    const data = await res.json()
    const results: Array<{ item_id: string; seller_id: number; price: number }> = data.results ?? []
    if (results.length === 0) return NextResponse.json({ error: 'Sin resultados para este catálogo' }, { status: 404 })

    const best = results.reduce((a, b) => a.price <= b.price ? a : b)
    mlItemId = best.item_id
    sellerId = best.seller_id

    // Get product name
    const productRes = await fetch(`${ML_API}/products/${catalogId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (productRes.ok) {
      const pd = await productRes.json()
      title = pd.name ?? null
      const pics: Array<{ url?: string }> = pd.pictures ?? []
      thumbnail = pics[0]?.url ?? null
    }
    resolvedUrl = `https://www.mercadolibre.com.uy/p/${catalogId}`
  } else {
    mlItemId = itemId
  }

  if (!mlItemId) return NextResponse.json({ error: 'No se pudo resolver el ID del item' }, { status: 400 })

  // Fetch item details
  const itemRes = await fetch(
    `${ML_API}/items/${mlItemId}?attributes=id,title,price,original_price,available_quantity,sold_quantity,status,health,thumbnail,seller_id,permalink`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (itemRes.ok) {
    const d = await itemRes.json()
    if (!title) title = d.title ?? null
    if (!thumbnail) thumbnail = d.thumbnail ?? null
    if (!sellerId) sellerId = d.seller_id ?? null
    price = d.price ?? null
    originalPrice = d.original_price ?? null
    availableQty = d.available_quantity ?? null
    soldQty = d.sold_quantity ?? null
    status = d.status ?? null
    health = d.health ?? null
    if (d.permalink) resolvedUrl = d.permalink
  }

  // Fetch seller name
  if (sellerId) {
    const sellerRes = await fetch(`${ML_API}/users/${sellerId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (sellerRes.ok) {
      const sd = await sellerRes.json()
      sellerName = sd.nickname ?? null
    }
  }

  // Check duplicate
  const { data: existing } = await admin
    .from('ml_tracked_items')
    .select('id, active')
    .eq('ml_item_id', mlItemId)
    .maybeSingle()

  if (existing) {
    // Reactivate if was inactive
    if (!existing.active) {
      await admin.from('ml_tracked_items').update({ active: true, our_sku: ourSku ?? null }).eq('id', existing.id)
      return NextResponse.json({ ok: true, id: existing.id, reactivated: true })
    }
    return NextResponse.json({ error: 'Este producto ya está siendo seguido' }, { status: 409 })
  }

  // Insert tracked item
  const { data: inserted, error: insertError } = await admin
    .from('ml_tracked_items')
    .insert({
      ml_item_id: mlItemId,
      url: resolvedUrl,
      title,
      thumbnail,
      seller_name: sellerName,
      seller_id: sellerId,
      our_sku: ourSku ?? null,
    })
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // Store initial snapshot
  await admin.from('ml_tracked_snapshots').insert({
    tracked_item_id: inserted.id,
    price,
    original_price: originalPrice,
    available_quantity: availableQty,
    sold_quantity: soldQty,
    status,
    health,
  })

  return NextResponse.json({ ok: true, item: inserted })
}
