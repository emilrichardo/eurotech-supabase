import { createAdminClient } from '@/lib/supabase/admin'
import TrackingSection from './TrackingSection'

export const dynamic = 'force-dynamic'

export default async function SeguimientoPage() {
  const admin = createAdminClient()

  const [itemsRes, skusRes] = await Promise.all([
    admin
      .from('ml_tracked_items')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false }),

    admin
      .from('ml_products')
      .select('sku, title, thumbnail, price, catalog_price, currency_id')
      .not('sku', 'is', null)
      .not('status', 'in', '("paused","closed")')
      .order('title'),
  ])

  const items = itemsRes.data ?? []
  const skus = Array.from(
    new Map((skusRes.data ?? []).map(p => [p.sku, {
      sku: p.sku as string,
      title: p.title,
      thumbnail: p.thumbnail,
      price: p.price,
      catalog_price: p.catalog_price,
      currency_id: p.currency_id,
    }])).values()
  )

  // Fetch latest 2 snapshots per item for delta display
  const ids = items.map(i => i.id)
  let snapshotRows: Record<string, unknown>[] = []
  if (ids.length > 0) {
    const { data } = await admin
      .from('ml_tracked_snapshots')
      .select('*')
      .in('tracked_item_id', ids)
      .order('scraped_at', { ascending: false })
    snapshotRows = (data ?? []) as Record<string, unknown>[]
  }

  const latestMap = new Map<string, Record<string, unknown>>()
  const prevMap = new Map<string, Record<string, unknown>>()
  for (const snap of snapshotRows) {
    const tid = snap.tracked_item_id as string
    if (!latestMap.has(tid)) { latestMap.set(tid, snap); continue }
    if (!prevMap.has(tid)) prevMap.set(tid, snap)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enriched = items.map((item: any) => ({
    ...item,
    latest_snapshot: latestMap.get(item.id) ?? null,
    prev_snapshot: prevMap.get(item.id) ?? null,
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Seguimiento</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Historial de precio, stock y ventas de productos bajo seguimiento
          </p>
        </div>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <TrackingSection initialItems={enriched as any} skus={skus} />
    </div>
  )
}
