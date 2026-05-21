import { createAdminClient } from '@/lib/supabase/admin'
import ProductsTable from './ProductsTable'
import SyncButton from './SyncButton'

export const dynamic = 'force-dynamic'

type ProductsTableProps = Parameters<typeof ProductsTable>[0]

const PRODUCT_SELECT = `id, title, subtitle, sku, price, sale_price, catalog_price, buybox_price, buybox_seller_id, base_price, original_price, currency_id,
 available_quantity, sold_quantity, initial_quantity,
 status, condition, listing_type_id, buying_mode,
 thumbnail, permalink, category_id, domain_id,
 catalog_product_id, parent_item_id, family_id, family_name, user_product_id, inventory_id, seller_custom_field,
 warranty, health, automatic_relist, catalog_listing,
 date_created, last_updated, synced_at, start_time, stop_time`

const COMPETITOR_SELECT = 'id, our_sku, our_product_id, title, price, currency_id, usd_price, status, thumbnail, permalink, seller_id, seller_name, synced_at, paused'
const MAX_PRODUCTS = 200

async function fetchAllProducts(supabase: ReturnType<typeof createAdminClient>) {
  const { data, error, count } = await supabase
    .schema('ml').from('ml_products')
    .select(PRODUCT_SELECT, { count: 'exact' })
    .neq('status', 'closed')
    .neq('status', 'under_review')
    .order('last_updated', { ascending: false })
    .range(0, MAX_PRODUCTS - 1)

  return { data: data ?? [], error, count: count ?? data?.length ?? 0 }
}

async function fetchCompetitorsForProducts(
  supabase: ReturnType<typeof createAdminClient>,
  products: Array<{ id: string; sku: string | null }>
) {
  const productIds = products.map(product => product.id)
  const skus = Array.from(new Set(products.map(product => product.sku).filter(Boolean))) as string[]
  const deduped = new Map<string, unknown>()

  if (productIds.length === 0 && skus.length === 0) {
    return { data: [], error: null }
  }

  const chunkSize = 100

  for (let i = 0; i < productIds.length; i += chunkSize) {
    const chunk = productIds.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .schema('ml').from('ml_competitor_items')
      .select(COMPETITOR_SELECT)
      .in('our_product_id', chunk)

    if (error) return { data: Array.from(deduped.values()), error }
    for (const item of data ?? []) {
      deduped.set(`${item.id}:${item.our_product_id ?? ''}:${item.our_sku ?? ''}`, item)
    }
  }

  for (let i = 0; i < skus.length; i += chunkSize) {
    const chunk = skus.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .schema('ml').from('ml_competitor_items')
      .select(COMPETITOR_SELECT)
      .in('our_sku', chunk)

    if (error) return { data: Array.from(deduped.values()), error }
    for (const item of data ?? []) {
      deduped.set(`${item.id}:${item.our_product_id ?? ''}:${item.our_sku ?? ''}`, item)
    }
  }

  return { data: Array.from(deduped.values()), error: null }
}

export default async function ProductosPage() {
  const supabase = createAdminClient()

  const [productsResult, categoriesResult, lastProductSyncResult, lastCompetitorSyncResult] = await Promise.all([
    // List query: exclude heavy JSONB fields (pictures, shipping, descriptions, tags, attributes).
    // Those are only needed in the detail panel and are fetched on-demand via
    // /api/product-media/[id] when a row is clicked.
    fetchAllProducts(supabase),

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
  const competitorsResult = await fetchCompetitorsForProducts(
    supabase,
    (products ?? []) as Array<{ id: string; sku: string | null }>
  )
  const competitors = (competitorsResult.data ?? []) as { our_sku: string }[]
  const lastProductSync = lastProductSyncResult.data?.synced_at ?? null
  const lastCompetitorSync = lastCompetitorSyncResult.data?.synced_at ?? null
  const categoryMap: Record<string, string> = {}
  const categories = (categoriesResult.data ?? []) as { id: string; name: string; full_path: string | null }[]
  for (const c of categories) {
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
          <p className="text-gray-500 text-sm mt-0.5">
            {products.length < (count ?? products.length)
              ? `Mostrando ${products.length} de ${count ?? products.length} publicaciones`
              : `${count ?? products.length} publicaciones`}
          </p>
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
        <ProductsTable
          products={products as ProductsTableProps['products']}
          competitorsBySku={competitorsBySku as ProductsTableProps['competitorsBySku']}
          categoryMap={categoryMap}
        />
      )}
    </div>
  )
}
