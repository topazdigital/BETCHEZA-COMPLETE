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
  // Check admin-panel saved gateways first (file store / DB-backed)
  try {
    const gateways = fileStoreGet<SavedGateway[] | null>('payment-gateways', null);
    const gw = gateways?.find((g) => g.id === 'payhero');
    if (gw?.credentials?.basic_token && gw.credentials.basic_token.length > 10) {
      const token = gw.credentials.basic_token;
      const channelId = parseInt(gw.credentials.account_id || '0', 10);
      return { token, channelId };
    }
  } catch { /* fall through */ }
  // Fall back to environment variables
  return {
    token: process.env.PAYHERO_BASIC_TOKEN || null,
    channelId: parseInt(process.env.PAYHERO_ACCOUNT_ID || '0', 10),
  };
}

function getToken(): string | null {
  return getCredentials().token;
}

function getChannelId(): number {
  return getCredentials().channelId;
}

function getCallbackUrl(): string {
  const domain =
    process.env.REPLIT_DEV_DOMAIN ||
    (process.env.REPLIT_DOMAINS || '').split(',')[0]?.trim();
  if (!domain) return 'https://localhost:5000/api/payhero/callback';
  return `https://${domain}/api/payhero/callback`;
}

export function isConfigured(): boolean {
  const token = getToken();
  const channelId = getChannelId();
  return !!token && channelId > 0;
}

export function normalizeKenyanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '254' + digits.slice(1);
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) return '254' + digits;
  return digits;
}

export interface StkPushResult {
  ok: boolean;
  reference: string;
  checkoutRequestId?: string;
  error?: string;
}

export async function initiateStkPush(
  amount: number,
  phone: string,
  reference: string,
): Promise<StkPushResult> {
  const token = getToken();
  const channelId = getChannelId();
  if (!token || !channelId) {
    return { ok: false, reference, error: 'PayHero not configured' };
  }

  const normalizedPhone = normalizeKenyanPhone(phone);
  console.log(`[payhero] STK push KES ${amount} → ${normalizedPhone}, ref=${reference}`);

  try {
    const res = await fetch(`${BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        phone_number: normalizedPhone,
        channel_id: channelId,
        provider: 'm-pesa',
        external_reference: reference,
        callback_url: getCallbackUrl(),
      }),
    });

    let data: Record<string, unknown> = {};
    try { data = await res.json(); } catch {}

    console.log(`[payhero] STK response (${res.status}):`, JSON.stringify(data));

    if (!res.ok || data.success === false) {
      return { ok: false, reference, error: (data.message as string) || 'STK push failed' };
    }
    return {
      ok: true,
      reference,
      checkoutRequestId: (data.CheckoutRequestID || data.checkout_request_id) as string | undefined,
    };
  } catch (e: unknown) {
    console.error('[payhero] STK push error:', e);
    return { ok: false, reference, error: String(e) };
  }
}

export interface WithdrawResult {
  ok: boolean;
  reference: string;
  error?: string;
}

export async function initiateWithdrawal(
  amount: number,
  phone: string,
  reference: string,
): Promise<WithdrawResult> {
  const token = getToken();
  const channelId = getChannelId();
  if (!token || !channelId) {
    return { ok: false, reference, error: 'PayHero not configured' };
  }

  const normalizedPhone = normalizeKenyanPhone(phone);
  console.log(`[payhero] Withdrawal KES ${amount} → ${normalizedPhone}, ref=${reference}`);

  try {
    const res = await fetch(`${BASE_URL}/withdraw`, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        phone_number: normalizedPhone,
        network: 'safaricom',
        channel_id: channelId,
        provider: 'm-pesa',
        external_reference: reference,
        callback_url: getCallbackUrl(),
        account_id: channelId,
      }),
    });

    let data: Record<string, unknown> = {};
    try { data = await res.json(); } catch {}

    console.log(`[payhero] Withdraw response (${res.status}):`, JSON.stringify(data));

    if (!res.ok || data.success === false) {
      return { ok: false, reference, error: (data.message as string) || 'Withdrawal failed' };
    }
    return { ok: true, reference };
  } catch (e: unknown) {
    console.error('[payhero] Withdrawal error:', e);
    return { ok: false, reference, error: String(e) };
  }
}

// ---------------------------------------------------------------------------
// Pending transaction store (in-memory + file-backed)
// Tracks STK pushes and withdrawals that are awaiting PayHero callback
// ---------------------------------------------------------------------------
export interface PendingTx {
  userId: number;
  amount: number;
  currency: string;
  phone: string;
  type: 'deposit' | 'withdraw';
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

const STORE_PATH = path.join(process.cwd(), '.local', 'state', 'payhero-pending.json');
const g = globalThis as { __phPending?: Map<string, PendingTx> };

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
  } catch {
    g.__phPending = new Map();
  }
  return g.__phPending;
}

function saveStore(): void {
  try {
    const store = getStore();
    const obj: Record<string, PendingTx> = {};
    store.forEach((v, k) => { obj[k] = v; });
    fs.writeFileSync(STORE_PATH, JSON.stringify(obj, null, 2), 'utf8');
  } catch {}
}

export function storePending(reference: string, tx: PendingTx): void {
  getStore().set(reference, tx);
  saveStore();
}

export function getPending(reference: string): PendingTx | undefined {
  return getStore().get(reference);
}

export function updatePendingStatus(reference: string, status: PendingTx['status']): void {
  const store = getStore();
  const existing = store.get(reference);
  if (existing) {
    store.set(reference, { ...existing, status });
    saveStore();
  }
}

export function deletePending(reference: string): void {
  getStore().delete(reference);
  saveStore();
}
