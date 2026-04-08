import { createAdminClient } from '@/lib/supabase/admin'
import ProductsTable from './ProductsTable'

export const dynamic = 'force-dynamic'

export default async function ProductosPage() {
  const supabase = createAdminClient()

  const [productsResult, competitorsResult, categoriesResult] = await Promise.all([
    supabase
      .from('ml_products')
      .select(
        `id, title, subtitle, sku, price, catalog_price, base_price, original_price, currency_id,
         available_quantity, sold_quantity, initial_quantity,
         status, condition, listing_type_id, buying_mode,
         thumbnail, permalink, category_id, domain_id,
         catalog_product_id, seller_custom_field,
         warranty, health, automatic_relist, catalog_listing,
         date_created, last_updated, synced_at, start_time, stop_time,
         shipping, tags, attributes, pictures`,
        { count: 'exact' }
      )
      .order('last_updated', { ascending: false })
      .limit(500),

    supabase
      .from('ml_competitor_items')
      .select('id, our_sku, title, price, currency_id, status, thumbnail, permalink, seller_id, synced_at'),

    supabase
      .from('ml_categories')
      .select('id, name, full_path'),
  ])

  const { data: products, error, count } = productsResult
  const competitors = competitorsResult.data ?? []
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
        </div>
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
