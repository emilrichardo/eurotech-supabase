import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchUsdToUyu, convertUsdToUyu } from '@/lib/exchange-rate'

const ML_API = 'https://api.mercadolibre.com'

/**
 * Extract the best possible identifier from a ML URL or ID string.
 * Returns { catalogId, itemId } where catalogId is preferred for competitor tracking
 * (catalog items give price via /products endpoint; direct items may be 403).
 */
function parseInput(input: string): { catalogId: string | null; itemId: string | null } {
  const trimmed = input.trim()
  let catalogId: string | null = null
  let itemId: string | null = null

  try {
    const url = new URL(trimmed)

    // Catalog/collection pages: /p/MLU... or /up/MLUU... in pathname
    const catalogMatch = url.pathname.match(/\/(?:p|up)\/(ML[A-Z]+\d+)/i)
    if (catalogMatch) {
      catalogId = catalogMatch[1].toUpperCase()
    }

    // wid= param in fragment (winning item ID from search results)
    const widMatch = url.hash.match(/[?&]wid=(ML[A-Z]+\d+)/i)
    if (widMatch && !catalogId) itemId = widMatch[1].toUpperCase()

    // Article URL: /MLU-123456789- in pathname
    const articleMatch = url.pathname.match(/\/(ML[A-Z]+)-?(\d+)/i)
    if (!catalogId && !itemId && articleMatch) {
      itemId = (articleMatch[1] + articleMatch[2]).toUpperCase()
    }
  } catch {
    // Not a URL — look for IDs in the raw string
  }

  // Fallback: first ML ID in string (ML + one or more letters + digits)
  if (!catalogId && !itemId) {
    const match = trimmed.match(/ML[A-Z]+\d+/i)
    if (match) itemId = match[0].toUpperCase()
  }

  return { catalogId, itemId }
}

async function fetchSellerName(sellerId: number, accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${ML_API}/users/${sellerId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    return (data.nickname as string) ?? null
  } catch { return null }
}

async function fetchFromCatalog(
  catalogId: string,
  accessToken: string,
  ourSellerId: number | null
): Promise<Record<string, unknown> | null> {
  const headers = { Authorization: `Bearer ${accessToken}` }

  // Determine URL format: MLUU = universal product page (/up/), others = catalog (/p/)
  const isUniversal = catalogId.match(/^ML[A-Z]{2,}/i)
  const permalinkBase = isUniversal
    ? `https://www.mercadolibre.com.uy/up/${catalogId}`
    : `https://www.mercadolibre.com.uy/p/${catalogId}`

  // Try to get product metadata (name, pictures) — may return 403 for some ID formats
  let productData: Record<string, unknown> = {}
  try {
    const productRes = await fetch(`${ML_API}/products/${catalogId}`, { headers })
    if (productRes.ok) productData = await productRes.json()
  } catch { /* skip */ }

  // Get all active listings for this catalog product
  const itemsRes = await fetch(`${ML_API}/products/${catalogId}/items?limit=20`, { headers })
  if (!itemsRes.ok) return null

  const itemsData = await itemsRes.json()
  const results: Array<{
    item_id: string
    seller_id: number
    price: number
    currency_id: string
    condition: string
    listing_type_id: string
  }> = itemsData.results ?? []

  if (results.length === 0) return null

  // Pick cheapest competitor (exclude our own listings)
  const competitors = ourSellerId
    ? results.filter(r => r.seller_id !== ourSellerId)
    : results

  const best = competitors.length > 0
    ? competitors.reduce((a, b) => a.price <= b.price ? a : b)
    : results[0]

  const pictures: Array<{ url?: string }> = (productData.pictures as Array<{ url?: string }>) ?? []
  const thumbnail = pictures[0]?.url ?? null

  const seller_name = await fetchSellerName(best.seller_id, accessToken)

  return {
    id: catalogId,
    title: (productData.name as string) ?? null,
    price: best.price,
    original_price: null,
    currency_id: best.currency_id ?? 'UYU',
    status: 'active',
    condition: best.condition ?? null,
    listing_type_id: best.listing_type_id ?? null,
    category_id: (productData.domain_id as string) ?? null,
    permalink: permalinkBase,
    thumbnail,
    seller_id: best.seller_id,
    seller_name,
  }
}

