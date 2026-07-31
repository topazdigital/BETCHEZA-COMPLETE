import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserTwoFactor, setUserTwoFactor } from '@/lib/two-factor-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ ...getUserTwoFactor(user.userId) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const enabled = !!body.enabled;
  const method: 'email' | 'sms' = body.method === 'sms' ? 'sms' : 'email';
  const phone = typeof body.phone === 'string' ? body.phone : undefined;
  const carrier = typeof body.carrier === 'string' ? body.carrier : undefined;
  if (enabled && method === 'sms' && (!phone || !carrier)) {
    return NextResponse.json(
      { error: 'Phone number and carrier are required for SMS two-factor.' },
      { status: 400 }
    );
  }
  setUserTwoFactor(user.userId, {
    enabled,
    method,
    phone: enabled && method === 'sms' ? phone : undefined,
    carrier: enabled && method === 'sms' ? (carrier as never) : undefined,
  });
  return NextResponse.json({ success: true });
}
