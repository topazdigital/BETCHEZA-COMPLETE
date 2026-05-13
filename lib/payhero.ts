import fs from 'fs';
import path from 'path';
import { fileStoreGet } from './file-store';

const BASE_URL = 'https://backend.payhero.co.ke/api/v2';

interface SavedGateway {
  id: string;
  enabled: boolean;
  credentials: Record<string, string>;
}

/** Read PayHero credentials: admin-panel file store takes priority, then env vars. */
function getCredentials(): { token: string | null; channelId: number } {
  try {
    const gateways = fileStoreGet<SavedGateway[] | null>('payment-gateways', null);
    const gw = gateways?.find((g) => g.id === 'payhero');
    if (gw?.credentials?.basic_token && gw.credentials.basic_token.length > 10) {
      const token = gw.credentials.basic_token;
      const rawId = gw.credentials.channel_id || gw.credentials.account_id || '0';
      const channelId = parseInt(rawId, 10);
      return { token, channelId };
    }
  } catch { /* fall through */ }
  return {
    token: process.env.PAYHERO_BASIC_TOKEN || null,
    channelId: parseInt(process.env.PAYHERO_CHANNEL_ID || process.env.PAYHERO_ACCOUNT_ID || '0', 10),
  };
}

function getToken(): string | null { return getCredentials().token; }
function getChannelId(): number { return getCredentials().channelId; }

function getCallbackUrl(): string {
  // REPLIT_DEV_DOMAIN is auto-injected by Replit runtime (e.g. "abc123.picard.replit.dev")
  // Always use it when available so the callback URL matches the live dev server.
  const replitDomain = process.env.REPLIT_DEV_DOMAIN;
  if (replitDomain) return `https://${replitDomain}/api/payhero/callback`;

  // For production: prefer explicitly-set APP_URL, then SITE_URL, then prod fallback
  const base =
    process.env.APP_URL ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://betcheza.co.ke';
  return `${base}/api/payhero/callback`;
}

/** Extract a human-readable error from a PayHero API response. */
function extractPayHeroError(data: Record<string, unknown>, status: number): string {
  const msg =
    (data.error_message as string) ||
    (data.detail as string) ||
    (data.message as string) ||
    (data.error as string) ||
    (data.description as string) ||
    (data.errors as string) ||
    null;
  if (msg) return msg;
  for (const v of Object.values(data)) {
    if (typeof v === 'string' && v.length > 0) return v;
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string') return v[0];
  }
  return `PayHero returned HTTP ${status} — check your credentials and channel ID in Admin → Gateways.`;
}

export function isConfigured(): boolean {
  const token = getToken();
  const channelId = getChannelId();
  console.log('[payhero] isConfigured check: tokenLen=' + (token?.length || 0) + ' channelId=' + channelId);
  return !!token && channelId > 0;
}

export function normalizeKenyanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '254' + digits.slice(1);
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) return '254' + digits;
  return digits;
}

export interface StkPushResult { ok: boolean; reference: string; checkoutRequestId?: string; error?: string; }

export async function initiateStkPush(amount: number, phone: string, reference: string): Promise<StkPushResult> {
  const token = getToken();
  const channelId = getChannelId();
  if (!token || !channelId) return { ok: false, reference, error: 'PayHero not configured' };
  const normalizedPhone = normalizeKenyanPhone(phone);
  const callbackUrl = getCallbackUrl();
  console.log(`[payhero] STK push KES ${amount} -> ${normalizedPhone} ref=${reference} channel=${channelId} callback=${callbackUrl}`);
  try {
    const res = await fetch(`${BASE_URL}/payments`, {
      method: 'POST',
      headers: { 'Authorization': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, phone_number: normalizedPhone, channel_id: channelId, provider: 'm-pesa', external_reference: reference, callback_url: callbackUrl }),
    });
    let data: Record<string, unknown> = {};
    try { data = await res.json(); } catch {}
    console.log(`[payhero] STK response (${res.status}):`, JSON.stringify(data));
    if (res.status === 401) return { ok: false, reference, error: 'PayHero authentication failed — check your Basic Token in Admin → Gateways.' };
    const errMsg = extractPayHeroError(data, res.status);
    if (!res.ok || data.success === false) return { ok: false, reference, error: errMsg };
    return { ok: true, reference, checkoutRequestId: (data.CheckoutRequestID || data.checkout_request_id) as string | undefined };
  } catch (e: unknown) {
    console.error('[payhero] STK push error:', e);
    return { ok: false, reference, error: String(e) };
  }
}

