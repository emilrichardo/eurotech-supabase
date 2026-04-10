import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ml_price_alert_rules')
    .select('*, ml_price_alerts(count)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, rule_type, sku, threshold_pct } = body

  if (!name || !rule_type) {
    return NextResponse.json({ error: 'name y rule_type son requeridos' }, { status: 400 })
  }

  const needsThreshold = ['price_diff_pct_above', 'price_diff_pct_below'].includes(rule_type)
  if (needsThreshold && (threshold_pct == null || isNaN(Number(threshold_pct)))) {
    return NextResponse.json({ error: 'threshold_pct es requerido para este tipo de regla' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ml_price_alert_rules')
    .insert({
      name,
      rule_type,
      sku: sku || null,
      threshold_pct: needsThreshold ? Number(threshold_pct) : null,
      enabled: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
