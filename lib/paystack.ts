/**
 * Paystack server-side integration.
 * Used for card charges (Direct Charge API) — no Paystack branding shown to users.
 *
 * Key resolution order (first non-empty wins):
 *   1. PAYSTACK_SECRET_KEY env var
 *   2. secret_key stored in admin payment-gateways panel (file store)
 */

import { fileStoreGet } from '@/lib/file-store';

const BASE = 'https://api.paystack.co';

export interface PaystackCard {
  number: string;
  cvv: string;
  expiry_month: string; // '01'–'12'
  expiry_year: string;  // '25', '26', etc.
}

export type ChargeStatus =
  | 'success'
  | 'send_otp'
  | 'send_phone'
  | 'send_birthday'
  | 'pay_offline'
  | 'failed';

export interface ChargeResult {
  status: ChargeStatus;
  reference: string;
  displayText?: string;
  message?: string;
}

export interface ChargeResponse {
  ok: boolean;
  result?: ChargeResult;
  error?: string;
}

/** Read the Paystack secret key from env var or admin gateway store. */
async function getPaystackKey(): Promise<string> {
  if (process.env.PAYSTACK_SECRET_KEY) return process.env.PAYSTACK_SECRET_KEY;
  try {
    const gateways = fileStoreGet<Array<{ id: string; enabled?: boolean; credentials: Record<string, string> }>>('payment-gateways', []);
    const gw = gateways.find((g) => g.id === 'paystack');
    return gw?.credentials?.secret_key || '';
  } catch { return ''; }
}

/** Sync check — true only when env var is set. Use isConfiguredAsync() for full check. */
export function isConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

/** Async check — also looks in the admin gateway store. */
export async function isConfiguredAsync(): Promise<boolean> {
  return Boolean(await getPaystackKey());
}

/** Charge a card directly via Paystack Direct Charge API. */
export async function chargeCard(
  email: string,
  amountKes: number,
  card: PaystackCard,
  metadata?: Record<string, unknown>,
): Promise<ChargeResponse> {
  const key = await getPaystackKey();
  if (!key) {
    return { ok: false, error: 'Card payments are not configured.' };
  }

  // Paystack expects amount in the smallest currency unit (KES × 100 = cents equivalent)
  const amountUnits = Math.round(amountKes * 100);

  try {
    const res = await fetch(`${BASE}/charge`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountUnits,
        currency: 'KES',
        card,
        metadata: metadata || {},
      }),
    });

    const data = (await res.json()) as {
      status: boolean;
      message?: string;
      data?: {
        status: string;
        reference: string;
        display_text?: string;
        gateway_response?: string;
      };
    };

    if (!data.status || !data.data) {
      return { ok: false, error: data.message || 'Charge failed.' };
    }

    const { status: chargeStatus, reference, display_text, gateway_response } = data.data;

    if (chargeStatus === 'success') {
      return { ok: true, result: { status: 'success', reference } };
    }

    if (chargeStatus === 'send_otp') {
      return {
        ok: true,
        result: { status: 'send_otp', reference, displayText: display_text },
      };
    }

    // Any other status is a failure
    return {
      ok: false,
      error: gateway_response || data.message || 'Your card could not be charged.',
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error.' };
  }
}

/** Submit OTP for a pending charge that returned send_otp. */
export async function submitOtp(
  otp: string,
  reference: string,
): Promise<ChargeResponse> {
  const key = await getPaystackKey();
  if (!key) {
    return { ok: false, error: 'Card payments are not configured.' };
  }

  try {
    const res = await fetch(`${BASE}/charge/submit_otp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ otp, reference }),
    });

    const data = (await res.json()) as {
      status: boolean;
      message?: string;
      data?: { status: string; reference: string; gateway_response?: string };
    };

    if (!data.status || !data.data) {
      return { ok: false, error: data.message || 'OTP verification failed.' };
    }

    if (data.data.status === 'success') {
      return {
        ok: true,
        result: {
          status: 'success',
          reference: data.data.reference || reference,
        },
      };
    }

    return {
      ok: false,
      error: data.data.gateway_response || data.message || 'Incorrect OTP.',
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error.' };
  }
}

/** Verify a completed transaction by reference. */
export async function verifyTransaction(
  reference: string,
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const key = await getPaystackKey();
  if (!key) return { ok: false, error: 'Not configured.' };

  try {
    const res = await fetch(
      `${BASE}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    const data = (await res.json()) as {
      status: boolean;
      data?: { status: string };
    };
    const txnStatus = data.data?.status;
    return { ok: txnStatus === 'success', status: txnStatus };
  } catch {
    return { ok: false, error: 'Verification failed.' };
  }
}
