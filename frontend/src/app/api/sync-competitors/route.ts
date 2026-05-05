import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchUsdToUyu, convertUsdToUyu } from '@/lib/exchange-rate'

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

type Rule = {
  id: string
  rule_type: string
  sku: string | null
  threshold_pct: number | null
}

type AlertInsert = {
  rule_id: string
  our_sku: string
  competitor_item_id: string
  our_price: number | null
  competitor_price_before: number | null
  competitor_price_after: number | null
  diff_pct: number | null
}

function evaluateRules(
  rules: Rule[],
  item: { id: string; our_sku: string; price: number | null },
  priceBefore: number | null,
  priceAfter: number | null,
  ourPrice: number | null,
): AlertInsert[] {
  if (priceAfter == null) return []

  const priceChanged = priceBefore !== priceAfter

  const diffPct = ourPrice != null && ourPrice > 0
    ? ((ourPrice - priceAfter) / ourPrice) * 100
    : null

  const alerts: AlertInsert[] = []

  for (const rule of rules) {
    // Skip rules scoped to a different SKU
    if (rule.sku && rule.sku !== item.our_sku) continue

    let fires = false
    switch (rule.rule_type) {
      case 'price_changed':
        // Only fire when price actually changed
        fires = priceChanged && priceBefore != null
        break
      case 'competitor_cheaper':
        // Fire whenever competitor is cheaper, regardless of price change
        fires = ourPrice != null && priceAfter < ourPrice
        break
      case 'competitor_pricier':
        // Fire whenever competitor is more expensive, regardless of price change
        fires = ourPrice != null && priceAfter > ourPrice
        break
      case 'price_diff_pct_above':
        // competitor cheaper than us by more than threshold%
        fires = diffPct != null && rule.threshold_pct != null && diffPct > rule.threshold_pct
        break
      case 'price_diff_pct_below':
        // competitor more expensive than us by more than threshold%
        fires = diffPct != null && rule.threshold_pct != null && diffPct < -rule.threshold_pct
        break
    }

    if (fires) {
      alerts.push({
        rule_id: rule.id,
        our_sku: item.our_sku,
        competitor_item_id: item.id,
        our_price: ourPrice,
        competitor_price_before: priceBefore,
        competitor_price_after: priceAfter,
        diff_pct: diffPct,
      })
    }
  }

  return alerts
}

