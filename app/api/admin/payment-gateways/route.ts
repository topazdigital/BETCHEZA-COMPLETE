import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { query } from '@/lib/db'
import { fileStoreGet, fileStoreSet } from '@/lib/file-store'

export interface PaymentGateway {
  id: string
  name: string
  provider: string
  enabled: boolean
  countries: string[]
  currencies: string[]
  type: 'card' | 'mobile_money' | 'bank' | 'crypto' | 'ewallet' | 'regional'
  credentials: Record<string, string>
  fees?: { percent: number; fixed: number; currency: string }
  minAmount?: number
  maxAmount?: number
  supportsPayouts: boolean
  logoUrl?: string
}

export interface PayoutSettings {
  minimumPayoutAmount: number
  payoutSchedule: 'instant' | 'daily' | 'weekly' | 'monthly'
  payoutCurrency: string
  platformFeePercent: number
  tipsterSharePercent: number
  autoPayouts: boolean
  payoutMethods: string[]
}

const DEFAULT_GATEWAYS: PaymentGateway[] = [
  { id: 'stripe', name: 'Stripe', provider: 'stripe', enabled: false, countries: ['US','GB','CA','AU','EU'], currencies: ['USD','GBP','EUR','AUD','CAD'], type: 'card', credentials: { publishable_key: '', secret_key: '', webhook_secret: '' }, fees: { percent: 2.9, fixed: 0.30, currency: 'USD' }, minAmount: 1, maxAmount: 999999, supportsPayouts: true, logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg' },
  { id: 'paypal', name: 'PayPal', provider: 'paypal', enabled: false, countries: ['US','GB','CA','AU','EU'], currencies: ['USD','GBP','EUR','AUD','CAD'], type: 'ewallet', credentials: { client_id: '', client_secret: '', mode: 'sandbox' }, fees: { percent: 3.49, fixed: 0.49, currency: 'USD' }, minAmount: 1, maxAmount: 10000, supportsPayouts: true, logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg' },
  { id: 'mpesa', name: 'M-Pesa', provider: 'safaricom', enabled: false, countries: ['KE','TZ','UG'], currencies: ['KES','TZS','UGX'], type: 'mobile_money', credentials: { consumer_key: '', consumer_secret: '', passkey: '', shortcode: '' }, fees: { percent: 1.5, fixed: 0, currency: 'KES' }, minAmount: 1, maxAmount: 300000, supportsPayouts: true },
  { id: 'flutterwave', name: 'Flutterwave', provider: 'flutterwave', enabled: false, countries: ['NG','GH','KE','ZA'], currencies: ['NGN','GHS','KES','ZAR'], type: 'regional', credentials: { public_key: '', secret_key: '', encryption_key: '' }, fees: { percent: 1.4, fixed: 0, currency: 'NGN' }, minAmount: 100, maxAmount: 10000000, supportsPayouts: true },
  { id: 'paystack', name: 'Paystack', provider: 'paystack', enabled: false, countries: ['NG','GH','ZA','KE'], currencies: ['NGN','GHS','ZAR','KES'], type: 'regional', credentials: { public_key: '', secret_key: '' }, fees: { percent: 1.5, fixed: 100, currency: 'NGN' }, minAmount: 50, maxAmount: 5000000, supportsPayouts: false },
  { id: 'bank-transfer', name: 'Bank Transfer', provider: 'bank', enabled: false, countries: ['ALL'], currencies: ['USD','EUR','GBP'], type: 'bank', credentials: { bank_name: '', account_number: '', iban: '', swift: '' }, fees: { percent: 0, fixed: 5, currency: 'USD' }, minAmount: 10, maxAmount: 999999, supportsPayouts: true },
  { id: 'crypto-usdt', name: 'Crypto (USDT/BTC)', provider: 'coinpayments', enabled: false, countries: ['ALL'], currencies: ['USDT','BTC','ETH'], type: 'crypto', credentials: { public_key: '', private_key: '', merchant_id: '' }, fees: { percent: 0.5, fixed: 0, currency: 'USDT' }, minAmount: 1, maxAmount: 999999, supportsPayouts: true },
]

const DEFAULT_PAYOUT_SETTINGS: PayoutSettings = {
  minimumPayoutAmount: 10, payoutSchedule: 'weekly', payoutCurrency: 'USD',
  platformFeePercent: 20, tipsterSharePercent: 80, autoPayouts: false,
  payoutMethods: ['paypal', 'bank-transfer', 'crypto-usdt'],
}

const g = globalThis as { __gwStore?: PaymentGateway[]; __pwStore?: PayoutSettings };

async function loadGateways(): Promise<PaymentGateway[]> {
  if (g.__gwStore) return g.__gwStore;
  try {
    const result = await query<{ value: string }>(
      "SELECT value FROM admin_settings WHERE name = 'payment_gateways' LIMIT 1"
    );
    const rows = result.rows;
    if (rows?.length && rows[0].value) { g.__gwStore = JSON.parse(rows[0].value); return g.__gwStore!; }
  } catch {}
  const stored = fileStoreGet<PaymentGateway[] | null>('payment-gateways', null);
  if (stored && stored.length > 0) { g.__gwStore = stored; return g.__gwStore; }
  g.__gwStore = DEFAULT_GATEWAYS;
  return g.__gwStore;
}

async function saveGateways(gateways: PaymentGateway[]): Promise<void> {
  g.__gwStore = gateways;
  fileStoreSet('payment-gateways', gateways);
  try {
    await query(
      `INSERT INTO admin_settings (name, value, type, description) VALUES ('payment_gateways', ?, 'json', 'Payment gateway configuration') ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(gateways)]
    );
  } catch {}
}

async function loadPayoutSettings(): Promise<PayoutSettings> {
  if (g.__pwStore) return g.__pwStore;
  try {
    const result = await query<{ value: string }>(
      "SELECT value FROM admin_settings WHERE name = 'payout_settings' LIMIT 1"
    );
    const rows = result.rows;
    if (rows?.length && rows[0].value) { g.__pwStore = JSON.parse(rows[0].value); return g.__pwStore!; }
  } catch {}
  const stored = fileStoreGet<PayoutSettings | null>('payout-settings', null);
  if (stored) { g.__pwStore = stored; return g.__pwStore; }
  g.__pwStore = DEFAULT_PAYOUT_SETTINGS;
  return g.__pwStore;
}

async function savePayoutSettings(settings: PayoutSettings): Promise<void> {
  g.__pwStore = settings;
  fileStoreSet('payout-settings', settings);
  try {
    await query(
      `INSERT INTO admin_settings (name, value, type, description) VALUES ('payout_settings', ?, 'json', 'Tipster payout configuration') ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(settings)]
    );
  } catch {}
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const [gatewayStore, payoutStore] = await Promise.all([loadGateways(), loadPayoutSettings()])
    const masked = gatewayStore.map((gw) => ({
      ...gw,
      credentials: Object.fromEntries(
        Object.entries(gw.credentials).map(([k, v]) => [k, v ? `${v.slice(0, 4)}${'•'.repeat(Math.max(0, v.length - 4))}` : ''])
      ),
    }))
    return NextResponse.json({ gateways: masked, payoutSettings: payoutStore })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    if (body.gateways) {
      const gatewayStore = await loadGateways()
      const updated = (body.gateways as PaymentGateway[]).map((incoming) => {
        const existing = gatewayStore.find((gw) => gw.id === incoming.id)
        const mergedCredentials = existing
          ? Object.fromEntries(Object.entries(incoming.credentials).map(([k, v]) => {
              const isMasked = /^.{1,4}•+$/.test(v)
              return [k, isMasked && existing.credentials[k] ? existing.credentials[k] : v]
            }))
          : incoming.credentials
        return { ...incoming, credentials: mergedCredentials }
      })
      await saveGateways(updated)
    }
    if (body.payoutSettings) {
      const payoutStore = await loadPayoutSettings()
      await savePayoutSettings({ ...payoutStore, ...body.payoutSettings })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id, enabled } = await req.json()
    const gatewayStore = await loadGateways()
    const updated = gatewayStore.map((gw) => gw.id === id ? { ...gw, enabled } : gw)
    await saveGateways(updated)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
