#!/bin/bash
# Betcheza DEFINITIVE fix — solves saving + M-Pesa once and for all
# Run: bash /tmp/apply-definitive.sh

set -e
APP_DIR="/home/admin/apps/betcheza"
STATE_DIR="$APP_DIR/.local/state/admin"
cd "$APP_DIR"

# Load env vars
set -a; source .env.local; set +a

echo "======================================"
echo " Betcheza Definitive Fix"
echo "======================================"
echo "App: $APP_DIR"
echo "DB:  $DB_USER@$DB_HOST/$DB_NAME"
echo "PayHero token set: $([ -n "$PAYHERO_BASIC_TOKEN" ] && echo YES || echo NO)"
echo "PayHero account:   $PAYHERO_ACCOUNT_ID"
echo ""

# ── 1. Ensure state directory exists ─────────────────────────────────────────
echo "[1/6] Creating state directory..."
mkdir -p "$STATE_DIR"
echo "      $STATE_DIR"
echo ""

# ── 2. Write payment-gateways.json directly ──────────────────────────────────
echo "[2/6] Writing payment-gateways.json with your PayHero credentials..."
ACCOUNT_ID="${PAYHERO_ACCOUNT_ID:-0}"
BASIC_TOKEN="${PAYHERO_BASIC_TOKEN:-}"

python3 -c "
import json, sys

gateways = [
  {'id':'payhero','name':'PayHero (M-Pesa)','provider':'payhero','enabled':True,'countries':['KE'],'currencies':['KES'],'type':'mobile_money','credentials':{'basic_token':'$BASIC_TOKEN','account_id':'$ACCOUNT_ID'},'fees':{'percent':0,'fixed':0,'currency':'KES'},'minAmount':1,'maxAmount':300000,'supportsPayouts':True},
  {'id':'stripe','name':'Stripe','provider':'stripe','enabled':False,'countries':['US','GB','CA','AU','EU'],'currencies':['USD','GBP','EUR','AUD','CAD'],'type':'card','credentials':{'publishable_key':'','secret_key':'','webhook_secret':''},'fees':{'percent':2.9,'fixed':0.30,'currency':'USD'},'minAmount':1,'maxAmount':999999,'supportsPayouts':True},
  {'id':'paypal','name':'PayPal','provider':'paypal','enabled':False,'countries':['US','GB','CA','AU','EU'],'currencies':['USD','GBP','EUR','AUD','CAD'],'type':'ewallet','credentials':{'client_id':'','client_secret':'','mode':'sandbox'},'fees':{'percent':3.49,'fixed':0.49,'currency':'USD'},'minAmount':1,'maxAmount':10000,'supportsPayouts':True},
  {'id':'mpesa','name':'M-Pesa (Daraja)','provider':'safaricom','enabled':False,'countries':['KE','TZ','UG'],'currencies':['KES','TZS','UGX'],'type':'mobile_money','credentials':{'consumer_key':'','consumer_secret':'','passkey':'','shortcode':''},'fees':{'percent':1.5,'fixed':0,'currency':'KES'},'minAmount':1,'maxAmount':300000,'supportsPayouts':True},
  {'id':'flutterwave','name':'Flutterwave','provider':'flutterwave','enabled':False,'countries':['NG','GH','KE','ZA'],'currencies':['NGN','GHS','KES','ZAR'],'type':'regional','credentials':{'public_key':'','secret_key':'','encryption_key':''},'fees':{'percent':1.4,'fixed':0,'currency':'NGN'},'minAmount':100,'maxAmount':10000000,'supportsPayouts':True},
  {'id':'paystack','name':'Paystack','provider':'paystack','enabled':False,'countries':['NG','GH','ZA','KE'],'currencies':['NGN','GHS','ZAR','KES'],'type':'regional','credentials':{'public_key':'','secret_key':''},'fees':{'percent':1.5,'fixed':100,'currency':'NGN'},'minAmount':50,'maxAmount':5000000,'supportsPayouts':False},
  {'id':'bank-transfer','name':'Bank Transfer','provider':'bank','enabled':False,'countries':['ALL'],'currencies':['USD','EUR','GBP'],'type':'bank','credentials':{'bank_name':'','account_number':'','iban':'','swift':''},'fees':{'percent':0,'fixed':5,'currency':'USD'},'minAmount':10,'maxAmount':999999,'supportsPayouts':True},
  {'id':'crypto-usdt','name':'Crypto (USDT/BTC)','provider':'coinpayments','enabled':False,'countries':['ALL'],'currencies':['USDT','BTC','ETH'],'type':'crypto','credentials':{'public_key':'','private_key':'','merchant_id':''},'fees':{'percent':0.5,'fixed':0,'currency':'USDT'},'minAmount':1,'maxAmount':999999,'supportsPayouts':True},
]

