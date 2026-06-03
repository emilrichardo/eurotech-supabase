import { createAdminClient } from '@/lib/supabase/admin'
import AlertasLayout from './AlertasLayout'
import { skuKey } from '@/lib/sku'

export const dynamic = 'force-dynamic'

type RuleType =
  | 'price_changed'
  | 'competitor_cheaper'
  | 'competitor_pricier'
  | 'price_diff_pct_above'
  | 'price_diff_pct_below'

type ProductPriceRow = {
  id: string
  sku: string | null
  title: string
  price: number | null
  sale_price: number | null
  catalog_price: number | null
  synced_at: string | null
}

type AlertRow = {
  our_sku: string
  competitor_price_after: number | null
  diff_pct: number | null
  our_price: number | null
  catalog_price: number | null
  ml_price_alert_rules: {
    rule_type: RuleType
    threshold_pct: number | null
    compare_catalog_price: boolean | null
  } | null
  ml_competitor_items: {
    our_product_id: string | null
    price: number | null
    paused: boolean | null
    status: string | null
  } | null
}

function resolveAlertProduct(
  alert: AlertRow,
  productById: Map<string, ProductPriceRow>,
  productBySku: Map<string, ProductPriceRow>,
) {
  const ownerProductId = alert.ml_competitor_items?.our_product_id
  if (ownerProductId && productById.has(ownerProductId)) return productById.get(ownerProductId) ?? null
  return productBySku.get(skuKey(alert.our_sku) ?? '') ?? null
}

function getAlertOwnerKey(alert: AlertRow) {
  return alert.ml_competitor_items?.our_product_id ?? skuKey(alert.our_sku) ?? `sku:${alert.our_sku}`
}

function resolveReferencePrice(
  rule: AlertRow['ml_price_alert_rules'],
  product: ProductPriceRow,
): number | null {
  if (product.sale_price != null) return product.sale_price
  if (rule?.compare_catalog_price !== false && product.catalog_price != null) return product.catalog_price
  return product.price
}

function calcDiffPct(ourPrice: number | null, competitorPrice: number | null) {
  if (ourPrice == null || ourPrice === 0 || competitorPrice == null) return null
  return Number((((ourPrice - competitorPrice) / ourPrice) * 100).toFixed(2))
}

function isAlertStillCurrent(alert: AlertRow, product: ProductPriceRow) {
  const rule = alert.ml_price_alert_rules
  const competitor = alert.ml_competitor_items
  const competitorPrice = competitor?.price ?? alert.competitor_price_after
  const refPrice = resolveReferencePrice(rule, product)

  alert.our_price = refPrice
  alert.catalog_price = product.catalog_price
  alert.competitor_price_after = competitorPrice ?? null
  alert.diff_pct = calcDiffPct(refPrice, competitorPrice ?? null)

  if (!rule) return false
  if (competitor?.paused || competitor?.status === 'paused' || competitor?.status === 'closed') return false
  if (competitorPrice == null) return false

  switch (rule.rule_type) {
    case 'price_changed':
      return true
    case 'competitor_cheaper':
      return refPrice != null && competitorPrice < refPrice
    case 'competitor_pricier':
      return refPrice != null && competitorPrice > refPrice
    case 'price_diff_pct_above':
      return alert.diff_pct != null && rule.threshold_pct != null && alert.diff_pct >= rule.threshold_pct
    case 'price_diff_pct_below':
      return alert.diff_pct != null && rule.threshold_pct != null && alert.diff_pct <= -rule.threshold_pct
    default:
      return false
  }
}

export default async function AlertasPage() {
  const admin = createAdminClient()

  const [rulesRes, alertsRes, skusRes] = await Promise.all([
    admin
      .schema('ml').from('ml_price_alert_rules')
      .select('*, ml_price_alerts(count)')
      .order('created_at', { ascending: false }),

    admin
      .schema('ml').from('ml_price_alerts')
      .select(`
        id, our_sku, competitor_item_id,
        our_price, catalog_price, competitor_price_before, competitor_price_after,
        diff_pct, fired_at, read_at,
        ml_price_alert_rules ( id, name, rule_type, threshold_pct, compare_catalog_price ),
        ml_competitor_items ( title, seller_name, thumbnail, price, paused, status, our_product_id )
      `)
      .order('fired_at', { ascending: false })
      .limit(200),

    admin
      .schema('ml').from('ml_products')
      .select('id, sku, title, price, sale_price, catalog_price, synced_at')
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
  const productById = new Map<string, ProductPriceRow>()
  const productBySku = new Map<string, ProductPriceRow>()
  for (const p of (skusRes.data ?? []) as ProductPriceRow[]) {
    productById.set(p.id, p)
    const key = skuKey(p.sku)
    if (key && !productBySku.has(key)) productBySku.set(key, p)
  }

  // Deduplicar por publicación cuando exista our_product_id; si no, fallback a SKU.
  const seenOwners = new Set<string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alerts = ((alertsRes.data ?? []) as any[]).filter((a: any) => {
    const product = resolveAlertProduct(a as AlertRow, productById, productBySku)
    if (!product) return false
    if (!isAlertStillCurrent(a as AlertRow, product)) return false
    const ownerKey = getAlertOwnerKey(a as AlertRow)
    if (seenOwners.has(ownerKey)) return false
    seenOwners.add(ownerKey)
    a.owner_product_id = (a as AlertRow).ml_competitor_items?.our_product_id ?? product.id
    a.owner_title = product.title
    a.owner_lookup = (a as AlertRow).ml_competitor_items?.our_product_id ?? a.our_sku
    return true
  })
  console.log(`[alertas] rules=${rules.length} alerts=${alerts.length}`)
  // Quedarse con el título del listing más reciente (el primero que aparezca por SKU)
  const skuTitles = new Map<string, { sku: string; title: string }>()
  for (const p of skusRes.data ?? []) {
    const key = skuKey(p.sku)
    if (key && !skuTitles.has(key) && p.sku) skuTitles.set(key, { sku: p.sku, title: p.title })
  }
  const skus = Array.from(skuTitles.values())

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
