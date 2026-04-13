'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

type Snapshot = {
  id: string
  tracked_item_id: string
  price: number | null
  original_price: number | null
  available_quantity: number | null
  sold_quantity: number | null
  status: string | null
  health: number | null
  scraped_at: string
}

type TrackedItem = {
  id: string
  ml_item_id: string
  url: string | null
  title: string | null
  thumbnail: string | null
  seller_name: string | null
  seller_id: number | null
  our_sku: string | null
  active: boolean
  created_at: string
  last_scraped_at: string | null
  latest_snapshot: Snapshot | null
  prev_snapshot: Snapshot | null
}

type Sku = {
  sku: string
  title: string
  thumbnail: string | null
  price: number | null
  catalog_price: number | null
  currency_id: string | null
}

function formatPrice(p: number | null) {
  if (p == null) return '—'
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 }).format(p)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
}

function formatRelative(d: string | null) {
  if (!d) return null
  const diff = Date.now() - new Date(d).getTime()
  const h = diff / 3600000
  if (h < 1) return 'hace minutos'
  if (h < 24) return `hace ${Math.floor(h)}h`
  const days = Math.floor(h / 24)
  return days < 30 ? `hace ${days}d` : `hace ${Math.floor(days / 30)}m`
}

function imgUrl(t: string | null) {
  if (!t) return null
  return t.replace('http://', 'https://').replace(/-I\.jpg$/, '-F.jpg')
}

