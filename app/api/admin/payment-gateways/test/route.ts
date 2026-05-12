import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json() as { basic_token?: string; channel_id?: string }
  const token = (body.basic_token || '').replace(/[•]/g, '').trim()
  const channelId = parseInt(body.channel_id || '0', 10)
  if (!token || token.length < 10) return NextResponse.json({ success: false, message: 'Enter a valid Basic Token first.' })
  if (!channelId) return NextResponse.json({ success: false, message: 'Enter a valid Channel ID (from PayHero → Payment Channels).' })
  const res = await fetch('https://backend.payhero.co.ke/api/v2/payments', {
    method: 'POST',
    headers: { 'Authorization': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 1, phone_number: '254700000001', channel_id: channelId, provider: 'm-pesa', external_reference: `TEST-${Date.now()}`, callback_url: 'https://betcheza.co.ke/api/payhero/callback' }),
  })
  let data: Record<string, unknown> = {}
  try { data = await res.json() } catch {}
  if (res.status === 401) return NextResponse.json({ success: false, message: 'Authentication failed (401). Regenerate your API key from PayHero → API Keys.' })
  if (res.status === 403) return NextResponse.json({ success: false, message: 'Wrong Channel ID (403). Check PayHero → Payment Channels.' })
  return NextResponse.json({ success: true, message: res.ok ? 'Credentials valid!' : `Auth OK. PayHero: ${data.message || res.statusText}` })
}
