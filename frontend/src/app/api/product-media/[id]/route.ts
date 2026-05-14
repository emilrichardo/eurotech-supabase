import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Returns the heavy JSONB fields (pictures, shipping, descriptions) for a single product.
// The products list query omits these to keep the page fast; they're pulled
// on-demand here when the detail panel opens.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const admin = createAdminClient()
  const { data, error } = await admin
    .schema('ml').from('ml_products')
    .select('pictures, shipping, descriptions')
    .eq('id', id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? { pictures: null, shipping: null, descriptions: null })
}
