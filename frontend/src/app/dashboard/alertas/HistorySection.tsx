'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import RuleTypeBadge from './RuleTypeBadge'

type AlertItem = {
  id: string
  our_sku: string
  competitor_item_id: string
  our_price: number | null
  catalog_price: number | null
  competitor_price_before: number | null
  competitor_price_after: number | null
  diff_pct: number | null
  fired_at: string
  read_at: string | null
  ml_price_alert_rules: { id: string; name: string; rule_type: string } | null
  ml_competitor_items: { title: string | null; seller_name: string | null; thumbnail: string | null } | null
}

type Rule = { id: string; name: string }
type Sku = { sku: string; title: string }

type PanelData = {
  product: {
    id: string
    title: string
    sku: string | null
    price: number | null
    catalog_price: number | null
    buybox_price: number | null
    status: string | null
    thumbnail: string | null
    permalink: string | null
    currency_id: string | null
    available_quantity: number | null
    pictures: { secure_url?: string; url?: string }[] | null
  } | null
  competitors: {
    id: string
    title: string | null
    price: number | null
    currency_id: string | null
    usd_price: number | null
    thumbnail: string | null
    permalink: string | null
    seller_name: string | null
    status: string | null
    paused: boolean | null
  }[]
}

function formatPrice(price: number | null, currency?: string | null) {
  if (price == null) return '—'
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: currency ?? 'UYU',
    maximumFractionDigits: 0,
  }).format(price)
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(dateStr))
}

function imgUrl(thumbnail: string | null) {
  if (!thumbnail) return null
  return thumbnail.replace('http://', 'https://').replace(/-I\.jpg$/, '-F.jpg')
}

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  closed: 'bg-gray-100 text-gray-600',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'Activo', paused: 'Pausado', closed: 'Cerrado',
}

