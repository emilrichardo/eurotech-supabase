import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const unread = searchParams.get('unread') === 'true'
  const sku = searchParams.get('sku')
  const limit = Number(searchParams.get('limit') ?? 100)

  const admin = createAdminClient()

  let query = admin
    .from('ml_price_alerts')
    .select(`
      id, our_sku, competitor_item_id,
      our_price, catalog_price, competitor_price_before, competitor_price_after,
      diff_pct, fired_at, read_at,
      ml_price_alert_rules ( id, name, rule_type ),
      ml_competitor_items ( title, seller_name, thumbnail )
    `)
    .order('fired_at', { ascending: false })
    .limit(limit)

  if (unread) query = query.is('read_at', null)
  if (sku) query = query.eq('our_sku', sku)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  // Delete all read alerts
  const admin = createAdminClient()
  const { error } = await admin
    .from('ml_price_alerts')
    .delete()
    .not('read_at', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
