import { createAdminClient } from '@/lib/supabase/admin'
import ProductsTable from './ProductsTable'

export const dynamic = 'force-dynamic'

export default async function ProductosPage() {
  const supabase = createAdminClient()

  const { data: products, error, count } = await supabase
    .from('ml_products')
    .select(
      `id, title, subtitle, sku, price, base_price, original_price, currency_id,
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
    .limit(500)

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
        <ProductsTable products={products as any} count={count ?? 0} />
      )}
    </div>
  )
}
