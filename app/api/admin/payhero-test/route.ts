import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { fileStoreGet } from '@/lib/file-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BASE_URL = 'https://backend.payhero.co.ke/api/v2';

interface SavedGateway {
  id: string;
  enabled: boolean;
  credentials: Record<string, string>;
}

function getCredentials(): { token: string | null; channelId: number } {
  try {
    const gateways = fileStoreGet<SavedGateway[] | null>('payment-gateways', null);
    const gw = gateways?.find((g) => g.id === 'payhero');
    if (gw?.credentials?.basic_token && gw.credentials.basic_token.length > 10) {
      const token = gw.credentials.basic_token;
      const rawId = gw.credentials.channel_id || gw.credentials.account_id || '0';
      return { token, channelId: parseInt(rawId, 10) };
    }
  } catch { /* fall through */ }
  return {
    token: process.env.PAYHERO_BASIC_TOKEN || null,
    channelId: parseInt(process.env.PAYHERO_CHANNEL_ID || process.env.PAYHERO_ACCOUNT_ID || '0', 10),
  };
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 });
  }

  const { token, channelId } = getCredentials();

  if (!token) {
    return NextResponse.json({ ok: false, error: 'No Basic Token configured. Go to Admin → Gateways → PayHero and enter your token.' });
  }
  if (!channelId) {
    return NextResponse.json({ ok: false, error: 'No Channel ID configured. Go to Admin → Gateways → PayHero and enter your channel ID.' });
  }

  const tokenPreview = token.length > 12 ? token.slice(0, 8) + '…' + token.slice(-4) : token.slice(0, 4) + '…';
  const startsWithBasic = token.toLowerCase().startsWith('basic ');

  let body: Record<string, unknown> = {};
  let status = 0;
  let rawText = '';
  let networkError: string | null = null;

  try {
    const testBody = await req.json().catch(() => ({}));
    const phone = (testBody.phone as string) || '';
    const amount = Number(testBody.amount) || 1;

    const digits = phone.replace(/\D/g, '');
    const normalized = digits.startsWith('254') && digits.length === 12
      ? digits
      : digits.startsWith('0') && digits.length === 10
        ? '254' + digits.slice(1)
        : digits.startsWith('7') || digits.startsWith('1') && digits.length === 9
          ? '254' + digits
          : digits;

    const payload = {
      amount,
      phone_number: normalized,
      channel_id: channelId,
      provider: 'm-pesa',
      external_reference: `BETCHEZA-TEST-${Date.now()}`,
      callback_url: 'https://betcheza.co.ke/api/payhero/callback',
    };

    const res = await fetch(`${BASE_URL}/payments`, {
      method: 'POST',
      headers: { 'Authorization': token, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    status = res.status;
    rawText = await res.text();
    try { body = JSON.parse(rawText); } catch { body = { raw: rawText }; }
  } catch (e) {
    networkError = String(e);
  }

  return NextResponse.json({
    ok: status >= 200 && status < 300 && body.success !== false,
    credentials: {
      tokenPreview,
      startsWithBasic,
      channelId,
    },
    httpStatus: status,
    responseBody: body,
    networkError,
    hint: !startsWithBasic
      ? 'Your token does not start with "Basic " — make sure you copied the full token from PayHero → API Keys (it should start with "Basic ")'
      : status === 401
        ? 'HTTP 401 = wrong or expired token. Re-copy the full Basic token from PayHero → API Keys.'
        : status === 400
          ? (String((body as Record<string,unknown>).error_message || '').toLowerCase().includes('insufficient')
              ? 'Insufficient balance in your PayHero float — log in to app.payhero.co.ke → Wallet → Add Money, top up (even KES 500 is enough to start), then try again.'
              : 'HTTP 400 = bad request. Check the channel ID and phone format.')
          : status === 404
            ? 'HTTP 404 = channel not found. Double-check the Channel ID (from PayHero → Payment Channels).'
            : null,
  });
}
