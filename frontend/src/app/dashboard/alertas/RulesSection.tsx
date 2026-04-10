'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const RULE_LABELS: Record<string, string> = {
  price_changed: 'Cambio de precio',
  competitor_cheaper: 'Competidor más barato',
  competitor_pricier: 'Competidor más caro',
  price_diff_pct_above: 'Competidor más barato por %',
  price_diff_pct_below: 'Competidor más caro por %',
}

type Rule = {
  id: string
  name: string
  rule_type: string
  sku: string | null
  threshold_pct: number | null
  enabled: boolean
  created_at: string
  ml_price_alerts: [{ count: number }] | []
}

type Sku = { sku: string; title: string }

export default function RulesSection({
  initialRules,
  skus,
}: {
  initialRules: Rule[]
  skus: Sku[]
}) {
  const router = useRouter()
  const [rules, setRules] = useState<Rule[]>(initialRules)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [ruleType, setRuleType] = useState('competitor_cheaper')
  const [selectedSku, setSelectedSku] = useState('')
  const [threshold, setThreshold] = useState('')

  const needsThreshold = ['price_diff_pct_above', 'price_diff_pct_below'].includes(ruleType)

  function resetForm() {
    setName('')
    setRuleType('competitor_cheaper')
    setSelectedSku('')
    setThreshold('')
    setFormError(null)
    setShowForm(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const res = await fetch('/api/alert-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          rule_type: ruleType,
          sku: selectedSku || null,
          threshold_pct: needsThreshold ? Number(threshold) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRules(prev => [{ ...data, ml_price_alerts: [] }, ...prev])
      resetForm()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(rule: Rule) {
    const next = !rule.enabled
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: next } : r))
    await fetch(`/api/alert-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: next }),
    })
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta regla y todo su historial?')) return
    setRules(prev => prev.filter(r => r.id !== id))
    await fetch(`/api/alert-rules/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Reglas</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-sm font-medium bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span className="text-base leading-none">+</span> Nueva regla
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-blue-200 rounded-xl p-5 mb-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Nueva regla de alerta</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs text-gray-500 mb-1">Nombre</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="Ej: Competidor más barato"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tipo de regla</label>
              <select
                value={ruleType}
                onChange={e => setRuleType(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {Object.entries(RULE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">SKU (opcional — vacío = global)</label>
              <select
                value={selectedSku}
                onChange={e => setSelectedSku(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">Todos los productos</option>
                {skus.map(s => (
                  <option key={s.sku} value={s.sku}>{s.sku} — {s.title}</option>
                ))}
              </select>
            </div>
            {needsThreshold && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Umbral (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={threshold}
                  onChange={e => setThreshold(e.target.value)}
                  required
                  placeholder="Ej: 5"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            )}
          </div>
          {formError && <p className="text-xs text-red-500">{formError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar regla'}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-400 text-sm">
          No hay reglas configuradas. Creá una para empezar a recibir alertas.
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Nombre</th>
                <th className="text-left px-4 py-3 font-medium">Tipo</th>
                <th className="text-left px-4 py-3 font-medium">SKU</th>
                <th className="text-left px-4 py-3 font-medium">Umbral</th>
                <th className="text-right px-4 py-3 font-medium">Disparos</th>
                <th className="text-center px-4 py-3 font-medium">Activa</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, i) => {
                const count = Array.isArray(rule.ml_price_alerts) && rule.ml_price_alerts[0]
                  ? (rule.ml_price_alerts[0] as { count: number }).count
                  : 0
                return (
                  <tr key={rule.id} className={`border-b border-gray-50 last:border-0 ${!rule.enabled ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{rule.name}</td>
                    <td className="px-4 py-3 text-gray-600">{RULE_LABELS[rule.rule_type] ?? rule.rule_type}</td>
                    <td className="px-4 py-3">
                      {rule.sku ? (
                        <span className="font-mono text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{rule.sku}</span>
                      ) : (
                        <span className="text-gray-400 text-xs">Global</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {rule.threshold_pct != null ? `${rule.threshold_pct}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {count > 0 ? (
                        <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">{count}</span>
                      ) : (
                        <span className="text-gray-300">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(rule)}
                        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${rule.enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                      >
                        <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform ${rule.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none"
                        title="Eliminar regla"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
