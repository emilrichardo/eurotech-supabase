import { createAdminClient } from '@/lib/supabase/admin'
import AlertasLayout from './AlertasLayout'

export const dynamic = 'force-dynamic'

export default async function AlertasPage() {
  const admin = createAdminClient()

  const [rulesRes, alertsRes, skusRes] = await Promise.all([
    admin
      .from('ml_price_alert_rules')
      .select('*, ml_price_alerts(count)')
      .order('created_at', { ascending: false }),

    admin
      .from('ml_price_alerts')
      .select(`
        id, our_sku, competitor_item_id,
        our_price, catalog_price, competitor_price_before, competitor_price_after,
        diff_pct, fired_at, read_at,
        ml_price_alert_rules ( id, name, rule_type ),
        ml_competitor_items ( title, seller_name, thumbnail )
      `)
      .order('fired_at', { ascending: false })
      .limit(200),

    admin
      .from('ml_products')
      .select('sku, title, synced_at')
      .not('sku', 'is', null)
      .eq('status', 'active')
      .order('sku')
      .order('synced_at', { ascending: false }),
  ])

  if (rulesRes.error) console.error('[alertas] rules error:', rulesRes.error.message)
  if (alertsRes.error) console.error('[alertas] alerts error:', alertsRes.error.message, alertsRes.error)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rules = (rulesRes.data ?? []) as any[]

  // SKUs de productos activos (solo active, filtrado en DB)
  const activeSkus = new Set((skusRes.data ?? []).map(p => p.sku))

  // Deduplicar: conservar solo la última alerta por SKU (vienen ordenadas DESC)
  // y excluir alertas de productos no activos
  const seenSkus = new Set<string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alerts = ((alertsRes.data ?? []) as any[]).filter((a: any) => {
    if (!activeSkus.has(a.our_sku)) return false
    if (seenSkus.has(a.our_sku)) return false
    seenSkus.add(a.our_sku)
    return true
  })
  console.log(`[alertas] rules=${rules.length} alerts=${alerts.length}`)
  const skus = Array.from(
    new Map(
      (skusRes.data ?? []).map(p => [p.sku, { sku: p.sku as string, title: p.title }])
    ).values()
  )

  const unreadCount = alerts.filter(a => !a.read_at).length

  return (
    <AlertasLayout
      rules={rules}
      alerts={alerts}
      skus={skus}
      unreadCount={unreadCount}
    />
  )
}
