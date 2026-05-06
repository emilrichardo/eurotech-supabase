import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ML_API = 'https://api.mercadolibre.com'

type Attribute = {
  id?: string
  name?: string
  value_name?: string | null
}

type ProductRow = {
  id: string
  title: string | null
  subtitle: string | null
  sku: string | null
  descriptions: unknown
  attributes: Attribute[] | null
  category_id: string | null
  domain_id: string | null
  price: number | null
  sale_price: number | null
  catalog_price: number | null
  currency_id: string | null
}

function compactText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function attributesToText(attributes: Attribute[] | null) {
  if (!Array.isArray(attributes)) return null
  const parts = attributes
    .map((attr) => {
      const name = attr.name ?? attr.id
      const value = attr.value_name
      if (!name || !value) return null
      return `${name}: ${value}`
    })
    .filter(Boolean)
    .slice(0, 20)

  return parts.length > 0 ? parts.join('; ') : null
}

function descriptionsToText(descriptions: unknown): string | null {
  if (!descriptions) return null
  if (typeof descriptions === 'string') return compactText(descriptions)

  if (Array.isArray(descriptions)) {
    const text = descriptions
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const maybeText = item as { plain_text?: unknown; text?: unknown; id?: unknown }
        if (typeof maybeText.plain_text === 'string') return maybeText.plain_text
        if (typeof maybeText.text === 'string') return maybeText.text
        if (typeof maybeText.id === 'string') return maybeText.id
        return null
      })
      .filter(Boolean)
      .join(' ')
    return text ? compactText(text) : null
  }

  if (typeof descriptions === 'object') {
    const maybeText = descriptions as { plain_text?: unknown; text?: unknown }
    if (typeof maybeText.plain_text === 'string') return compactText(maybeText.plain_text)
    if (typeof maybeText.text === 'string') return compactText(maybeText.text)
  }

  return null
}

async function fetchMlDescription(itemId: string, accessToken?: string | null) {
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined

  async function request(withAuth: boolean) {
    const res = await fetch(`${ML_API}/items/${itemId}/description`, {
      headers: withAuth ? headers : undefined,
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = typeof data.plain_text === 'string'
      ? data.plain_text
      : typeof data.text === 'string'
        ? data.text
        : null
    return text ? compactText(text).slice(0, 3500) : null
  }

  return (accessToken ? await request(true) : null) ?? await request(false)
}

export async function POST(req: NextRequest) {
  const { productId, limit } = await req.json()
  if (typeof productId !== 'string' || !productId.trim()) {
    return NextResponse.json({ error: 'productId es requerido' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Faltan variables de Supabase en el servidor' }, { status: 500 })
  }

  const admin = createAdminClient()
  const { data: product, error: productError } = await admin
    .schema('ml').from('ml_products')
    .select(
      `id, title, subtitle, sku, descriptions, attributes,
       category_id, domain_id, price, sale_price, catalog_price, currency_id`
    )
    .eq('id', productId.trim())
    .maybeSingle<ProductRow>()

  if (productError) return NextResponse.json({ error: productError.message }, { status: 500 })
  if (!product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  if (!product.title) return NextResponse.json({ error: 'El producto no tiene titulo' }, { status: 400 })

  const skuKey = product.sku ?? product.id

  const [tokenResult, competitorsResult] = await Promise.all([
    admin
      .schema('ml').from('ml_tokens')
      .select('access_token')
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ access_token: string }>(),
    admin
      .schema('ml').from('ml_competitor_items')
      .select('id, permalink')
      .eq('our_sku', skuKey),
  ])

  const mlDescription = await fetchMlDescription(product.id, tokenResult.data?.access_token)
  const localDescription = [
    product.subtitle,
    descriptionsToText(product.descriptions),
    attributesToText(product.attributes),
  ].filter(Boolean).join(' | ')

  const edgeRes = await fetch(`${supabaseUrl}/functions/v1/ml-search-rivals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'x-rival-search-secret': serviceKey,
    },
    body: JSON.stringify({
      productId: product.id,
      sku: skuKey,
      title: product.title,
      description: mlDescription ?? (localDescription || null),
      categoryId: product.category_id,
      domainId: product.domain_id,
      price: product.sale_price ?? product.catalog_price ?? product.price,
      currencyId: product.currency_id,
      existingCompetitorIds: (competitorsResult.data ?? []).map((item) => item.id).filter(Boolean),
      existingCompetitorUrls: (competitorsResult.data ?? []).map((item) => item.permalink).filter(Boolean),
      limit: typeof limit === 'number' ? limit : 8,
    }),
  })

  const text = await edgeRes.text()
  let body: unknown
  try { body = JSON.parse(text) } catch { body = { error: text } }

  if (!edgeRes.ok) {
    const message = body && typeof body === 'object' && 'error' in body
      ? String((body as { error: unknown }).error)
      : body && typeof body === 'object' && 'message' in body
        ? String((body as { message: unknown }).message)
        : 'No se pudo buscar rivales'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  return NextResponse.json(body)
}
