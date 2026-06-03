import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sku: string }> }
) {
  const { sku: ownerLookup } = await params
  const admin = createAdminClient()

  const [byIdActiveRes, byIdAnyRes, byIdCompetitorsRes] = await Promise.all([
    admin
      .schema('ml').from('ml_products')
      .select('id, title, sku, price, sale_price, catalog_price, buybox_price, status, thumbnail, permalink, currency_id, available_quantity, pictures')
      .eq('id', ownerLookup)
      .eq('status', 'active')
      .maybeSingle(),
    admin
      .schema('ml').from('ml_products')
      .select('id, title, sku, price, sale_price, catalog_price, buybox_price, status, thumbnail, permalink, currency_id, available_quantity, pictures')
      .eq('id', ownerLookup)
      .maybeSingle(),
    admin
      .schema('ml').from('ml_competitor_items')
      .select('id, title, price, currency_id, usd_price, thumbnail, permalink, seller_name, status, paused')
      .eq('our_product_id', ownerLookup),
  ])

  const productById = byIdActiveRes.data ?? byIdAnyRes.data
  if (productById) {
    return NextResponse.json({
      product: productById,
      competitors: byIdCompetitorsRes.data ?? [],
    })
  }

  const [activeRes, anyRes, competitorsRes] = await Promise.all([
    admin
      .schema('ml').from('ml_products')
      .select('id, title, sku, price, sale_price, catalog_price, buybox_price, status, thumbnail, permalink, currency_id, available_quantity, pictures')
      .ilike('sku', ownerLookup)
      .eq('status', 'active')
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .schema('ml').from('ml_products')
      .select('id, title, sku, price, sale_price, catalog_price, buybox_price, status, thumbnail, permalink, currency_id, available_quantity, pictures')
      .ilike('sku', ownerLookup)
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .schema('ml').from('ml_competitor_items')
      .select('id, title, price, currency_id, usd_price, thumbnail, permalink, seller_name, status, paused')
      .eq('our_sku', ownerLookup),
  ])

  // Preferir el producto activo; si no hay, caer al más reciente (pausado/etc)
  const productRes = activeRes.data ? activeRes : anyRes

  return NextResponse.json({
    product: productRes.data ?? null,
    competitors: competitorsRes.data ?? [],
  })
}
