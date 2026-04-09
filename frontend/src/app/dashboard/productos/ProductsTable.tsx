'use client'

import { useState } from 'react'
import Image from 'next/image'

function Accordion({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-700">{title}</span>
        <span className={`text-gray-400 text-lg leading-none transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          ›
        </span>
      </button>
      {open && (
        <div className="px-5 pb-4 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  )
}

type Product = {
  id: string
  title: string
  subtitle: string | null
  sku: string | null
  price: number | null
  catalog_price: number | null
  base_price: number | null
  original_price: number | null
  currency_id: string | null
  available_quantity: number | null
  sold_quantity: number | null
  initial_quantity: number | null
  status: string | null
  condition: string | null
  listing_type_id: string | null
  buying_mode: string | null
  thumbnail: string | null
  permalink: string | null
  category_id: string | null
  domain_id: string | null
  catalog_product_id: string | null
  seller_custom_field: string | null
  warranty: string | null
  health: number | null
  automatic_relist: boolean | null
  catalog_listing: boolean | null
  date_created: string | null
  last_updated: string | null
  synced_at: string | null
  start_time: string | null
  stop_time: string | null
  shipping: Record<string, unknown> | null
  tags: unknown[] | null
  attributes: unknown[] | null
  pictures: { secure_url?: string; url?: string }[] | null
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Activo',
  paused: 'Pausado',
  closed: 'Cerrado',
  under_review: 'En revisión',
}

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  closed: 'bg-gray-100 text-gray-600',
  under_review: 'bg-blue-100 text-blue-700',
}

// ML thumbnail suffix -I = tiny, -O = original (up to 1200px)
function imgUrl(thumbnail: string | null, size: 'thumb' | 'full' = 'thumb') {
  if (!thumbnail) return null
  const https = thumbnail.replace('http://', 'https://')
  if (size === 'full') return https.replace(/-I\.jpg$/, '-O.jpg').replace(/-[A-Z]\.jpg$/, '-O.jpg')
  // For lists/grid use -F (medium, ~500px) instead of -I (tiny)
  return https.replace(/-I\.jpg$/, '-F.jpg')
}

function formatPrice(price: number | null, currency: string | null) {
  if (price == null) return '—'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency ?? 'ARS',
    maximumFractionDigits: 0,
  }).format(price)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

function formatRelative(dateStr: string | null) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = diff / 1000 / 3600
  if (hours < 1) return 'hace minutos'
  if (hours < 24) return `hace ${Math.floor(hours)}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `hace ${days}d`
  return `hace ${Math.floor(days / 30)} meses`
}

function isStale(dateStr: string | null) {
  if (!dateStr) return true
  return Date.now() - new Date(dateStr).getTime() > 7 * 24 * 3600 * 1000
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '' || value === '—') return null
  return (
    <div className="flex justify-between gap-4 py-3 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-400 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right font-medium break-all">{value}</span>
    </div>
  )
}

type Competitor = {
  id: string
  our_sku: string
  title: string | null
  price: number | null
  currency_id: string | null
  status: string | null
  thumbnail: string | null
  permalink: string | null
  seller_id: number | null
  synced_at: string | null
}

type LinkMode = 'mlu' | 'sku'

function AddCompetitorModal({
  initialSku,
  availableSkus,
  onClose,
  onAdded,
}: {
  initialSku: string
  availableSkus: string[]
  onClose: () => void
  onAdded: (c: Competitor) => void
}) {
  const [linkMode, setLinkMode] = useState<LinkMode>('mlu')
  const [competitorInput, setCompetitorInput] = useState('')   // MLU / URL del competidor
  const [selectedSku, setSelectedSku] = useState(initialSku)  // SKU de nuestro producto
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (linkMode === 'sku' && !selectedSku) {
      setError('Seleccioná un SKU')
      return
    }

    setLoading(true)
    const res = await fetch('/api/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemIdOrUrl: competitorInput,
        ourSku: selectedSku,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    onAdded(data.item)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Agregar competidor</h3>
        <p className="text-sm text-gray-400 mb-5">Pegá la URL o ID de MercadoLibre del producto competidor</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Competitor MLU / URL */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Producto competidor (URL o ID)</label>
            <input
              autoFocus
              type="text"
              value={competitorInput}
              onChange={e => setCompetitorInput(e.target.value)}
              placeholder="mercadolibre.com.uy/nombre-producto/p/MLU... o MLU123456"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1.5">Usá la URL de catálogo (<span className="font-mono">/p/MLU...</span>) para ver el mejor precio de la competencia</p>
          </div>

          {/* Link to: SKU selector */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Vincular a nuestro producto</label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setLinkMode('mlu')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${linkMode === 'mlu' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
              >
                Por MLU publicación
              </button>
              <button
                type="button"
                onClick={() => setLinkMode('sku')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${linkMode === 'sku' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
              >
                Por SKU
              </button>
            </div>

            {linkMode === 'mlu' ? (
              <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                Se vincula al producto actual: <span className="font-mono font-medium text-gray-700">{initialSku}</span>
              </p>
            ) : (
              <select
                value={selectedSku}
                onChange={e => setSelectedSku(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {availableSkus.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !competitorInput.trim()}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CompetitorDot({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
      {count}
    </span>
  )
}

type ViewMode = 'tabla' | 'listado' | 'grid'

function IconTable() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18M3 14h18M3 18h18" />
    </svg>
  )
}
function IconList() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  )
}
function IconGrid() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </svg>
  )
}

export default function ProductsTable({
  products,
  count,
  competitorsBySku,
  categoryMap,
}: {
  products: Product[]
  count: number
  competitorsBySku: Record<string, Competitor[]>
  categoryMap: Record<string, string>
}) {
  const [selected, setSelected] = useState<Product | null>(null)
  const [view, setView] = useState<ViewMode>('grid')
  const [localCompetitors, setLocalCompetitors] = useState<Record<string, Competitor[]>>(competitorsBySku)
  const [showAddModal, setShowAddModal] = useState(false)
  const [search, setSearch] = useState('')
  const [onlyWithCompetitors, setOnlyWithCompetitors] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [panelTab, setPanelTab] = useState<'competitors' | 'details'>('competitors')
  const [compView, setCompView] = useState<'position' | 'diff'>('position')

  function handleSelect(p: Product) {
    setSelected(selected?.id === p.id ? null : p)
  }

  function handleAdded(c: Competitor) {
    setLocalCompetitors(prev => ({
      ...prev,
      [c.our_sku]: [...(prev[c.our_sku] ?? []), c],
    }))
  }

  async function handleSyncCompetitors() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/sync-competitors', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setSyncMsg(`Actualizados ${data.updated} de ${data.total} competidores`)
        // Reload the page to get fresh data
        setTimeout(() => window.location.reload(), 1200)
      } else {
        setSyncMsg(`Error: ${data.error}`)
      }
    } catch {
      setSyncMsg('Error al sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  async function handleRemoveCompetitor(itemId: string, sku: string) {
    await fetch('/api/competitors', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, ourSku: sku }),
    })
    setLocalCompetitors(prev => ({
      ...prev,
      [sku]: (prev[sku] ?? []).filter(c => c.id !== itemId),
    }))
  }

  // Collect unique categories with names for filter
  const categories = Array.from(new Set(products.map(p => p.category_id).filter(Boolean))) as string[]
  const categoriesWithNames = categories
    .map(id => ({ id, name: categoryMap[id] ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const filteredProducts = products.filter(p => {
    if (search.trim()) {
      const q = search.toLowerCase()
      if (
        !p.title?.toLowerCase().includes(q) &&
        !p.sku?.toLowerCase().includes(q) &&
        !p.id.toLowerCase().includes(q)
      ) return false
    }
    if (onlyWithCompetitors) {
      if (!p.sku || !(localCompetitors[p.sku]?.length > 0)) return false
    }
    if (selectedCategory && p.category_id !== selectedCategory) return false
    return true
  }).sort((a, b) => {
    const aHas = (a.sku && (localCompetitors[a.sku]?.length ?? 0) > 0) ? 1 : 0
    const bHas = (b.sku && (localCompetitors[b.sku]?.length ?? 0) > 0) ? 1 : 0
    if (bHas !== aHas) return bHas - aHas
    return 0 // keep server order (last_updated desc) within each group
  })

  return (
    <div className="relative">
      {/* Backdrop */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/20 z-30"
          onClick={() => setSelected(null)}
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título, SKU o ID..."
            className="w-full pl-9 pr-4 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* Category filter */}
        <select
          value={selectedCategory ?? ''}
          onChange={e => setSelectedCategory(e.target.value || null)}
          className="py-1.5 px-3 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas las categorías</option>
          {categoriesWithNames.map(({ id, name }) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>

        {/* Competitors filter */}
        <button
          onClick={() => setOnlyWithCompetitors(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            onlyWithCompetitors
              ? 'bg-orange-50 border-orange-300 text-orange-700'
              : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
          Con rivales
        </button>

        {/* Sync competitors */}
        <button
          onClick={handleSyncCompetitors}
          disabled={syncing}
          title="Actualizar precios de todos los competidores"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {syncing ? 'Actualizando...' : 'Sincronizar rivales'}
        </button>

        {syncMsg && (
          <span className="text-xs text-gray-500 px-2">{syncMsg}</span>
        )}

        {/* View switcher */}
        <div className="flex gap-1 ml-auto">
        {([['tabla', <IconTable key="t" />], ['listado', <IconList key="l" />], ['grid', <IconGrid key="g" />]] as [ViewMode, React.ReactNode][]).map(([mode, icon]) => (
          <button
            key={mode}
            onClick={() => setView(mode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              view === mode ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {icon} {mode}
          </button>
        ))}
        </div>
      </div>

      {/* Vista: Tabla */}
      {view === 'tabla' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden w-full">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 font-medium w-20"></th>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium text-right">Precio pub.</th>
                <th className="px-4 py-3 font-medium text-right">Precio cat.</th>
                <th className="px-4 py-3 font-medium text-right">Stock</th>
                <th className="px-4 py-3 font-medium text-right">Vendidos</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Actualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredProducts.map((p) => {
                const compCount = p.sku ? (localCompetitors[p.sku]?.length ?? 0) : 0
                return (
                  <tr
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    className={`cursor-pointer transition-colors ${selected?.id === p.id ? 'bg-blue-50' : compCount > 0 ? 'hover:bg-orange-50/30' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-2">
                      {p.thumbnail ? (
                        <Image src={imgUrl(p.thumbnail)!} alt={p.title} width={64} height={64} className="rounded object-contain w-16 h-16" unoptimized />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 rounded" />
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 line-clamp-2 text-sm">{p.title}</p>
                        <CompetitorDot count={compCount} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{p.condition === 'new' ? 'Nuevo' : 'Usado'} · {p.id}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-600">{p.sku ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">{formatPrice(p.price, p.currency_id)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {p.catalog_price != null
                        ? <span className={p.catalog_price < (p.price ?? 0) ? 'text-blue-600 font-medium' : 'text-gray-700'}>{formatPrice(p.catalog_price, p.currency_id)}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{p.available_quantity ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{p.sold_quantity ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[p.status ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[p.status ?? ''] ?? p.status ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <span className={isStale(p.last_updated) ? 'text-amber-500 font-medium' : 'text-gray-400'}>
                        {formatRelative(p.last_updated)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Vista: Listado */}
      {view === 'listado' && (
        <div className="space-y-2">
          {filteredProducts.map((p) => {
            const compCount = p.sku ? (localCompetitors[p.sku]?.length ?? 0) : 0
            return (
              <div
                key={p.id}
                onClick={() => handleSelect(p)}
                className={`flex items-center gap-4 bg-white rounded-xl border px-4 py-3 cursor-pointer transition-colors ${selected?.id === p.id ? 'border-blue-300 bg-blue-50' : compCount > 0 ? 'border-orange-100 hover:bg-orange-50/20' : 'border-gray-100 hover:bg-gray-50'}`}
              >
                {p.thumbnail ? (
                  <Image src={imgUrl(p.thumbnail)!} alt={p.title} width={72} height={72} className="rounded object-contain w-[72px] h-[72px] shrink-0" unoptimized />
                ) : (
                  <div className="w-[72px] h-[72px] bg-gray-100 rounded shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 line-clamp-1">{p.title}</p>
                    <CompetitorDot count={compCount} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">{p.sku ?? p.id}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-gray-900">{formatPrice(p.price, p.currency_id)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Stock: {p.available_quantity ?? '—'}</p>
                  <p className={`text-xs mt-0.5 ${isStale(p.last_updated) ? 'text-amber-500 font-medium' : 'text-gray-400'}`}>
                    {formatRelative(p.last_updated)}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${STATUS_COLOR[p.status ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABEL[p.status ?? ''] ?? p.status ?? '—'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Vista: Grid */}
      {view === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredProducts.map((p) => {
            const compCount = p.sku ? (localCompetitors[p.sku]?.length ?? 0) : 0
            return (
              <div
                key={p.id}
                onClick={() => handleSelect(p)}
                className={`bg-white rounded-xl border overflow-hidden cursor-pointer transition-colors relative ${selected?.id === p.id ? 'border-blue-300 bg-blue-50' : compCount > 0 ? 'border-orange-200 hover:border-orange-300' : 'border-gray-100 hover:border-gray-300'}`}
              >
                {compCount > 0 && (
                  <div className="absolute top-2 right-2 z-10">
                    <CompetitorDot count={compCount} />
                  </div>
                )}
                <div className="flex items-center justify-center bg-gray-50 h-40">
                  {p.thumbnail ? (
                    <Image src={imgUrl(p.thumbnail)!} alt={p.title} width={140} height={140} className="object-contain w-full h-full p-3" unoptimized />
                  ) : (
                    <div className="w-full h-full bg-gray-100" />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">{p.title}</p>
                  {p.sku && <p className="text-xs text-gray-400 font-mono mt-1">{p.sku}</p>}
                  <div className="mt-2 flex items-center justify-between gap-1">
                    <div>
                      <span className="text-sm font-semibold text-gray-900">{formatPrice(p.price, p.currency_id)}</span>
                      {p.catalog_price != null && p.catalog_price !== p.price && (
                        <span className="ml-1.5 text-xs text-blue-600 font-medium" title="Precio catálogo ML">
                          cat. {formatPrice(p.catalog_price, p.currency_id)}
                        </span>
                      )}
                    </div>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[p.status ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[p.status ?? ''] ?? p.status ?? '—'}
                    </span>
                  </div>
                  <p className={`text-xs mt-1 ${isStale(p.last_updated) ? 'text-amber-500 font-medium' : 'text-gray-400'}`}>
                    {formatRelative(p.last_updated)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail panel — slides in from the right */}
      {(() => {
        const skuKey = selected?.sku ?? selected?.id ?? ''
        const comps = selected ? (localCompetitors[skuKey] ?? []) : []
        const compCount = comps.length
        const pubPrice = selected?.price ?? null
        const catPrice = selected?.catalog_price ?? null
        const refPrice = catPrice ?? pubPrice // primary reference for comparisons

        // Build unified sorted list for competitor views
        type PriceEntry = {
          key: string
          label: string
          price: number
          isOurs: boolean
          oursType?: 'pub' | 'cat'
          comp?: Competitor
        }
        const allEntries: PriceEntry[] = []
        if (pubPrice != null) allEntries.push({ key: 'our-pub', label: 'Mi precio publicación', price: pubPrice, isOurs: true, oursType: 'pub' })
        if (catPrice != null && catPrice !== pubPrice) allEntries.push({ key: 'our-cat', label: 'Mi precio catálogo', price: catPrice, isOurs: true, oursType: 'cat' })
        for (const c of comps) {
          if (c.price != null) allEntries.push({ key: c.id, label: c.title ?? c.id, price: c.price, isOurs: false, comp: c })
        }
        const sortedByPrice = [...allEntries].sort((a, b) => a.price - b.price)

        function diffVsRef(price: number) {
          if (refPrice == null || refPrice === 0) return null
          return ((price - refPrice) / refPrice) * 100
        }
        function diffVsPub(price: number) {
          if (pubPrice == null || pubPrice === 0) return null
          return ((price - pubPrice) / pubPrice) * 100
        }

        return (
          <div className={`fixed top-0 right-0 h-full w-full md:w-[600px] bg-white shadow-2xl z-40 flex flex-col transition-transform duration-300 ease-in-out ${selected ? 'translate-x-0' : 'translate-x-full'}`}>
            {selected && <>
              {/* Header */}
              <div className="flex items-start justify-between px-5 py-3 border-b border-gray-100 shrink-0">
                <h2 className="font-semibold text-gray-900 leading-snug line-clamp-2 text-sm flex-1 min-w-0 pr-3">{selected.title}</h2>
                <button onClick={() => setSelected(null)} className="shrink-0 text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
              </div>

              {/* Top 2-col: image + key info */}
              <div className="flex border-b border-gray-100 shrink-0">
                <div className="w-40 shrink-0 bg-gray-50 flex items-center justify-center p-2 border-r border-gray-100">
                  {(selected.pictures?.[0]?.secure_url || selected.thumbnail) ? (
                    <Image
                      src={selected.pictures?.[0]?.secure_url ?? imgUrl(selected.thumbnail, 'full')!}
                      alt={selected.title}
                      width={144}
                      height={144}
                      className="object-contain w-full h-full"
                      style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '144px' }}
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-36 bg-gray-100 rounded" />
                  )}
                </div>
                <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                  <div className="space-y-2">
                    <div className="flex gap-4">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">MLU</p>
                        <p className="text-xs font-mono text-gray-900 font-semibold">{selected.id}</p>
                      </div>
                      {selected.sku && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">SKU</p>
                          <p className="text-xs font-mono text-gray-900 font-semibold">{selected.sku}</p>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-gray-50 pt-2 space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-gray-400">Precio pub.</span>
                        <span className="text-lg font-bold text-gray-900">{formatPrice(pubPrice, selected.currency_id)}</span>
                      </div>
                      {catPrice != null && (
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-gray-400">Precio cat.</span>
                          <span className={`text-base font-semibold ${catPrice < (pubPrice ?? Infinity) ? 'text-blue-600' : 'text-gray-700'}`}>
                            {formatPrice(catPrice, selected.currency_id)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[selected.status ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[selected.status ?? ''] ?? selected.status ?? '—'}
                    </span>
                    {selected.permalink && (
                      <a href={selected.permalink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:text-blue-700 font-medium">
                        Ver en ML →
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-100 shrink-0">
                <button
                  onClick={() => setPanelTab('competitors')}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${panelTab === 'competitors' ? 'border-b-2 border-blue-600 text-blue-700 bg-blue-50/40' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  Precios Competidores
                  {compCount > 0 && (
                    <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold min-w-[20px] text-center">{compCount}</span>
                  )}
                </button>
                <button
                  onClick={() => setPanelTab('details')}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${panelTab === 'details' ? 'border-b-2 border-blue-600 text-blue-700 bg-blue-50/40' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Detalles del producto
                </button>
              </div>

              {/* Tab body */}
              <div className="overflow-y-auto flex-1">

                {/* ── Competitors tab ── */}
                {panelTab === 'competitors' && (
                  <div className="p-4 space-y-4">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
                        {([['position', 'Posición'], ['diff', 'Diferencia']] as [typeof compView, string][]).map(([mode, label]) => (
                          <button
                            key={mode}
                            onClick={() => setCompView(mode)}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${compView === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-1 text-xs font-medium bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <span className="text-base leading-none">+</span> Agregar rival
                      </button>
                    </div>

                    {/* Reference prices banner */}
                    {(pubPrice != null || catPrice != null) && (
                      <div className="grid grid-cols-2 gap-2">
                        {pubPrice != null && (
                          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                            <p className="text-xs text-gray-400 mb-0.5">Mi precio publicación</p>
                            <p className="text-base font-bold text-gray-900">{formatPrice(pubPrice, selected.currency_id)}</p>
                          </div>
                        )}
                        {catPrice != null && (
                          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                            <p className="text-xs text-blue-400 mb-0.5">Mi precio catálogo</p>
                            <p className="text-base font-bold text-blue-700">{formatPrice(catPrice, selected.currency_id)}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {comps.length === 0 ? (
                      <div className="text-center py-10 text-gray-400">
                        <svg className="w-10 h-10 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <p className="text-sm">Sin competidores vinculados</p>
                        <p className="text-xs mt-1">Agregá un rival para comparar precios</p>
                      </div>
                    ) : (
                      <>
                        {/* VIEW: Posición — medals */}
                        {compView === 'position' && (
                          <div className="space-y-2">
                            {sortedByPrice.map((entry, idx) => {
                              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
                              const diff = refPrice != null && !entry.isOurs ? diffVsRef(entry.price) : null
                              const isCheaper = diff != null && diff < 0
                              return (
                                <div
                                  key={entry.key}
                                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                                    entry.isOurs
                                      ? entry.oursType === 'cat' ? 'bg-blue-50 border-blue-300 shadow-sm' : 'bg-gray-50 border-gray-300 shadow-sm'
                                      : 'bg-white border-gray-100'
                                  }`}
                                >
                                  <div className="w-8 text-center shrink-0">
                                    {medal ? (
                                      <span className="text-xl">{medal}</span>
                                    ) : (
                                      <span className="text-sm font-bold text-gray-400">{idx + 1}</span>
                                    )}
                                  </div>
                                  {entry.isOurs ? (
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${entry.oursType === 'cat' ? 'bg-blue-200' : 'bg-gray-200'}`}>
                                      <svg className={`w-4 h-4 ${entry.oursType === 'cat' ? 'text-blue-600' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    </div>
                                  ) : entry.comp?.thumbnail ? (
                                    <Image src={imgUrl(entry.comp.thumbnail)!} alt="" width={36} height={36} className="w-9 h-9 rounded-lg object-contain bg-gray-50 shrink-0" unoptimized />
                                  ) : (
                                    <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium line-clamp-1 ${entry.isOurs ? (entry.oursType === 'cat' ? 'text-blue-700' : 'text-gray-600') : 'text-gray-900'}`}>
                                      {entry.label}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                      {entry.isOurs ? (entry.oursType === 'cat' ? 'Nuestro — catálogo' : 'Nuestro — publicación') : 'Competidor'}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className={`text-base font-bold ${entry.isOurs && entry.oursType === 'cat' ? 'text-blue-700' : 'text-gray-900'}`}>
                                      {formatPrice(entry.price, selected.currency_id)}
                                    </p>
                                    {diff != null && (
                                      <p className={`text-xs font-semibold mt-0.5 ${isCheaper ? 'text-red-500' : 'text-green-600'}`}>
                                        {isCheaper ? `${diff.toFixed(0)}%` : `+${diff.toFixed(0)}%`}
                                      </p>
                                    )}
                                  </div>
                                  {!entry.isOurs && (
                                    <button
                                      onClick={() => handleRemoveCompetitor(entry.key, skuKey)}
                                      className="text-gray-300 hover:text-red-400 text-base leading-none shrink-0 ml-1"
                                      title="Eliminar"
                                    >×</button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* VIEW: Diferencia — horizontal price spectrum */}
                        {compView === 'diff' && (() => {
                          const allPrices = allEntries.map(e => e.price)
                          const minPrice = Math.min(...allPrices)
                          const maxPrice = Math.max(...allPrices)
                          const range = maxPrice - minPrice || 1
                          // Add 8% padding on each side
                          const paddedMin = minPrice - range * 0.08
                          const paddedMax = maxPrice + range * 0.08
                          const paddedRange = paddedMax - paddedMin

                          function pct(price: number) {
                            return ((price - paddedMin) / paddedRange) * 100
                          }

                          return (
                            <div className="space-y-4">
                              {/* Spectrum bar */}
                              <div className="bg-white border border-gray-100 rounded-xl p-5 pb-8">
                                <p className="text-xs text-gray-400 mb-6 text-center">Espectro de precios</p>
                                <div className="relative">
                                  {/* Track */}
                                  <div className="h-2 bg-gray-100 rounded-full relative">
                                    {/* Colored zones: red left of our ref price, green right */}
                                    {refPrice != null && (
                                      <>
                                        <div
                                          className="absolute top-0 left-0 h-full bg-red-100 rounded-l-full"
                                          style={{ width: `${pct(refPrice)}%` }}
                                        />
                                        <div
                                          className="absolute top-0 h-full bg-green-100 rounded-r-full"
                                          style={{ left: `${pct(refPrice)}%`, right: 0 }}
                                        />
                                      </>
                                    )}
                                  </div>

                                  {/* Markers */}
                                  {sortedByPrice.map((entry) => {
                                    const pos = pct(entry.price)
                                    const diff = refPrice != null && !entry.isOurs ? diffVsRef(entry.price) : null
                                    const isCheaper = diff != null && diff < 0
                                    const color = entry.isOurs && entry.oursType === 'cat'
                                      ? '#2563eb'
                                      : entry.isOurs && entry.oursType === 'pub'
                                      ? '#6b7280'
                                      : isCheaper ? '#ef4444' : '#16a34a'
                                    return (
                                      <div
                                        key={entry.key}
                                        className="absolute top-0 -translate-x-1/2"
                                        style={{ left: `${pos}%` }}
                                      >
                                        {/* Marker dot */}
                                        <div
                                          className="w-4 h-4 rounded-full border-2 border-white shadow-md -mt-1"
                                          style={{ backgroundColor: color }}
                                          title={`${entry.label}: ${formatPrice(entry.price, selected.currency_id)}`}
                                        />
                                        {/* Label below */}
                                        <div className="absolute top-5 -translate-x-1/2 left-1/2 text-center" style={{ minWidth: '60px' }}>
                                          <p className="text-xs font-bold whitespace-nowrap" style={{ color }}>
                                            {formatPrice(entry.price, selected.currency_id)}
                                          </p>
                                          {!entry.isOurs && diff != null && (
                                            <p className="text-xs font-semibold whitespace-nowrap" style={{ color }}>
                                              {diff > 0 ? '+' : ''}{diff.toFixed(0)}%
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>

                              {/* Legend */}
                              <div className="flex flex-wrap gap-3 text-xs">
                                {catPrice != null && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block" /> Mi precio catálogo</span>}
                                {pubPrice != null && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-500 inline-block" /> Mi precio publicación</span>}
                                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Competidor más barato</span>
                                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-600 inline-block" /> Competidor más caro</span>
                              </div>

                              {/* Detail list */}
                              <div className="space-y-2">
                                {allEntries
                                  .filter(e => !e.isOurs)
                                  .sort((a, b) => a.price - b.price)
                                  .map(entry => {
                                    const diffCat = catPrice != null ? diffVsRef(entry.price) : null
                                    const diffPub = pubPrice != null ? diffVsPub(entry.price) : null
                                    const isCheaper = (diffCat ?? diffPub ?? 0) < 0
                                    return (
                                      <div key={entry.key} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${isCheaper ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                                        {entry.comp?.thumbnail ? (
                                          <Image src={imgUrl(entry.comp.thumbnail)!} alt="" width={36} height={36} className="w-9 h-9 rounded object-contain bg-white shrink-0" unoptimized />
                                        ) : (
                                          <div className="w-9 h-9 rounded bg-gray-100 shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <a href={entry.comp?.permalink ?? '#'} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-gray-900 hover:text-blue-600 line-clamp-1 block">
                                            {entry.label}
                                          </a>
                                          <div className="flex gap-3 mt-0.5">
                                            {diffCat != null && (
                                              <span className={`text-xs font-semibold ${isCheaper ? 'text-red-500' : 'text-green-600'}`}>
                                                vs cat: {diffCat > 0 ? '+' : ''}{diffCat.toFixed(0)}%
                                              </span>
                                            )}
                                            {diffPub != null && catPrice !== pubPrice && (
                                              <span className={`text-xs font-semibold ${(diffPub < 0) ? 'text-red-500' : 'text-green-600'}`}>
                                                vs pub: {diffPub > 0 ? '+' : ''}{diffPub.toFixed(0)}%
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <p className="text-sm font-bold text-gray-900 shrink-0">{formatPrice(entry.price, selected.currency_id)}</p>
                                        <button
                                          onClick={() => handleRemoveCompetitor(entry.key, skuKey)}
                                          className="text-gray-300 hover:text-red-400 text-base leading-none shrink-0"
                                          title="Eliminar"
                                        >×</button>
                                      </div>
                                    )
                                  })}
                              </div>
                            </div>
                          )
                        })()}
                      </>
                    )}
                  </div>
                )}

                {/* ── Details tab ── */}
                {panelTab === 'details' && (
                  <div className="p-4 space-y-2">
                    <Accordion title="General" defaultOpen>
                      <InfoRow label="ID ML" value={selected.id} />
                      <InfoRow label="SKU" value={selected.sku} />
                      <InfoRow label="Campo vendedor" value={selected.seller_custom_field} />
                      <InfoRow label="ID catálogo" value={selected.catalog_product_id} />
                      <InfoRow label="Categoría" value={selected.category_id} />
                      <InfoRow label="Dominio" value={selected.domain_id} />
                      <InfoRow label="Precio publicación" value={formatPrice(selected.price, selected.currency_id)} />
                      {selected.catalog_price != null && (
                        <div className="flex justify-between gap-4 py-3 border-b border-gray-50">
                          <span className="text-sm text-gray-400 shrink-0">Precio catálogo ML</span>
                          <span className="text-sm font-medium text-right">
                            <span className={selected.catalog_price < (selected.price ?? 0) ? 'text-blue-600' : 'text-gray-900'}>
                              {formatPrice(selected.catalog_price, selected.currency_id)}
                            </span>
                            {selected.price != null && selected.catalog_price !== selected.price && (
                              <span className="ml-1.5 text-xs text-gray-400">
                                ({selected.catalog_price < selected.price
                                  ? `−${((selected.price - selected.catalog_price) / selected.price * 100).toFixed(1)}%`
                                  : `+${((selected.catalog_price - selected.price) / selected.price * 100).toFixed(1)}%`})
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                      <InfoRow label="Precio base" value={formatPrice(selected.base_price, selected.currency_id)} />
                      <InfoRow label="Precio original" value={formatPrice(selected.original_price, selected.currency_id)} />
                      <InfoRow label="Moneda" value={selected.currency_id} />
                    </Accordion>
                    <Accordion title="Stock y ventas">
                      <InfoRow label="Stock disponible" value={selected.available_quantity} />
                      <InfoRow label="Stock inicial" value={selected.initial_quantity} />
                      <InfoRow label="Vendidos" value={selected.sold_quantity} />
                    </Accordion>
                    <Accordion title="Publicación">
                      <InfoRow label="Estado" value={STATUS_LABEL[selected.status ?? ''] ?? selected.status} />
                      <InfoRow label="Condición" value={selected.condition === 'new' ? 'Nuevo' : selected.condition === 'used' ? 'Usado' : selected.condition} />
                      <InfoRow label="Tipo de publicación" value={selected.listing_type_id} />
                      <InfoRow label="Modo de compra" value={selected.buying_mode} />
                      <InfoRow label="Garantía" value={selected.warranty} />
                      <InfoRow label="Salud" value={selected.health != null ? `${(selected.health * 100).toFixed(0)}%` : null} />
                      <InfoRow label="Relisting automático" value={selected.automatic_relist != null ? (selected.automatic_relist ? 'Sí' : 'No') : null} />
                      <InfoRow label="En catálogo" value={selected.catalog_listing != null ? (selected.catalog_listing ? 'Sí' : 'No') : null} />
                    </Accordion>
                    {selected.shipping && (
                      <Accordion title="Envío">
                        {Object.entries(selected.shipping).map(([key, val]) => (
                          <InfoRow key={key} label={key} value={typeof val === 'object' ? JSON.stringify(val) : String(val)} />
                        ))}
                      </Accordion>
                    )}
                    <Accordion title="Fechas">
                      <InfoRow label="Creado" value={formatDate(selected.date_created)} />
                      <InfoRow label="Actualizado" value={formatDate(selected.last_updated)} />
                      <InfoRow label="Inicio" value={formatDate(selected.start_time)} />
                      <InfoRow label="Fin" value={formatDate(selected.stop_time)} />
                      <InfoRow label="Sincronizado" value={formatDate(selected.synced_at)} />
                    </Accordion>
                    {selected.permalink && (
                      <a href={selected.permalink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full text-sm text-blue-600 border border-blue-200 rounded-xl py-3 hover:bg-blue-50 transition-colors font-medium">
                        Ver en MercadoLibre →
                      </a>
                    )}
                  </div>
                )}
              </div>
            </>}
          </div>
        )
      })()}

      {/* Add competitor modal */}
      {showAddModal && selected && (
        <AddCompetitorModal
          initialSku={selected.sku ?? selected.id}
          availableSkus={Array.from(new Set(products.map(p => p.sku).filter(Boolean))) as string[]}
          onClose={() => setShowAddModal(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  )
}
