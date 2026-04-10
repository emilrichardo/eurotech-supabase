import { createAdminClient } from '@/lib/supabase/admin'
import RulesSection from './RulesSection'
import HistorySection from './HistorySection'

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
        our_price, competitor_price_before, competitor_price_after,
        diff_pct, fired_at, read_at,
        ml_price_alert_rules ( id, name, rule_type ),
        ml_competitor_items ( title, seller_name, thumbnail )
      `)
      .order('fired_at', { ascending: false })
      .limit(200),

    admin
      .from('ml_products')
      .select('sku, title')
      .not('sku', 'is', null)
      .order('sku'),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rules = (rulesRes.data ?? []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alerts = (alertsRes.data ?? []) as any[]
  const skus = (skusRes.data ?? []).map(p => ({ sku: p.sku as string, title: p.title }))

  const unreadCount = alerts.filter(a => !a.read_at).length

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alertas de precio</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gestioná reglas y revisá alertas disparadas por cambios en precios de competidores
          </p>
        </div>
        {unreadCount > 0 && (
          <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
            {unreadCount} sin leer
          </span>
        )}
      </div>

      <RulesSection initialRules={rules} skus={skus} />
      <HistorySection initialAlerts={alerts} skus={skus} />
    </div>
  )
}
