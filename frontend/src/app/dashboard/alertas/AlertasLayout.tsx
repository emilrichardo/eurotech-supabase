'use client'

import { useState } from 'react'
import RulesSection from './RulesSection'
import HistorySection from './HistorySection'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = { rules: any[]; alerts: any[]; skus: { sku: string; title: string }[]; unreadCount: number }

export default function AlertasLayout({ rules, alerts, skus, unreadCount }: Props) {
  const [showRules, setShowRules] = useState(false)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alertas de precio</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Alertas disparadas por cambios en precios de competidores
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
              {unreadCount} sin leer
            </span>
          )}
          <button
            onClick={() => setShowRules(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Reglas
            {rules.length > 0 && (
              <span className="text-xs text-gray-400 font-normal">{rules.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* History */}
      <HistorySection
        initialAlerts={alerts}
        skus={skus}
        rules={rules.map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }))}
      />

      {/* Rules panel */}
      {showRules && (
        <div className="fixed inset-0 z-40" onClick={() => setShowRules(false)}>
          <div
            className="absolute top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-base font-semibold text-gray-900">Reglas de alerta</h2>
              <button
                onClick={() => setShowRules(false)}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <RulesSection initialRules={rules} skus={skus} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