export default function HistorySection({
  initialAlerts,
  skus,
  rules,
}: {
  initialAlerts: AlertItem[]
  skus: Sku[]
  rules: Rule[]
}) {
  const [alerts, setAlerts] = useState<AlertItem[]>(initialAlerts)
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')
  const [filterSku, setFilterSku] = useState('')
  const [filterRule, setFilterRule] = useState('')
  const [filterCatalogCheaper, setFilterCatalogCheaper] = useState(true)
  const [deletingRead, setDeletingRead] = useState(false)
  const [panelSku, setPanelSku] = useState<string | null>(null)
  const [panelData, setPanelData] = useState<PanelData | null>(null)
  const [panelLoading, setPanelLoading] = useState(false)

  const skuMap = new Map(skus.map(s => [s.sku, s.title]))

  const visible = alerts.filter(a => {
    if (filter === 'unread' && a.read_at) return false
    if (filterSku && a.our_sku !== filterSku) return false
    if (filterRule && a.ml_price_alert_rules?.id !== filterRule) return false
    // Ocultar alertas donde el precio catálogo propio ya es más barato que el competidor
    // Solo aplica a reglas donde el competidor es más barato que nosotros
    const ruleType = a.ml_price_alert_rules?.rule_type ?? ''
    const isCompetitorCheaperRule = ruleType === 'competitor_cheaper' || ruleType === 'price_diff_pct_above' || ruleType === 'price_changed' || ruleType === ''
    if (filterCatalogCheaper && isCompetitorCheaperRule && a.catalog_price != null && a.competitor_price_after != null && a.catalog_price <= a.competitor_price_after) return false
    return true
  })

  const unreadCount = alerts.filter(a => !a.read_at).length

  useEffect(() => {
    if (!panelSku) { setPanelData(null); return }
    setPanelLoading(true)
    fetch(`/api/product-panel/${encodeURIComponent(panelSku)}`)
      .then(r => r.json())
      .then(data => setPanelData(data))
      .finally(() => setPanelLoading(false))
  }, [panelSku])

  async function markRead(id: string) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read_at: new Date().toISOString() } : a))
    await fetch(`/api/alert-history/${id}`, { method: 'PATCH' })
  }

  async function markAllRead() {
    const unread = visible.filter(a => !a.read_at)
    const now = new Date().toISOString()
    setAlerts(prev => prev.map(a => unread.find(u => u.id === a.id) ? { ...a, read_at: now } : a))
    await Promise.all(unread.map(a => fetch(`/api/alert-history/${a.id}`, { method: 'PATCH' })))
  }

  async function deleteRead() {
    if (!confirm('¿Eliminar todas las alertas leídas?')) return
    setDeletingRead(true)
    setAlerts(prev => prev.filter(a => !a.read_at))
    await fetch('/api/alert-history', { method: 'DELETE' })
    setDeletingRead(false)
  }

  async function deleteAlert(id: string) {
    setAlerts(prev => prev.filter(a => a.id !== id))
    await fetch(`/api/alert-history/${id}`, { method: 'DELETE' })
  }

  // Build sorted price list for panel
  const panelEntries = (() => {
    if (!panelData?.product) return []
    const { price: pubPrice, catalog_price: catPrice, currency_id } = panelData.product
    type Entry = { key: string; label: string; price: number; isOurs: boolean; usd_price?: number | null; thumbnail?: string | null; permalink?: string | null; seller?: string | null }
    const entries: Entry[] = []
    if (pubPrice != null) entries.push({ key: 'our-pub', label: 'Mi precio publicación', price: pubPrice, isOurs: true })
    if (catPrice != null && catPrice !== pubPrice) entries.push({ key: 'our-cat', label: 'Mi precio catálogo', price: catPrice, isOurs: true })
    for (const c of panelData.competitors) {
      if (c.price != null && !c.paused) {
        entries.push({ key: c.id, label: c.seller_name ?? c.title ?? c.id, price: c.price, isOurs: false, usd_price: c.usd_price, thumbnail: c.thumbnail, permalink: c.permalink, seller: c.seller_name })
      }
    }
    const refPrice = catPrice ?? pubPrice
    return entries
      .sort((a, b) => a.price - b.price)
      .map(e => ({
        ...e,
        diff: refPrice && !e.isOurs ? ((e.price - refPrice) / refPrice) * 100 : null,
        currency: currency_id,
      }))
  })()

  return (
    <section>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-gray-900">
          Historial
          {unreadCount > 0 && (
            <span className="ml-2 bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount} nuevas</span>
          )}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Rule filter */}
          {rules.length > 0 && (
            <select
              value={filterRule}
              onChange={e => setFilterRule(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">Todas las reglas</option>
              {rules.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}

          {/* SKU filter */}
          <select
            value={filterSku}
            onChange={e => setFilterSku(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">Todos los SKU</option>
            {skus.map(s => (
              <option key={s.sku} value={s.sku}>{s.sku}</option>
            ))}
          </select>

          {/* Catalog price filter */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterCatalogCheaper}
              onChange={e => setFilterCatalogCheaper(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400"
            />
            <span className="text-sm text-gray-600">Ocultar si mi catálogo es más barato</span>
          </label>

          {/* Read/all filter */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${filter === 'unread' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              No leídas
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-sm font-medium border-l border-gray-200 transition-colors ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              Todas
            </button>
          </div>

          {visible.some(a => !a.read_at) && (
            <button onClick={markAllRead} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              Marcar todas leídas
            </button>
          )}
          {alerts.some(a => a.read_at) && (
            <button onClick={deleteRead} disabled={deletingRead} className="text-sm text-gray-400 hover:text-red-500 transition-colors">
              Limpiar leídas
            </button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-10 text-center">
          <p className="text-gray-400 text-sm">
            {filter === 'unread' ? 'No hay alertas sin leer.' : 'No hay alertas registradas.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(alert => {
            const isRead = !!alert.read_at
            const priceWentDown = alert.competitor_price_after != null && alert.competitor_price_before != null
              && alert.competitor_price_after < alert.competitor_price_before
            const diff = alert.diff_pct
            const isActive = panelSku === alert.our_sku
            const ruleType = alert.ml_price_alert_rules?.rule_type ?? ''
            const isCheaper = ruleType === 'competitor_cheaper' || ruleType === 'price_diff_pct_above'
            const isPricier = ruleType === 'competitor_pricier' || ruleType === 'price_diff_pct_below'

            // Icon + colors per alert type
            const alertIcon = (() => {
              if (isCheaper) return (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m0 0l-5-5m5 5l5-5" />
                </svg>
              )
              if (isPricier) return (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 20V4m0 0l-5 5m5-5l5 5" />
                </svg>
              )
              return (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              )
            })()

            const iconClasses = isRead
              ? 'bg-gray-100 text-gray-400'
              : isCheaper
                ? 'bg-red-100 text-red-500'
                : isPricier
                  ? 'bg-blue-100 text-blue-500'
                  : 'bg-amber-100 text-amber-500'

            const cardClasses = isRead
              ? 'opacity-60 border-gray-100'
              : isCheaper
                ? 'border-red-200 bg-red-50/30'
                : isPricier
                  ? 'border-blue-200 bg-blue-50/20'
                  : 'border-amber-200 bg-amber-50/20'

            return (
              <div
                key={alert.id}
                onClick={() => setPanelSku(isActive ? null : alert.our_sku)}
                className={`bg-white border rounded-xl px-5 py-4 flex items-start gap-4 transition-all cursor-pointer ${cardClasses} ${isActive ? 'ring-2 ring-blue-400' : 'hover:border-gray-300 hover:shadow-sm'}`}
              >
                {/* Type icon */}
                <div className={`mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconClasses}`}>
                  {alertIcon}
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  {/* Product */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{alert.our_sku}</span>
                    {skuMap.get(alert.our_sku) && (
                      <span className="text-sm font-semibold text-gray-900 line-clamp-1">{skuMap.get(alert.our_sku)}</span>
                    )}
                  </div>

                  {/* Rule + competitor */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {alert.ml_price_alert_rules && (
                      <RuleTypeBadge
                        ruleType={alert.ml_price_alert_rules.rule_type}
                        thresholdPct={alert.diff_pct != null ? Math.abs(alert.diff_pct) : null}
                      />
                    )}
                    {alert.ml_price_alert_rules && (
                      <span className="text-xs text-gray-400">"{alert.ml_price_alert_rules.name}"</span>
                    )}
                    {(alert.ml_competitor_items?.seller_name || alert.ml_competitor_items?.title) && (
                      <>
                        <span className="text-xs text-gray-300">vs.</span>
                        <span className="text-xs font-medium text-gray-600">
                          {alert.ml_competitor_items?.seller_name ?? alert.ml_competitor_items?.title}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Prices */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      {alert.competitor_price_before != null && (
                        <span className="text-gray-400 line-through text-sm">{formatPrice(alert.competitor_price_before)}</span>
                      )}
                      <span className="text-gray-300 text-xs">→</span>
                      <span className={`text-base font-bold ${priceWentDown ? 'text-red-600' : 'text-green-600'}`}>
                        {formatPrice(alert.competitor_price_after)}
                      </span>
                    </div>
                    {alert.our_price != null && (
                      <span className="text-sm text-gray-500">Nuestro: <span className="font-medium text-gray-700">{formatPrice(alert.our_price)}</span></span>
                    )}
                    {diff != null && (
                      <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${diff < 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                        {diff < 0 ? `${diff.toFixed(1)}%` : `+${diff.toFixed(1)}%`}
                      </span>
                    )}
                    <span className="text-xs text-gray-300 ml-auto">{formatDate(alert.fired_at)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-0.5" onClick={e => e.stopPropagation()}>
                  {!isRead && (
                    <button
                      onClick={() => markRead(alert.id)}
                      className="text-xs text-blue-500 hover:text-blue-700 font-medium whitespace-nowrap"
                    >
                      Marcar leída
                    </button>
                  )}
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-xl leading-none"
                    title="Eliminar"
                  >×</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Product panel — slides in from the right */}
      {panelSku && (
        <div className="fixed inset-0 z-40" onClick={() => setPanelSku(null)}>
          <div
            className="absolute top-0 right-0 h-full w-full md:w-130 bg-white shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {panelLoading || !panelData ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                {panelLoading ? 'Cargando...' : 'Sin datos'}
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-start justify-between px-5 py-3 border-b border-gray-100 shrink-0">
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="text-xs text-gray-400 mb-0.5 font-mono">{panelSku}</p>
                    <h2 className="font-semibold text-gray-900 leading-snug line-clamp-2 text-sm">
                      {panelData.product?.title ?? skuMap.get(panelSku) ?? panelSku}
                    </h2>
                  </div>
                  <button onClick={() => setPanelSku(null)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none shrink-0">×</button>
                </div>

                {/* Image + key info */}
                {panelData.product && (
                  <div className="flex border-b border-gray-100 shrink-0">
                    <div className="w-36 shrink-0 bg-gray-50 flex items-center justify-center p-3 border-r border-gray-100">
                      {panelData.product.thumbnail ? (
                        <Image
                          src={imgUrl(panelData.product.thumbnail)!}
                          alt={panelData.product.title}
                          width={120}
                          height={120}
                          className="object-contain"
                          style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '120px' }}
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-28 bg-gray-100 rounded" />
                      )}
                    </div>
                    <div className="flex-1 p-4 space-y-2">
                      <div className="flex gap-3 text-xs">
                        <div>
                          <p className="text-gray-400 uppercase tracking-wide font-medium">MLU</p>
                          <p className="font-mono text-gray-900 font-semibold">{panelData.product.id}</p>
                        </div>
                        {panelData.product.sku && (
                          <div>
                            <p className="text-gray-400 uppercase tracking-wide font-medium">SKU</p>
                            <p className="font-mono text-gray-900 font-semibold">{panelData.product.sku}</p>
                          </div>
                        )}
                      </div>
                      <div className="border-t border-gray-50 pt-2 space-y-1">
                        {panelData.product.price != null && (
                          <div className="flex items-baseline justify-between">
                            <span className="text-xs text-gray-400">Precio pub.</span>
                            <span className="text-lg font-bold text-gray-900">{formatPrice(panelData.product.price, panelData.product.currency_id)}</span>
                          </div>
                        )}
                        {panelData.product.catalog_price != null && panelData.product.catalog_price !== panelData.product.price && (
                          <div className="flex items-baseline justify-between">
                            <span className="text-xs text-gray-400">Mi cat.</span>
                            <span className="text-base font-semibold text-blue-600">{formatPrice(panelData.product.catalog_price, panelData.product.currency_id)}</span>
                          </div>
                        )}
                        {panelData.product.buybox_price != null && panelData.product.buybox_price !== panelData.product.catalog_price && (
                          <div className="flex items-baseline justify-between">
                            <span className="text-xs text-gray-400">Buy-box rival</span>
                            <span className="text-base font-semibold text-orange-500">{formatPrice(panelData.product.buybox_price, panelData.product.currency_id)}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[panelData.product.status ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABEL[panelData.product.status ?? ''] ?? panelData.product.status ?? '—'}
                        </span>
                        {panelData.product.permalink && (
                          <a href={panelData.product.permalink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:text-blue-700 font-medium">
                            Ver en ML →
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Price comparison */}
                <div className="flex-1 overflow-y-auto p-4">
                  {panelEntries.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-8">Sin datos de precios</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Comparación de precios</p>
                      {panelEntries.map((entry, idx) => {
                        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
                        const isCheaper = entry.diff != null && entry.diff < 0
                        return (
                          <div key={entry.key} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${entry.isOurs ? 'bg-gray-50 border-gray-300 shadow-sm' : 'bg-white border-gray-100'}`}>
                            <div className="w-7 text-center shrink-0">
                              {medal ? <span className="text-xl">{medal}</span> : <span className="text-sm font-bold text-gray-400">{idx + 1}</span>}
                            </div>
                            {entry.isOurs ? (
                              <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                              </div>
                            ) : entry.thumbnail ? (
                              <Image src={imgUrl(entry.thumbnail)!} alt="" width={36} height={36} className="w-9 h-9 rounded-lg object-contain bg-gray-50 shrink-0" unoptimized />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium line-clamp-1 ${entry.isOurs ? 'text-gray-600' : 'text-gray-900'}`}>{entry.label}</p>
                              <p className="text-xs text-gray-400">{entry.isOurs ? 'Nuestro — publicación' : entry.seller ?? 'Competidor'}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-base font-bold text-gray-900">{formatPrice(entry.price, entry.currency)}</p>
                              {!entry.isOurs && entry.usd_price != null && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  USD {entry.usd_price.toLocaleString('es-UY', { maximumFractionDigits: 0 })}
                                </p>
                              )}
                              {entry.diff != null && (
                                <p className={`text-xs font-semibold mt-0.5 ${isCheaper ? 'text-red-500' : 'text-green-600'}`}>
                                  {isCheaper ? `${entry.diff.toFixed(0)}%` : `+${entry.diff.toFixed(0)}%`}
                                </p>
                              )}
                            </div>
                            {entry.permalink && (
                              <a href={entry.permalink} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-blue-500 transition-colors shrink-0" onClick={e => e.stopPropagation()}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                              </a>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
