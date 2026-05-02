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

// ── In-memory defaults (swap for DB queries when ready) ──
const DEFAULT_GATEWAYS: PaymentGateway[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    provider: 'stripe',
    enabled: false,
    countries: ['US', 'GB', 'CA', 'AU', 'EU', 'DE', 'FR', 'NL', 'IT', 'ES'],
    currencies: ['USD', 'GBP', 'EUR', 'AUD', 'CAD'],
    type: 'card',
    credentials: { publishable_key: '', secret_key: '', webhook_secret: '' },
    fees: { percent: 2.9, fixed: 0.30, currency: 'USD' },
    minAmount: 1,
    maxAmount: 999999,
    supportsPayouts: true,
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg',
  },
  {
    id: 'paypal',
    name: 'PayPal',
    provider: 'paypal',
    enabled: false,
    countries: ['US', 'GB', 'CA', 'AU', 'EU', 'DE', 'FR', 'NL', 'IT', 'ES', 'BR'],
    currencies: ['USD', 'GBP', 'EUR', 'AUD', 'CAD', 'BRL'],
    type: 'ewallet',
    credentials: { client_id: '', client_secret: '', mode: 'sandbox' },
    fees: { percent: 3.49, fixed: 0.49, currency: 'USD' },
    minAmount: 1,
    maxAmount: 10000,
    supportsPayouts: true,
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg',
  },
  {
    id: 'google-pay',
    name: 'Google Pay',
    provider: 'google',
    enabled: false,
    countries: ['US', 'GB', 'CA', 'AU', 'EU', 'DE', 'FR', 'NL', 'IT', 'ES', 'IN', 'JP', 'KE', 'NG', 'ZA'],
    currencies: ['USD', 'GBP', 'EUR', 'AUD', 'CAD', 'INR', 'JPY', 'KES', 'NGN', 'ZAR'],
    type: 'ewallet',
    credentials: {
      merchant_id: '',
      gateway_merchant_id: '',
      gateway: 'stripe',
      public_key: '',
    },
    fees: { percent: 2.9, fixed: 0.30, currency: 'USD' },
    minAmount: 1,
    maxAmount: 100000,
    supportsPayouts: false,
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg',
  },
  {
    id: 'mpesa',
    name: 'M-Pesa',
    provider: 'safaricom',
    enabled: false,
    countries: ['KE', 'TZ', 'UG', 'ET', 'GH', 'ZA', 'MZ', 'CD', 'LS'],
    currencies: ['KES', 'TZS', 'UGX', 'ETB', 'GHS', 'ZAR'],
    type: 'mobile_money',
    credentials: {
      consumer_key: '',
      consumer_secret: '',
      passkey: '',
      shortcode: '',
      initiator_name: '',
      security_credential: '',
    },
    fees: { percent: 1.5, fixed: 0, currency: 'KES' },
    minAmount: 1,
    maxAmount: 300000,
    supportsPayouts: true,
  },
  {
    id: 'mpesa-payhero',
    name: 'M-Pesa via Payhero',
    provider: 'payhero',
    enabled: false,
    countries: ['KE'],
    currencies: ['KES'],
    type: 'mobile_money',
    credentials: {
      api_username: '',
      api_password: '',
      channel_id: '',
      callback_url: '',
    },
    fees: { percent: 1.0, fixed: 0, currency: 'KES' },
    minAmount: 10,
    maxAmount: 250000,
    supportsPayouts: true,
  },
  {
    id: 'mpesa-pesapal',
    name: 'M-Pesa via Pesapal',
    provider: 'pesapal',
    enabled: false,
    countries: ['KE', 'TZ', 'UG', 'RW', 'MW', 'ZM', 'ZW'],
    currencies: ['KES', 'TZS', 'UGX', 'RWF', 'USD'],
    type: 'mobile_money',
    credentials: {
      consumer_key: '',
      consumer_secret: '',
      ipn_id: '',
      callback_url: '',
    },
    fees: { percent: 3.5, fixed: 0, currency: 'KES' },
    minAmount: 10,
    maxAmount: 1000000,
    supportsPayouts: true,
  },
  {
    id: 'mpesa-intasend',
    name: 'M-Pesa via IntaSend',
    provider: 'intasend',
    enabled: false,
    countries: ['KE', 'UG'],
    currencies: ['KES', 'UGX', 'USD'],
    type: 'mobile_money',
    credentials: {
      publishable_key: '',
      secret_key: '',
      webhook_secret: '',
    },
    fees: { percent: 1.5, fixed: 0, currency: 'KES' },
    minAmount: 10,
    maxAmount: 500000,
    supportsPayouts: true,
  },
  {
    id: 'mtn',
    name: 'MTN Mobile Money',
    provider: 'mtn',
    enabled: false,
    countries: ['NG', 'GH', 'UG', 'CM', 'CI', 'ZM', 'RW', 'BJ', 'BF', 'SN'],
    currencies: ['NGN', 'GHS', 'UGX', 'XAF', 'XOF', 'ZMW', 'RWF'],
    type: 'mobile_money',
    credentials: {
      subscription_key: '',
      api_user: '',
      api_key: '',
      collection_primary_key: '',
      disbursement_primary_key: '',
    },
    fees: { percent: 1.5, fixed: 0, currency: 'NGN' },
    minAmount: 50,
    maxAmount: 5000000,
    supportsPayouts: true,
  },
  {
    id: 'orange-money',
    name: 'Orange Money',
    provider: 'orange',
    enabled: false,
    countries: ['SN', 'CI', 'ML', 'CM', 'MG', 'TN', 'JO', 'EG'],
    currencies: ['XOF', 'XAF', 'MAD', 'TND'],
    type: 'mobile_money',
    credentials: { client_id: '', client_secret: '', merchant_key: '' },
    fees: { percent: 2.0, fixed: 0, currency: 'XOF' },
    minAmount: 100,
    maxAmount: 2000000,
    supportsPayouts: true,
  },
  {
    id: 'flutterwave',
    name: 'Flutterwave',
    provider: 'flutterwave',
    enabled: false,
    countries: ['NG', 'GH', 'KE', 'ZA', 'UG', 'TZ', 'RW', 'CM', 'CI', 'ET', 'EG'],
    currencies: ['NGN', 'GHS', 'KES', 'ZAR', 'UGX', 'USD', 'EUR', 'GBP'],
    type: 'regional',
    credentials: { public_key: '', secret_key: '', encryption_key: '' },
    fees: { percent: 1.4, fixed: 0, currency: 'NGN' },
    minAmount: 100,
    maxAmount: 10000000,
    supportsPayouts: true,
  },
  {
    id: 'paystack',
    name: 'Paystack',
    provider: 'paystack',
    enabled: false,
    countries: ['NG', 'GH', 'ZA', 'KE', 'CI'],
    currencies: ['NGN', 'GHS', 'ZAR', 'KES'],
    type: 'regional',
    credentials: { public_key: '', secret_key: '' },
    fees: { percent: 1.5, fixed: 100, currency: 'NGN' },
    minAmount: 50,
    maxAmount: 5000000,
    supportsPayouts: false,
  },
  {
    id: 'bank-transfer',
    name: 'Bank Transfer (SWIFT/SEPA)',
    provider: 'bank',
    enabled: false,
    countries: ['ALL'],
    currencies: ['USD', 'EUR', 'GBP'],
    type: 'bank',
    credentials: { bank_name: '', account_number: '', routing_number: '', iban: '', swift: '' },
    fees: { percent: 0, fixed: 5, currency: 'USD' },
    minAmount: 10,
    maxAmount: 999999,
    supportsPayouts: true,
  },
  {
    id: 'crypto-usdt',
    name: 'Crypto (USDT / BTC)',
    provider: 'coinpayments',
    enabled: false,
    countries: ['ALL'],
    currencies: ['USDT', 'BTC', 'ETH', 'BNB'],
    type: 'crypto',
    credentials: {
      public_key: '',
      private_key: '',
      merchant_id: '',
      ipn_secret: '',
    },
    fees: { percent: 0.5, fixed: 0, currency: 'USDT' },
    minAmount: 1,
    maxAmount: 999999,
    supportsPayouts: true,
  },
]

