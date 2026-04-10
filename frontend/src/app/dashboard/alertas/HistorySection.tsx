'use client'

import { useState } from 'react'

const RULE_LABELS: Record<string, string> = {
  price_changed: 'Cambio de precio',
  competitor_cheaper: 'Competidor más barato',
  competitor_pricier: 'Competidor más caro',
  price_diff_pct_above: 'Más barato por %',
  price_diff_pct_below: 'Más caro por %',
}

type AlertItem = {
  id: string
  our_sku: string
  competitor_item_id: string
  our_price: number | null
  competitor_price_before: number | null
  competitor_price_after: number | null
  diff_pct: number | null
  fired_at: string
  read_at: string | null
  ml_price_alert_rules: { id: string; name: string; rule_type: string } | null
  ml_competitor_items: { title: string | null; seller_name: string | null; thumbnail: string | null } | null
}

type Sku = { sku: string; title: string }

function formatPrice(price: number | null) {
  if (price == null) return '—'
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU', maximumFractionDigits: 0 }).format(price)
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(dateStr))
}

export default function HistorySection({
  initialAlerts,
  skus,
}: {
  initialAlerts: AlertItem[]
  skus: Sku[]
}) {
  const [alerts, setAlerts] = useState<AlertItem[]>(initialAlerts)
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')
  const [filterSku, setFilterSku] = useState('')
  const [deletingRead, setDeletingRead] = useState(false)

  const visible = alerts.filter(a => {
    if (filter === 'unread' && a.read_at) return false
    if (filterSku && a.our_sku !== filterSku) return false
    return true
  })

  const unreadCount = alerts.filter(a => !a.read_at).length

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
          {/* SKU filter */}
          <select
            value={filterSku}
            onChange={e => setFilterSku(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">Todos los SKU</option>
            {skus.map(s => (
              <option key={s.sku} value={s.sku}>{s.sku}</option>
            ))}
          </select>

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
        <div className="space-y-2">
          {visible.map(alert => {
            const isRead = !!alert.read_at
            const priceWentDown = alert.competitor_price_after != null && alert.competitor_price_before != null
              && alert.competitor_price_after < alert.competitor_price_before
            const diff = alert.diff_pct

            return (
              <div
                key={alert.id}
                className={`bg-white border rounded-xl px-4 py-3 flex items-start gap-4 transition-opacity ${isRead ? 'opacity-60 border-gray-100' : 'border-orange-200'}`}
              >
                {/* Unread dot */}
                <div className="mt-1.5 shrink-0">
                  {!isRead
                    ? <div className="w-2 h-2 rounded-full bg-orange-400" />
                    : <div className="w-2 h-2 rounded-full bg-gray-200" />
                  }
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {alert.ml_price_alert_rules ? RULE_LABELS[alert.ml_price_alert_rules.rule_type] ?? alert.ml_price_alert_rules.rule_type : '—'}
                      </span>
                      {alert.ml_price_alert_rules && (
                        <span className="ml-2 text-xs text-gray-400">"{alert.ml_price_alert_rules.name}"</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{formatDate(alert.fired_at)}</span>
                  </div>

                  <div className="mt-1 flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{alert.our_sku}</span>
                    {alert.ml_competitor_items?.seller_name && (
                      <span className="text-sm font-medium text-gray-900">{alert.ml_competitor_items.seller_name}</span>
                    )}
                    {alert.ml_competitor_items?.title && (
                      <span className="text-xs text-gray-500 line-clamp-1">{alert.ml_competitor_items.title}</span>
                    )}
                  </div>

                  <div className="mt-2 flex items-center gap-4 flex-wrap">
                    {/* Price change */}
                    <div className="flex items-center gap-2 text-sm">
                      {alert.competitor_price_before != null && (
                        <span className="text-gray-400 line-through">{formatPrice(alert.competitor_price_before)}</span>
                      )}
                      <span className="text-base font-bold">→</span>
                      <span className={`font-bold ${priceWentDown ? 'text-red-600' : 'text-green-600'}`}>
                        {formatPrice(alert.competitor_price_after)}
                      </span>
                    </div>

                    {/* Our price */}
                    {alert.our_price != null && (
                      <span className="text-xs text-gray-400">Nuestro: {formatPrice(alert.our_price)}</span>
                    )}

                    {/* Diff */}
                    {diff != null && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${diff < 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                        {diff < 0 ? `${diff.toFixed(1)}%` : `+${diff.toFixed(1)}%`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
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
                    className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                    title="Eliminar"
                  >
                    ×
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