function Delta({ curr, prev, format = 'number' }: { curr: number | null; prev: number | null; format?: 'number' | 'price' }) {
  if (curr == null || prev == null || curr === prev) return null
  const diff = curr - prev
  const up = diff > 0
  const fmt = format === 'price' ? formatPrice(Math.abs(diff)) : String(Math.abs(diff))
  return (
    <span className={`text-xs font-semibold ${up ? 'text-green-600' : 'text-red-500'}`}>
      {up ? '▲' : '▼'} {fmt}
    </span>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    paused: 'bg-yellow-100 text-yellow-700',
    closed: 'bg-gray-100 text-gray-500',
  }
  const label: Record<string, string> = { active: 'Activo', paused: 'Pausado', closed: 'Cerrado' }
  return (
    <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${map[status ?? ''] ?? 'bg-gray-100 text-gray-500'}`}>
      {label[status ?? ''] ?? status ?? '—'}
    </span>
  )
}

function ProductPickerModal({ skus, selected, onSelect, onClose }: {
  skus: Sku[]
  selected: string
  onSelect: (sku: string) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const filtered = skus.filter(s =>
    !search.trim() ||
    s.title?.toLowerCase().includes(search.toLowerCase()) ||
    s.sku.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h3 className="text-base font-semibold text-gray-900">Vincular a nuestro producto</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>
        <div className="px-4 py-3 border-b border-gray-100 shrink-0">
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título o SKU..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="overflow-y-auto flex-1 p-3 space-y-1.5">
          <button
            onClick={() => { onSelect(''); onClose() }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${!selected ? 'border-blue-300 bg-blue-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}
          >
            <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <span className="text-sm text-gray-400">Sin vincular</span>
          </button>
          {filtered.map(s => {
            const isSelected = selected === s.sku
            const thumb = s.thumbnail ? s.thumbnail.replace('http://', 'https://').replace(/-I\.jpg$/, '-F.jpg') : null
            const price = s.catalog_price ?? s.price
            return (
              <button
                key={s.sku}
                onClick={() => { onSelect(s.sku); onClose() }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}
              >
                {thumb ? (
                  <Image src={thumb} alt="" width={40} height={40}
                    className="w-10 h-10 rounded-lg object-contain bg-gray-50 shrink-0" unoptimized />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">{s.title}</p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{s.sku}</p>
                </div>
                {price != null && (
                  <span className="text-sm font-semibold text-gray-900 shrink-0">
                    {new Intl.NumberFormat('es-UY', { style: 'currency', currency: s.currency_id ?? 'UYU', maximumFractionDigits: 0 }).format(price)}
                  </span>
                )}
                {isSelected && (
                  <svg className="w-4 h-4 text-blue-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function AddModal({ skus, onClose, onAdded }: {
  skus: Sku[]
  onClose: () => void
  onAdded: (item: TrackedItem) => void
}) {
  const [url, setUrl] = useState('')
  const [ourSku, setOurSku] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const skuMap = new Map(skus.map(s => [s.sku, s]))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/tracked-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), ourSku: ourSku || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onAdded({ ...data.item, latest_snapshot: null, prev_snapshot: null })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const linkedProduct = ourSku ? skuMap.get(ourSku) : null
  const linkedThumb = linkedProduct?.thumbnail ? linkedProduct.thumbnail.replace('http://', 'https://').replace(/-I\.jpg$/, '-F.jpg') : null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Agregar seguimiento</h3>
          <p className="text-sm text-gray-400 mb-5">Pegá la URL o ID de MercadoLibre del producto a seguir</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">URL o ID del producto</label>
              <input
                autoFocus
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="mercadolibre.com.uy/... o MLU123456"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Vincular a nuestro producto <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="w-full flex items-center gap-3 px-3 py-2.5 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors text-left"
              >
                {linkedProduct ? (
                  <>
                    {linkedThumb ? (
                      <Image src={linkedThumb} alt="" width={36} height={36} className="w-9 h-9 rounded-lg object-contain bg-gray-50 shrink-0" unoptimized />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">{linkedProduct.title}</p>
                      <p className="text-xs text-gray-400 font-mono">{linkedProduct.sku}</p>
                    </div>
                    <span className="text-xs text-blue-600 font-medium shrink-0">Cambiar</span>
                  </>
                ) : (
                  <>
                    <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <span className="text-sm text-gray-400">Seleccionar producto...</span>
                  </>
                )}
              </button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" disabled={loading || !url.trim()} className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Resolviendo...' : 'Agregar'}
              </button>
            </div>
          </form>
        </div>
      </div>
      {showPicker && (
        <ProductPickerModal
          skus={skus}
          selected={ourSku}
          onSelect={setOurSku}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}

function HistoryPanel({ item, onClose, skus }: { item: TrackedItem; onClose: () => void; skus: Sku[] }) {
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [linkSku, setLinkSku] = useState(item.our_sku ?? '')
  const [savingLink, setSavingLink] = useState(false)
  const [showPicker, setShowPicker] = useState(false)

  useEffect(() => {
    fetch(`/api/tracked-items/${item.id}/snapshots`)
      .then(r => r.json())
      .then(data => { setSnapshots(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [item.id])

  async function saveLink() {
    setSavingLink(true)
    await fetch(`/api/tracked-items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ our_sku: linkSku || null }),
    })
    setSavingLink(false)
  }

  const skuMap = new Map(skus.map(s => [s.sku, s.title]))

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="absolute top-0 right-0 h-full w-full max-w-xl bg-white shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-start gap-3 min-w-0 flex-1 pr-3">
            {item.thumbnail && (
              <Image src={imgUrl(item.thumbnail)!} alt="" width={48} height={48}
                className="w-12 h-12 rounded-lg object-contain bg-gray-50 shrink-0" unoptimized />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 line-clamp-2 text-sm leading-snug">{item.title ?? item.ml_item_id}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.seller_name ?? '—'}</p>
              {item.url && (
                <a href={item.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:text-blue-700 font-medium">
                  Ver en ML →
                </a>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none shrink-0">×</button>
        </div>

        {/* Link to SKU */}
        <div className="px-5 py-3 border-b border-gray-100 shrink-0">
          <p className="text-xs text-gray-500 mb-2">Vinculado a nuestro producto</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="flex-1 flex items-center gap-2.5 px-3 py-2 border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors text-left"
            >
              {linkSku && skuMap.get(linkSku) ? (() => {
                const p = skuMap.get(linkSku)!
                const thumb = p.thumbnail ? p.thumbnail.replace('http://', 'https://').replace(/-I\.jpg$/, '-F.jpg') : null
                return (
                  <>
                    {thumb ? (
                      <Image src={thumb} alt="" width={32} height={32} className="w-8 h-8 rounded-lg object-contain bg-gray-50 shrink-0" unoptimized />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-gray-100 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 line-clamp-1">{p.title}</p>
                      <p className="text-xs text-gray-400 font-mono">{p.sku}</p>
                    </div>
                    <span className="text-xs text-blue-600 font-medium shrink-0">Cambiar</span>
                  </>
                )
              })() : (
                <>
                  <div className="w-8 h-8 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <span className="text-sm text-gray-400">Seleccionar producto...</span>
                </>
              )}
            </button>
            <button
              onClick={saveLink}
              disabled={savingLink || linkSku === (item.our_sku ?? '')}
              className="px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
            >
              {savingLink ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>

        {/* Snapshots table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Cargando...</div>
          ) : !snapshots || snapshots.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Sin historial aún</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left font-medium">Fecha</th>
                  <th className="px-4 py-2.5 text-right font-medium">Precio</th>
                  <th className="px-4 py-2.5 text-right font-medium">Stock</th>
                  <th className="px-4 py-2.5 text-right font-medium">Vendidos</th>
                  <th className="px-4 py-2.5 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {snapshots.map((snap, i) => {
                  const next = snapshots[i + 1] // older snapshot
                  const priceChanged = next && snap.price !== next.price
                  const stockChanged = next && snap.available_quantity !== next.available_quantity
                  const soldChanged = next && snap.sold_quantity !== next.sold_quantity
                  const anyChange = priceChanged || stockChanged || soldChanged || !next

                  return (
                    <tr key={snap.id} className={`${anyChange ? '' : 'opacity-50'} hover:bg-gray-50`}>
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{formatDate(snap.scraped_at)}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <span className={`font-medium ${priceChanged && snap.price! < next!.price! ? 'text-green-600' : priceChanged ? 'text-red-500' : 'text-gray-900'}`}>
                          {formatPrice(snap.price)}
                        </span>
                        {priceChanged && (
                          <span className="ml-1 text-xs text-gray-400 line-through">{formatPrice(next!.price)}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <span className={`font-medium ${stockChanged ? snap.available_quantity! > next!.available_quantity! ? 'text-green-600' : 'text-red-500' : 'text-gray-700'}`}>
                          {snap.available_quantity ?? '—'}
                        </span>
                        {stockChanged && (
                          <span className={`ml-1 text-xs font-semibold ${snap.available_quantity! > next!.available_quantity! ? 'text-green-600' : 'text-red-500'}`}>
                            {snap.available_quantity! > next!.available_quantity! ? '▲' : '▼'}
                            {Math.abs(snap.available_quantity! - next!.available_quantity!)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <span className={`font-medium ${soldChanged ? 'text-blue-600' : 'text-gray-700'}`}>
                          {snap.sold_quantity ?? '—'}
                        </span>
                        {soldChanged && snap.sold_quantity! > next!.sold_quantity! && (
                          <span className="ml-1 text-xs font-semibold text-blue-600">
                            +{snap.sold_quantity! - next!.sold_quantity!}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5"><StatusBadge status={snap.status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {showPicker && (
        <ProductPickerModal
          skus={skus}
          selected={linkSku}
          onSelect={sku => { setLinkSku(sku) }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

export default function TrackingSection({ initialItems, skus }: { initialItems: TrackedItem[]; skus: Sku[] }) {
  const [items, setItems] = useState<TrackedItem[]>(initialItems)
  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState<TrackedItem | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const skuMap = new Map(skus.map(s => [s.sku, s.title]))

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/sync-tracked', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Error')
      setSyncMsg(`${data.snapshots_stored} cambios detectados`)
      const fresh = await fetch('/api/tracked-items').then(r => r.json())
      if (Array.isArray(fresh)) setItems(fresh)
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : 'Error')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(null), 4000)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Dejar de seguir este producto?')) return
    await fetch(`/api/tracked-items/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <span className="text-base leading-none">+</span> Agregar
        </button>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 bg-white text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {syncing ? 'Sincronizando...' : 'Sincronizar'}
        </button>
        {syncMsg && <span className="text-sm text-gray-500">{syncMsg}</span>}
        <span className="ml-auto text-sm text-gray-400">{items.length} productos</span>
      </div>

      {/* Empty state */}
      {items.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
          <p className="text-gray-400 text-sm mb-3">No hay productos bajo seguimiento.</p>
          <button onClick={() => setShowAdd(true)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            Agregar el primero →
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                <th className="px-4 py-3 font-medium w-14"></th>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">Vinculado</th>
                <th className="px-4 py-3 font-medium text-right">Precio</th>
                <th className="px-4 py-3 font-medium text-right">Stock</th>
                <th className="px-4 py-3 font-medium text-right">Vendidos</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Último sync</th>
                <th className="px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map(item => {
                const snap = item.latest_snapshot
                const prev = item.prev_snapshot
                const isSelected = selected?.id === item.id

                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelected(isSelected ? null : item)}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-2.5">
                      {item.thumbnail ? (
                        <Image src={imgUrl(item.thumbnail)!} alt="" width={48} height={48}
                          className="w-12 h-12 rounded-lg object-contain bg-gray-50" unoptimized />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100" />
                      )}
                    </td>
                    <td className="px-4 py-2.5 max-w-xs">
                      <p className="font-medium text-gray-900 line-clamp-2 text-sm leading-snug">{item.title ?? item.ml_item_id}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.seller_name ?? '—'} · <span className="font-mono">{item.ml_item_id}</span></p>
                    </td>
                    <td className="px-4 py-2.5">
                      {item.our_sku ? (
                        <div>
                          <span className="font-mono text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{item.our_sku}</span>
                          {skuMap.get(item.our_sku) && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{skuMap.get(item.our_sku)}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <span className="font-semibold text-gray-900">{formatPrice(snap?.price ?? null)}</span>
                      <div className="mt-0.5">
                        <Delta curr={snap?.price ?? null} prev={prev?.price ?? null} format="price" />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <span className="font-medium text-gray-700">{snap?.available_quantity ?? '—'}</span>
                      <div className="mt-0.5">
                        <Delta curr={snap?.available_quantity ?? null} prev={prev?.available_quantity ?? null} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <span className="font-medium text-gray-700">{snap?.sold_quantity ?? '—'}</span>
                      <div className="mt-0.5">
                        {snap?.sold_quantity != null && prev?.sold_quantity != null && snap.sold_quantity > prev.sold_quantity && (
                          <span className="text-xs font-semibold text-blue-600">
                            +{snap.sold_quantity - prev.sold_quantity}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={snap?.status ?? null} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                      {formatRelative(item.last_scraped_at)}
                    </td>
                    <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                        title="Dejar de seguir"
                      >×</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddModal
          skus={skus}
          onClose={() => setShowAdd(false)}
          onAdded={item => { setItems(prev => [item, ...prev]); setShowAdd(false) }}
        />
      )}

      {selected && (
        <HistoryPanel
          item={selected}
          skus={skus}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
