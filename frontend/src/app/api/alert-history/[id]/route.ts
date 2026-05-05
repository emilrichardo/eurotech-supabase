import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const { error } = await admin
    .schema('ml').from('ml_price_alerts')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const { error } = await admin
    .schema('ml').from('ml_price_alerts')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
