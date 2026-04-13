import React from 'react'

type RuleType = 'competitor_cheaper' | 'competitor_pricier' | 'price_changed' | 'price_diff_pct_above' | 'price_diff_pct_below'

const ICONS: Record<RuleType, React.ReactNode> = {
  competitor_cheaper: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m0 0l-4-4m4 4l4-4" />
    </svg>
  ),
  competitor_pricier: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 20V4m0 0l-4 4m4-4l4 4" />
    </svg>
  ),
  price_changed: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  ),
  price_diff_pct_above: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m0 0l-4-4m4 4l4-4" />
    </svg>
  ),
  price_diff_pct_below: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 20V4m0 0l-4 4m4-4l4 4" />
    </svg>
  ),
}

const STYLES: Record<RuleType, { badge: string; label: string }> = {
  competitor_cheaper:    { badge: 'bg-red-100 text-red-700',          label: 'Más barato' },
  competitor_pricier:   { badge: 'bg-blue-100 text-blue-700',         label: 'Más caro' },
  price_changed:        { badge: 'bg-amber-100 text-amber-700',       label: 'Cambio precio' },
  price_diff_pct_above: { badge: 'bg-red-50 text-red-500 border border-red-200',  label: 'Más barato' },
  price_diff_pct_below: { badge: 'bg-blue-50 text-blue-500 border border-blue-200', label: 'Más caro' },
}

export default function RuleTypeBadge({
  ruleType,
  thresholdPct,
}: {
  ruleType: string
  thresholdPct?: number | null
}) {
  const type = ruleType as RuleType
  const style = STYLES[type] ?? { badge: 'bg-gray-100 text-gray-600', label: ruleType }
  const icon = ICONS[type] ?? null
  const isPct = type === 'price_diff_pct_above' || type === 'price_diff_pct_below'

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${style.badge}`}>
      {icon}
      {style.label}
      {isPct && thresholdPct != null && (
        <span className="ml-0.5 font-bold">&gt;{thresholdPct}%</span>
      )}
    </span>
  )
}
