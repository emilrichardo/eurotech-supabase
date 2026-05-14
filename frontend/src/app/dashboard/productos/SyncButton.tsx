'use client'

import { useState } from 'react'

export default function SyncButton() {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState<string | null>(null)

  async function handleSync() {
    setState('running')
    setMsg(null)
    try {
      setMsg('Sincronizando propios, catálogo y rivales...')

      const [ownResult, catalogResult, competitorsResult] = await Promise.allSettled([
        fetch('/api/sync-own', { method: 'POST' }),
        fetch('/api/sync-catalog', { method: 'POST' }),
        fetch('/api/sync-competitors', { method: 'POST' }),
      ])

      if (ownResult.status === 'rejected') throw new Error('No se pudo sincronizar propios')
      if (catalogResult.status === 'rejected') throw new Error('No se pudo sincronizar catálogo')
      if (competitorsResult.status === 'rejected') throw new Error('No se pudo sincronizar rivales')

      const [own, catalog, comp] = await Promise.all([
        ownResult.value.json(),
        catalogResult.value.json().catch(() => ({})),
        competitorsResult.value.json(),
      ])

      if (!ownResult.value.ok) throw new Error(own.error ?? own.body?.error ?? 'Error sincronizando propios')
      if (!catalogResult.value.ok) throw new Error(catalog.error ?? 'Error sincronizando catálogo')
      if (!competitorsResult.value.ok) throw new Error(comp.error ?? 'Error sincronizando rivales')

      const descriptionsPart = own.body?.descriptions_found != null
        ? ` · ${own.body.descriptions_found} descripciones`
        : ''
      const alertPart = comp.alert_error
        ? ` · alertas: ${comp.alert_error}`
        : comp.alerts_fired > 0
          ? ` · ${comp.alerts_fired} alerta(s)`
          : ''

      setMsg(`Propios: ${own.body?.upserted ?? 0}${descriptionsPart} · Rivales: ${comp.updated ?? 0}/${comp.total ?? 0}${alertPart}`)
      setState('done')
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      if (err instanceof Error) {
        setMsg(`Error: ${err.message}`)
      } else {
        setMsg('Error de red')
      }
      setState('error')
    }
  }

  const isRunning = state === 'running'

  return (
    <div className="flex items-center gap-3">
      {msg && (
        <span className={`text-xs ${state === 'error' ? 'text-red-500' : 'text-gray-400'}`}>
          {msg}
        </span>
      )}
      <button
        onClick={handleSync}
        disabled={isRunning}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-colors shadow-sm"
      >
        <svg
          className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {isRunning ? 'Sincronizando...' : 'Sincronizar'}
      </button>
    </div>
  )
}