async function fetchFromItem(
  itemId: string,
  accessToken: string
): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${ML_API}/items/${itemId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  if (data.error || !data.title) return null
  return data
}

export async function POST(req: NextRequest) {
  const { itemIdOrUrl, ourSku } = await req.json()

  const { catalogId, itemId } = parseInput(itemIdOrUrl)
  if (!catalogId && !itemId) {
    return NextResponse.json({ error: 'URL o ID de producto inválido' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: tokenRow } = await admin
    .from('ml_tokens')
    .select('access_token, user_id')
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!tokenRow?.access_token) {
    return NextResponse.json({ error: 'No hay token de MercadoLibre disponible' }, { status: 500 })
  }

  let mlData: Record<string, unknown> | null = null
  let resolvedId: string | null = null

  if (catalogId) {
    // Catalog URL: use /products endpoint (works for competitor items)
    mlData = await fetchFromCatalog(catalogId, tokenRow.access_token, tokenRow.user_id as number | null)
    resolvedId = catalogId
  } else if (itemId) {
    // Direct item: try /items endpoint (only works for our own items)
    mlData = await fetchFromItem(itemId, tokenRow.access_token)
    resolvedId = itemId

    // If blocked (competitor item), suggest using catalog URL
    if (!mlData) {
      return NextResponse.json(
        {
          error: `No se pudo acceder a "${itemId}". Si es un producto de catálogo, pegá la URL del tipo mercadolibre.com.uy/p/MLU... en lugar de la URL del artículo.`,
        },
        { status: 403 }
      )
    }
  }

  if (!mlData || !resolvedId) {
    return NextResponse.json(
      { error: `No se encontró el producto en MercadoLibre.` },
      { status: 404 }
    )
  }

  // Convert USD → UYU if needed
  let usdPrice: number | null = null
  if (mlData.currency_id === 'USD' && typeof mlData.price === 'number') {
    const rate = await fetchUsdToUyu()
    if (rate) {
      usdPrice = mlData.price
      mlData = { ...mlData, price: convertUsdToUyu(mlData.price, rate), currency_id: 'UYU' }
    }
  }

  // Check for duplicate
  const { data: existing } = await admin
    .from('ml_competitor_items')
    .select('id')
    .eq('id', resolvedId)
    .eq('our_sku', ourSku)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Este competidor ya está vinculado a este SKU' }, { status: 409 })
  }

  const record = {
    id: resolvedId,
    our_sku: ourSku,
    title: (mlData.title as string) ?? null,
    price: (mlData.price as number) ?? null,
    original_price: (mlData.original_price as number) ?? null,
    currency_id: (mlData.currency_id as string) ?? 'UYU',
    available_quantity: (mlData.available_quantity as number) ?? null,
    sold_quantity: (mlData.sold_quantity as number) ?? null,
    status: (mlData.status as string) ?? 'active',
    condition: (mlData.condition as string) ?? null,
    listing_type_id: (mlData.listing_type_id as string) ?? null,
    category_id: (mlData.category_id as string) ?? null,
    permalink: (mlData.permalink as string) ?? `https://www.mercadolibre.com.uy/p/${resolvedId}`,
    thumbnail: (mlData.thumbnail as string) ?? null,
    seller_id: (mlData.seller_id as number) ?? null,
    seller_name: (mlData.seller_name as string) ?? null,
    health: (mlData.health as number) ?? null,
    usd_price: usdPrice,
    synced_at: new Date().toISOString(),
  }

  const { error } = await admin.from('ml_competitor_items').upsert(record)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, item: record })
}

export async function PATCH(req: NextRequest) {
  const { itemId, ourSku, paused } = await req.json()
  const admin = createAdminClient()

  const { error } = await admin
    .from('ml_competitor_items')
    .update({ paused })
    .eq('id', itemId)
    .eq('our_sku', ourSku)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { itemId, ourSku } = await req.json()
  const admin = createAdminClient()

  const { error } = await admin
    .from('ml_competitor_items')
    .delete()
    .eq('id', itemId)
    .eq('our_sku', ourSku)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