const DEFAULT_PAYOUT_SETTINGS: PayoutSettings = {
  minimumPayoutAmount: 10,
  payoutSchedule: 'weekly',
  payoutCurrency: 'USD',
  platformFeePercent: 20,
  tipsterSharePercent: 80,
  autoPayouts: false,
  payoutMethods: ['paypal', 'bank-transfer', 'crypto-usdt'],
}

// ── DB-backed persistence via admin_settings ──────────────────────────────
// Falls back to in-memory defaults when DB is unreachable (dev / no DB).
const g = globalThis as {
  __gwStore?: PaymentGateway[];
  __pwStore?: PayoutSettings;
};

async function loadGateways(): Promise<PaymentGateway[]> {
  if (g.__gwStore) return g.__gwStore;
  // 1. Try MySQL DB
  try {
    const result = await query<{ value: string }>(
      "SELECT value FROM admin_settings WHERE name = 'payment_gateways' LIMIT 1"
    );
    const rows = result.rows;
    if (rows?.length && rows[0].value) {
      g.__gwStore = JSON.parse(rows[0].value) as PaymentGateway[];
      return g.__gwStore;
    }
  } catch { /* ignore */ }
  // 2. File-based persistence
  const stored = fileStoreGet<PaymentGateway[] | null>('payment-gateways', null);
  if (stored && stored.length > 0) {
    g.__gwStore = stored;
    return g.__gwStore;
  }
  g.__gwStore = DEFAULT_GATEWAYS;
  return g.__gwStore;
}