export async function POST() {
  const admin = createAdminClient()
  // Fetch exchange rate once for the whole sync run
  const usdRate = await fetchUsdToUyu()

  const { data: tokenRow } = await admin
    .schema('ml').from('ml_tokens')
    .select('access_token, user_id')
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!tokenRow?.access_token) {
    return NextResponse.json({ error: 'No token disponible' }, { status: 500 })
  }

  const headers = { Authorization: `Bearer ${tokenRow.access_token}` }
  const ourSellerId = tokenRow.user_id as number | null

  // Load competitor items (including current price as "before")
  const { data: items, error } = await admin
    .schema('ml').from('ml_competitor_items')
    .select('id, our_sku, permalink, seller_id, seller_name, price')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!items || items.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 })
  }

  // Load enabled alert rules and our product prices (for diff calculation)
  const [rulesRes, productsRes] = await Promise.all([
    admin.schema('ml').from('ml_price_alert_rules').select('id, rule_type, sku, threshold_pct').eq('enabled', true),
    admin.schema('ml').from('ml_products').select('sku, price').not('sku', 'is', null),
  ])

  const rules: Rule[] = rulesRes.data ?? []
  // Use first non-null price per SKU (multiple rows can share same SKU)
  const ourPriceMap: Record<string, number> = {}
  for (const p of productsRes.data ?? []) {
    if (p.sku && p.price != null && !(p.sku in ourPriceMap)) {
      ourPriceMap[p.sku] = p.price
    }
  }
  console.log(`[sync-competitors] rules=${rules.length} skus_with_price=${Object.keys(ourPriceMap).length}`)

  let updated = 0
  let failed = 0
  const pendingSellerNames: { id: string; our_sku: string; seller_id: number }[] = []
  const alertsToInsert: AlertInsert[] = []

  const BATCH = 10
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH)
    await Promise.all(chunk.map(async (item) => {
      try {
        let updateData: Record<string, unknown> | null = null
        let newSellerId: number | null = null
        let newPrice: number | null = null

        if (isCatalogId(item.id, item.permalink)) {
          const productRes = await fetch(`${ML_API}/products/${item.id}`, { headers })
          const productData = productRes.ok ? await productRes.json() : {}

          const itemsRes = await fetch(`${ML_API}/products/${item.id}/items?limit=20`, { headers })
          if (!itemsRes.ok) {
            console.error(`[sync-competitors] catalog fetch failed id=${item.id} status=${itemsRes.status}`)
            failed++; return
          }

          const itemsData = await itemsRes.json()
          const results: Array<{ seller_id: number; price: number; currency_id: string; condition: string }> =
            itemsData.results ?? []

          if (results.length === 0) {
            console.warn(`[sync-competitors] catalog no results id=${item.id}`)
            failed++; return
          }

          const competitors = ourSellerId
            ? results.filter(r => r.seller_id !== ourSellerId)
            : results
          const best = competitors.length > 0
            ? competitors.reduce((a, b) => a.price <= b.price ? a : b)
            : results[0]

          const pictures: Array<{ url?: string }> = productData.pictures ?? []
          newSellerId = best.seller_id

          // Convert USD → UYU if needed
          let catalogPrice = best.price
          let catalogUsdPrice: number | null = null
          if ((best.currency_id ?? 'UYU') === 'USD' && usdRate) {
            catalogUsdPrice = catalogPrice
            catalogPrice = convertUsdToUyu(catalogPrice, usdRate)
          }
          newPrice = catalogPrice

          updateData = {
            title: productData.name ?? null,
            price: catalogPrice,
            previous_price: item.price ?? null,
            currency_id: 'UYU',
            usd_price: catalogUsdPrice,
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

          // Convert USD → UYU if needed
          let itemPrice = data.price ?? null
          let itemUsdPrice: number | null = null
          if (data.currency_id === 'USD' && itemPrice != null && usdRate) {
            itemUsdPrice = itemPrice
            itemPrice = convertUsdToUyu(itemPrice, usdRate)
          }
          newPrice = itemPrice

          updateData = {
            title: data.title ?? null,
            price: itemPrice,
            previous_price: item.price ?? null,
            original_price: data.original_price ?? null,
            currency_id: data.currency_id === 'USD' ? 'UYU' : (data.currency_id ?? null),
            usd_price: itemUsdPrice,
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

        console.log(`[sync-competitors] item=${item.id} sku=${item.our_sku} prevPrice=${item.price} newPrice=${newPrice} ourPrice=${ourPriceMap[item.our_sku] ?? 'NOT_FOUND'}`)

        const { error: updateError } = await admin
          .schema('ml').from('ml_competitor_items')
          .update(updateData)
          .eq('id', item.id)
          .eq('our_sku', item.our_sku)

        if (updateError) { failed++; return }
        updated++

        // Evaluate alert rules if price changed
        if (newPrice != null && rules.length > 0) {
          const fired = evaluateRules(
            rules,
            item,
            item.price ?? null,
            newPrice,
            ourPriceMap[item.our_sku] ?? null,
          )
          alertsToInsert.push(...fired)
        }

        // Queue seller name if missing or changed
        if (newSellerId && (!item.seller_name || newSellerId !== Number(item.seller_id))) {
          pendingSellerNames.push({ id: item.id, our_sku: item.our_sku, seller_id: newSellerId })
        }
      } catch {
        failed++
      }
    }))
  }

  // Phase 2: insert alerts
  let alertsFired = 0
  let alertError: string | null = null
  console.log(`[sync-competitors] alerts_to_insert=${alertsToInsert.length}`)
  if (alertsToInsert.length > 0) {
    console.log('[sync-competitors] alerts:', JSON.stringify(alertsToInsert))
    const { error } = await admin.schema('ml').from('ml_price_alerts').insert(alertsToInsert)
    if (error) {
      alertError = error.message
      console.error('[sync-competitors] alert insert error:', error.message)
    } else {
      alertsFired = alertsToInsert.length
    }
  }

  // Phase 3: fetch seller names sequentially
  for (const pending of pendingSellerNames) {
    const nickname = await fetchNickname(pending.seller_id, headers)
    if (nickname) {
      await admin
        .schema('ml').from('ml_competitor_items')
        .update({ seller_name: nickname })
        .eq('id', pending.id)
        .eq('our_sku', pending.our_sku)
    }
  }

  return NextResponse.json({
    ok: true,
    updated,
    failed,
    total: items.length,
    alerts_fired: alertsFired,
    alert_error: alertError,
    seller_names_fetched: pendingSellerNames.length,
  })
}
