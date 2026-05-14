import { NextResponse } from 'next/server'

// Invokes the ml-sync edge function (which pulls the seller's own items from ML).
// The UI calls this as fire-and-forget because ml-sync can take 1-2 minutes
// with the /items/{id}/prices calls enabled.
export async function POST() {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ml-sync`
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) return NextResponse.json({ error: 'missing SUPABASE_SECRET_KEY' }, { status: 500 })

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        'x-sync-secret': key,
        ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: '{}',
    })
    const text = await res.text()
    let body: unknown
    try { body = JSON.parse(text) } catch { body = text }
    return NextResponse.json({ status: res.status, body }, { status: res.ok ? 200 : 502 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