async function saveGateways(gateways: PaymentGateway[]): Promise<void> {
  g.__gwStore = gateways;
  fileStoreSet('payment-gateways', gateways);
  try {
    await query(
      `INSERT INTO admin_settings (name, value, type, description)
       VALUES ('payment_gateways', $1, 'json', 'Payment gateway configuration')
       ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(gateways)]
    );
  } catch { /* ignore — file-based fallback already saved */ }
}

async function loadPayoutSettings(): Promise<PayoutSettings> {
  if (g.__pwStore) return g.__pwStore;
  // 1. Try MySQL DB
  try {
    const result = await query<{ value: string }>(
      "SELECT value FROM admin_settings WHERE name = 'payout_settings' LIMIT 1"
    );
    const rows = result.rows;
    if (rows?.length && rows[0].value) {
      g.__pwStore = JSON.parse(rows[0].value) as PayoutSettings;
      return g.__pwStore;
    }
  } catch { /* ignore */ }
  // 2. File-based persistence
  const stored = fileStoreGet<PayoutSettings | null>('payout-settings', null);
  if (stored) {
    g.__pwStore = stored;
    return g.__pwStore;
  }
  g.__pwStore = DEFAULT_PAYOUT_SETTINGS;
  return g.__pwStore;
}

async function savePayoutSettings(settings: PayoutSettings): Promise<void> {
  g.__pwStore = settings;
  fileStoreSet('payout-settings', settings);
  try {
    await query(
      `INSERT INTO admin_settings (name, value, type, description)
       VALUES ('payout_settings', $1, 'json', 'Tipster payout configuration')
       ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(settings)]
    );
  } catch { /* ignore */ }
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [gatewayStore, payoutStore] = await Promise.all([
      loadGateways(),
      loadPayoutSettings(),
    ]);

    // Mask sensitive credential values for display
    const masked = gatewayStore.map((gw) => ({
      ...gw,
      credentials: Object.fromEntries(
        Object.entries(gw.credentials).map(([k, v]) => [
          k,
          v ? `${v.slice(0, 4)}${'•'.repeat(Math.max(0, v.length - 4))}` : '',
        ])
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
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    if (body.gateways) {
      const gatewayStore = await loadGateways();
      // Merge credentials — don't overwrite real values with masked placeholders
      const updated = (body.gateways as PaymentGateway[]).map((incoming) => {
        const existing = gatewayStore.find((gw) => gw.id === incoming.id)
        const mergedCredentials = existing
          ? Object.fromEntries(
              Object.entries(incoming.credentials).map(([k, v]) => {
                const isMasked = /^.{1,4}•+$/.test(v)
                return [k, isMasked && existing.credentials[k] ? existing.credentials[k] : v]
              })
            )
          : incoming.credentials
        return { ...incoming, credentials: mergedCredentials }
      })
      await saveGateways(updated);
    }

    if (body.payoutSettings) {
      const payoutStore = await loadPayoutSettings();
      await savePayoutSettings({ ...payoutStore, ...body.payoutSettings });
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, enabled } = await req.json()
    const gatewayStore = await loadGateways();
    const updated = gatewayStore.map((gw) =>
      gw.id === id ? { ...gw, enabled } : gw
    )
    await saveGateways(updated);

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