/**
 * Directly query the PayHero API for a transaction status.
 * This is used as a backup polling mechanism when the webhook callback
 * is not received (e.g. network issues, domain mismatch).
 */
export async function checkTransactionStatus(reference: string): Promise<'pending' | 'completed' | 'failed'> {
  const token = getToken();
  if (!token) return 'pending';
  try {
    const res = await fetch(`${BASE_URL}/payments?external_reference=${encodeURIComponent(reference)}`, {
      headers: { 'Authorization': token, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return 'pending';
    const data = await res.json() as { results?: Array<{ status?: string; transaction_status?: string }>; status?: string; transaction_status?: string };

    // Handle paginated response { results: [...] }
    let statusStr: string | undefined;
    if (Array.isArray(data.results) && data.results.length > 0) {
      statusStr = data.results[0].status || data.results[0].transaction_status;
    } else {
      statusStr = data.status || data.transaction_status;
    }

    if (!statusStr) return 'pending';
    const s = statusStr.toUpperCase();
    if (s === 'SUCCESS' || s === 'COMPLETED' || s === 'COMPLETE') return 'completed';
    if (s === 'FAILED' || s === 'CANCELLED' || s === 'CANCELED' || s === 'REJECTED') return 'failed';
    return 'pending';
  } catch {
    return 'pending';
  }
}

export interface WithdrawResult { ok: boolean; reference: string; error?: string; }

export async function initiateWithdrawal(amount: number, phone: string, reference: string): Promise<WithdrawResult> {
  const token = getToken();
  const channelId = getChannelId();
  if (!token || !channelId) return { ok: false, reference, error: 'PayHero not configured' };
  const normalizedPhone = normalizeKenyanPhone(phone);
  const callbackUrl = getCallbackUrl();
  try {
    const res = await fetch(`${BASE_URL}/withdraw`, {
      method: 'POST',
      headers: { 'Authorization': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, phone_number: normalizedPhone, channel_id: channelId, provider: 'm-pesa', external_reference: reference, callback_url: callbackUrl }),
    });
    let data: Record<string, unknown> = {};
    try { data = await res.json(); } catch {}
    if (!res.ok || data.success === false) return { ok: false, reference, error: (data.message as string) || 'Withdrawal failed' };
    return { ok: true, reference };
  } catch (e: unknown) {
    return { ok: false, reference, error: String(e) };
  }
}

const STORE_PATH = path.join(process.cwd(), '.local', 'state', 'payhero-pending.json');
const g = globalThis as { __phPending?: Map<string, PendingTx> };

export interface PendingTx { userId: number; amount: number; currency: string; phone: string; type: 'deposit' | 'withdraw'; status: 'pending' | 'completed' | 'failed'; createdAt: string; }

function getStore(): Map<string, PendingTx> {
  if (g.__phPending) return g.__phPending;
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    if (fs.existsSync(STORE_PATH)) {
      const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as Record<string, PendingTx>;
      g.__phPending = new Map(Object.entries(data));
    } else {
      g.__phPending = new Map();
    }
  } catch { g.__phPending = new Map(); }
  return g.__phPending;
}
function saveStore(): void {
  try { const store = getStore(); const obj: Record<string, PendingTx> = {}; store.forEach((v, k) => { obj[k] = v; }); fs.writeFileSync(STORE_PATH, JSON.stringify(obj, null, 2), 'utf8'); } catch {}
}
export function storePending(reference: string, tx: PendingTx): void { getStore().set(reference, tx); saveStore(); }
export function getPending(reference: string): PendingTx | undefined { return getStore().get(reference); }
export function updatePendingStatus(reference: string, status: PendingTx['status']): void { const store = getStore(); const existing = store.get(reference); if (existing) { store.set(reference, { ...existing, status }); saveStore(); } }
export function deletePending(reference: string): void { getStore().delete(reference); saveStore(); }
