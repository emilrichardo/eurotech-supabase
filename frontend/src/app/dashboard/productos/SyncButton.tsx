'use client'

import { useState } from 'react'

export default function SyncButton() {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState<string | null>(null)

  async function handleSync() {
    setState('running')
    setMsg(null)
    try {
      // ml-sync + sync-catalog toman 1-2 min cada uno — disparar sin esperar
      fetch('/api/sync-own', { method: 'POST' }).catch(() => {})
      fetch('/api/sync-catalog', { method: 'POST' }).catch(() => {})

      // sync-competitors es rápido — esperar resultado
      const competitorsRes = await fetch('/api/sync-competitors', { method: 'POST' })
      const comp = await competitorsRes.json()

      if (competitorsRes.ok) {
        const alertPart = comp.alert_error
          ? ` · ⚠ alertas: ${comp.alert_error}`
          : comp.alerts_fired > 0
            ? ` · ${comp.alerts_fired} alerta(s)`
            : ''
        setMsg(`Rivales: ${comp.updated ?? 0}/${comp.total ?? 0}${alertPart} · Propios y catálogo actualizándose...`)
        setState('done')
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setMsg(`Error: ${comp.error ?? 'desconocido'}`)
        setState('error')
      }
    } catch {
      setMsg('Error de red')
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
