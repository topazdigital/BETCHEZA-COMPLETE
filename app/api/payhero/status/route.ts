import { NextRequest, NextResponse } from 'next/server';
import { getPending } from '@/lib/payhero';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Polling endpoint — frontend calls this every few seconds after initiating
// an STK push to find out whether PayHero has confirmed the payment.
export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get('reference') || '';
  if (!reference) {
    return NextResponse.json({ error: 'reference required' }, { status: 400 });
  }

  const pending = getPending(reference);

  if (!pending) {
    // Not found means it was processed (completed) and removed, or never existed
    return NextResponse.json({ status: 'completed', reference });
  }

  return NextResponse.json({ status: pending.status, reference });
}
