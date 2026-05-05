import { createAdminClient } from '@/lib/supabase/admin'
import ProductsTable from './ProductsTable'
import SyncButton from './SyncButton'

export const dynamic = 'force-dynamic'

export default async function ProductosPage() {
  const supabase = createAdminClient()

  const [productsResult, competitorsResult, categoriesResult, lastProductSyncResult, lastCompetitorSyncResult] = await Promise.all([
    // List query: exclude heavy JSONB fields (pictures, shipping, tags, attributes).
    // Those are only needed in the detail panel and are fetched on-demand via
    // /api/product-panel/[sku] when a row is clicked.
    supabase
      .schema('ml').from('ml_products')
      .select(
        `id, title, subtitle, sku, price, sale_price, catalog_price, buybox_price, buybox_seller_id, base_price, original_price, currency_id,
         available_quantity, sold_quantity, initial_quantity,
         status, condition, listing_type_id, buying_mode,
         thumbnail, permalink, category_id, domain_id,
         catalog_product_id, seller_custom_field,
         warranty, health, automatic_relist, catalog_listing,
         date_created, last_updated, synced_at, start_time, stop_time`,
        { count: 'exact' }
      )
      .neq('status', 'closed')
      .order('last_updated', { ascending: false })
      .limit(5000),

    supabase
      .schema('ml').from('ml_competitor_items')
      .select('id, our_sku, title, price, currency_id, usd_price, status, thumbnail, permalink, seller_id, seller_name, synced_at, paused'),

    supabase
      .schema('ml').from('ml_categories')
      .select('id, name, full_path'),

    supabase
      .schema('ml').from('ml_products')
      .select('synced_at')
      .order('synced_at', { ascending: false })
      .limit(1)
      .single(),

    supabase
      .schema('ml').from('ml_competitor_items')
      .select('synced_at')
      .order('synced_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  const { data: products, error, count } = productsResult
  const competitors = competitorsResult.data ?? []
  const lastProductSync = lastProductSyncResult.data?.synced_at ?? null
  const lastCompetitorSync = lastCompetitorSyncResult.data?.synced_at ?? null
  const categoryMap: Record<string, string> = {}
  for (const c of categoriesResult.data ?? []) {
    categoryMap[c.id] = c.full_path ?? c.name
  }

  // Group competitors by our_sku
  const competitorsBySku: Record<string, typeof competitors> = {}
  for (const c of competitors) {
    if (!competitorsBySku[c.our_sku]) competitorsBySku[c.our_sku] = []
    competitorsBySku[c.our_sku].push(c)
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Productos</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          Error al cargar productos: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-500 text-sm mt-0.5">{count ?? 0} publicaciones</p>
          <div className="flex items-center gap-4 mt-1.5">
            <span className="text-xs text-gray-400">
              Propios:{' '}
              <span className="text-gray-600 font-medium">
                {lastProductSync
                  ? new Intl.DateTimeFormat('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(lastProductSync))
                  : 'Nunca'}
              </span>
            </span>
            <span className="text-gray-200 select-none">·</span>
            <span className="text-xs text-gray-400">
              Competencia:{' '}
              <span className="text-gray-600 font-medium">
                {lastCompetitorSync
                  ? new Intl.DateTimeFormat('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(lastCompetitorSync))
                  : 'Nunca'}
              </span>
            </span>
          </div>
        </div>
        <SyncButton />
      </div>

      {!products || products.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          No hay productos sincronizados aún.
        </div>
      ) : (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <ProductsTable
          products={products as any}
          count={count ?? 0}
          competitorsBySku={competitorsBySku as any}
          categoryMap={categoryMap}
        />
      )}
    </div>
  )
}