with open('$STATE_DIR/payment-gateways.json', 'w') as f:
    json.dump(gateways, f, indent=2)
print('Written successfully')
"
echo "✓ payment-gateways.json written with credentials"
echo ""

# ── 3. Inject into MySQL ──────────────────────────────────────────────────────
echo "[3/6] Inserting credentials into MySQL admin_settings..."
GW_JSON=$(cat "$STATE_DIR/payment-gateways.json")
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" << ENDSQL
CREATE TABLE IF NOT EXISTS admin_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  value LONGTEXT,
  type VARCHAR(50) DEFAULT 'text',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ENDSQL

# Use python to do the MySQL insert so special chars in JSON are safe
python3 -c "
import subprocess, json

gw_json = open('$STATE_DIR/payment-gateways.json').read().replace(\"'\", \"''\")
sql = f\"\"\"INSERT INTO admin_settings (name, value, type, description)
VALUES ('payment_gateways', '{gw_json}', 'json', 'Payment gateway configuration')
ON DUPLICATE KEY UPDATE value = '{gw_json}', updated_at = NOW();
SELECT name, LEFT(value,60) as value_preview FROM admin_settings;\"\"\"

result = subprocess.run(
    ['mysql', '-h', '$DB_HOST', '-u', '$DB_USER', '-p$DB_PASSWORD', '$DB_NAME', '-e', sql],
    capture_output=True, text=True
)
print(result.stdout)
if result.stderr: print('WARN:', result.stderr[:200])
"
echo "✓ MySQL credentials saved"
echo ""

# ── 4. Write fixed lib/file-store.ts ─────────────────────────────────────────
echo "[4/6] Writing fixed lib/file-store.ts (absolute path fix)..."
cat > lib/file-store.ts << 'ENDOFFILE'
/**
 * File-based key-value store. Uses APP_DIR env or walks up from __dirname
 * to find the project root — works correctly regardless of process.cwd().
 */
import fs from 'fs';
import path from 'path';

function getStateDir(): string {
  if (process.env.APP_DIR) {
    return path.join(process.env.APP_DIR, '.local', 'state', 'admin');
  }
  // Walk up from __dirname to find package.json (project root)
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return path.join(dir, '.local', 'state', 'admin');
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(process.cwd(), '.local', 'state', 'admin');
}

function ensureDir(stateDir: string): void {
  try { fs.mkdirSync(stateDir, { recursive: true }); } catch { /* ignore */ }
}

export function fileStoreGet<T>(key: string, fallback: T): T {
  try {
    const stateDir = getStateDir();
    ensureDir(stateDir);
    const file = path.join(stateDir, `${key}.json`);
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export function fileStoreSet<T>(key: string, value: T): void {
  try {
    const stateDir = getStateDir();
    ensureDir(stateDir);
    const file = path.join(stateDir, `${key}.json`);
    fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
  } catch (e) {
    console.warn('[file-store] write failed:', e);
  }
}
ENDOFFILE
echo "✓ lib/file-store.ts fixed (walks up to project root)"
echo ""

# ── 5. Write fixed payment-gateways route ────────────────────────────────────
echo "[5/6] Writing fixed payment-gateways route..."
mkdir -p app/api/admin/payment-gateways
cat > app/api/admin/payment-gateways/route.ts << 'ENDOFFILE'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { query } from '@/lib/db'
import { fileStoreGet, fileStoreSet } from '@/lib/file-store'

export interface PaymentGateway {
  id: string; name: string; provider: string; enabled: boolean
  countries: string[]; currencies: string[]
  type: 'card' | 'mobile_money' | 'bank' | 'crypto' | 'ewallet' | 'regional'
  credentials: Record<string, string>
  fees?: { percent: number; fixed: number; currency: string }
  minAmount?: number; maxAmount?: number; supportsPayouts: boolean; logoUrl?: string
}

export interface PayoutSettings {
  minimumPayoutAmount: number; payoutSchedule: 'instant' | 'daily' | 'weekly' | 'monthly'
  payoutCurrency: string; platformFeePercent: number; tipsterSharePercent: number
  autoPayouts: boolean; payoutMethods: string[]
}

const DEFAULT_GATEWAYS: PaymentGateway[] = [
  { id: 'payhero', name: 'PayHero (M-Pesa)', provider: 'payhero', enabled: true, countries: ['KE'], currencies: ['KES'], type: 'mobile_money', credentials: { basic_token: process.env.PAYHERO_BASIC_TOKEN || '', account_id: process.env.PAYHERO_ACCOUNT_ID || '' }, fees: { percent: 0, fixed: 0, currency: 'KES' }, minAmount: 1, maxAmount: 300000, supportsPayouts: true },
  { id: 'stripe', name: 'Stripe', provider: 'stripe', enabled: false, countries: ['US','GB','CA','AU','EU'], currencies: ['USD','GBP','EUR','AUD','CAD'], type: 'card', credentials: { publishable_key: '', secret_key: '', webhook_secret: '' }, fees: { percent: 2.9, fixed: 0.30, currency: 'USD' }, minAmount: 1, maxAmount: 999999, supportsPayouts: true },
  { id: 'paypal', name: 'PayPal', provider: 'paypal', enabled: false, countries: ['US','GB','CA','AU','EU'], currencies: ['USD','GBP','EUR','AUD','CAD'], type: 'ewallet', credentials: { client_id: '', client_secret: '', mode: 'sandbox' }, fees: { percent: 3.49, fixed: 0.49, currency: 'USD' }, minAmount: 1, maxAmount: 10000, supportsPayouts: true },
  { id: 'mpesa', name: 'M-Pesa (Daraja)', provider: 'safaricom', enabled: false, countries: ['KE','TZ','UG'], currencies: ['KES','TZS','UGX'], type: 'mobile_money', credentials: { consumer_key: '', consumer_secret: '', passkey: '', shortcode: '' }, fees: { percent: 1.5, fixed: 0, currency: 'KES' }, minAmount: 1, maxAmount: 300000, supportsPayouts: true },
  { id: 'flutterwave', name: 'Flutterwave', provider: 'flutterwave', enabled: false, countries: ['NG','GH','KE','ZA'], currencies: ['NGN','GHS','KES','ZAR'], type: 'regional', credentials: { public_key: '', secret_key: '', encryption_key: '' }, fees: { percent: 1.4, fixed: 0, currency: 'NGN' }, minAmount: 100, maxAmount: 10000000, supportsPayouts: true },
  { id: 'paystack', name: 'Paystack', provider: 'paystack', enabled: false, countries: ['NG','GH','ZA','KE'], currencies: ['NGN','GHS','ZAR','KES'], type: 'regional', credentials: { public_key: '', secret_key: '' }, fees: { percent: 1.5, fixed: 100, currency: 'NGN' }, minAmount: 50, maxAmount: 5000000, supportsPayouts: false },
  { id: 'bank-transfer', name: 'Bank Transfer', provider: 'bank', enabled: false, countries: ['ALL'], currencies: ['USD','EUR','GBP'], type: 'bank', credentials: { bank_name: '', account_number: '', iban: '', swift: '' }, fees: { percent: 0, fixed: 5, currency: 'USD' }, minAmount: 10, maxAmount: 999999, supportsPayouts: true },
  { id: 'crypto-usdt', name: 'Crypto (USDT/BTC)', provider: 'coinpayments', enabled: false, countries: ['ALL'], currencies: ['USDT','BTC','ETH'], type: 'crypto', credentials: { public_key: '', private_key: '', merchant_id: '' }, fees: { percent: 0.5, fixed: 0, currency: 'USDT' }, minAmount: 1, maxAmount: 999999, supportsPayouts: true },
]

const DEFAULT_PAYOUT: PayoutSettings = {
  minimumPayoutAmount: 10, payoutSchedule: 'weekly', payoutCurrency: 'USD',
  platformFeePercent: 20, tipsterSharePercent: 80, autoPayouts: false,
  payoutMethods: ['paypal', 'bank-transfer', 'crypto-usdt'],
}

async function ensureTable(): Promise<void> {
  try {
    await query(`CREATE TABLE IF NOT EXISTS admin_settings (
      id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) UNIQUE NOT NULL,
      value LONGTEXT, type VARCHAR(50) DEFAULT 'text', description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  } catch { /* no DB */ }
}

async function loadGateways(): Promise<PaymentGateway[]> {
  // 1. Try MySQL
  try {
    const r = await query<{ value: string }>("SELECT value FROM admin_settings WHERE name = 'payment_gateways' LIMIT 1")
    if (r.rows?.length && r.rows[0].value) return JSON.parse(r.rows[0].value)
  } catch {}
  // 2. Try file store
  const stored = fileStoreGet<PaymentGateway[] | null>('payment-gateways', null)
  if (stored && stored.length > 0) return stored
  // 3. Defaults (reads from env vars if set)
  return DEFAULT_GATEWAYS
}

async function saveGateways(gateways: PaymentGateway[]): Promise<void> {
  // Always write to file store first (reliable)
  fileStoreSet('payment-gateways', gateways)
  // Then try MySQL
  try {
    await ensureTable()
    await query(
      `INSERT INTO admin_settings (name, value, type, description)
       VALUES ('payment_gateways', ?, 'json', 'Payment gateway configuration')
       ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()`,
      [JSON.stringify(gateways)]
    )
  } catch { /* file store is fallback */ }
}

async function loadPayoutSettings(): Promise<PayoutSettings> {
  try {
    const r = await query<{ value: string }>("SELECT value FROM admin_settings WHERE name = 'payout_settings' LIMIT 1")
    if (r.rows?.length && r.rows[0].value) return JSON.parse(r.rows[0].value)
  } catch {}
  const stored = fileStoreGet<PayoutSettings | null>('payout-settings', null)
  return stored || DEFAULT_PAYOUT
}

async function savePayoutSettings(settings: PayoutSettings): Promise<void> {
  fileStoreSet('payout-settings', settings)
  try {
    await ensureTable()
    await query(
      `INSERT INTO admin_settings (name, value, type, description)
       VALUES ('payout_settings', ?, 'json', 'Payout settings')
       ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()`,
      [JSON.stringify(settings)]
    )
  } catch {}
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const [gateways, payoutSettings] = await Promise.all([loadGateways(), loadPayoutSettings()])
    const masked = gateways.map((gw) => ({
      ...gw,
      credentials: Object.fromEntries(
        Object.entries(gw.credentials).map(([k, v]) => [k, v ? `${v.slice(0, 4)}${'•'.repeat(Math.max(0, v.length - 4))}` : ''])
      ),
    }))
    return NextResponse.json({ gateways: masked, payoutSettings })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()

    let type = body.type, data = body.data
    if (!type) {
      if (body.gateways) { type = 'gateways_bulk'; data = body.gateways }
      else if (body.payoutSettings) { type = 'payout'; data = body.payoutSettings }
    }

    const filterCreds = (incoming: Record<string, string>, existing: Record<string, string>) =>
      ({ ...existing, ...Object.fromEntries(Object.entries(incoming || {}).filter(([, v]) => v !== '' && !String(v).includes('•'))) })

    if (type === 'gateway') {
      const current = await loadGateways()
      const idx = current.findIndex(g => g.id === data.id)
      if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      current[idx] = { ...current[idx], ...data, credentials: filterCreds(data.credentials || {}, current[idx].credentials) }
      await saveGateways(current)
      return NextResponse.json({ success: true })
    }
    if (type === 'gateways_bulk') {
      const current = await loadGateways()
      for (const gw of (data as PaymentGateway[])) {
        const idx = current.findIndex(g => g.id === gw.id)
        if (idx === -1) continue
        current[idx] = { ...current[idx], ...gw, credentials: filterCreds(gw.credentials || {}, current[idx].credentials) }
      }
      await saveGateways(current)
      return NextResponse.json({ success: true })
    }
    if (type === 'payout') {
      await savePayoutSettings(data)
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id, enabled } = await req.json()
    if (!id || typeof enabled !== 'boolean') return NextResponse.json({ error: 'id+enabled required' }, { status: 400 })
    const current = await loadGateways()
    const idx = current.findIndex(g => g.id === id)
    if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    current[idx] = { ...current[idx], enabled }
    await saveGateways(current)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
ENDOFFILE
echo "✓ payment-gateways/route.ts written"
echo ""

# ── 6. Build & restart ────────────────────────────────────────────────────────
echo "[6/6] Building and restarting..."
npm run build 2>&1 | tail -8

# Set APP_DIR in PM2 environment so file-store uses absolute path
pm2 restart betcheza --update-env -- APP_DIR="$APP_DIR" 2>/dev/null || \
  pm2 restart betcheza --update-env

sleep 2

echo ""
echo "======================================"
echo " DONE!"
echo "======================================"
echo ""
echo "Verifying credentials in MySQL:"
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" \
  -e "SELECT name, LENGTH(value) as size, updated_at FROM admin_settings;" 2>/dev/null
echo ""
echo "Verifying credentials file:"
ls -lh "$STATE_DIR/payment-gateways.json" 2>/dev/null && \
  python3 -c "
import json
d = json.load(open('$STATE_DIR/payment-gateways.json'))
gw = next((g for g in d if g['id']=='payhero'), None)
if gw:
  t = gw['credentials'].get('basic_token','')
  a = gw['credentials'].get('account_id','')
  print(f'PayHero token: {t[:10]}... ({len(t)} chars)')
  print(f'Account ID:    {a}')
" || echo "File not found"
echo ""
echo "Next: Go to betcheza.co.ke/dashboard/wallet and try M-Pesa deposit"
echo "      Credentials should persist at /admin/payment-gateways after reload"
