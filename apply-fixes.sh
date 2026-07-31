#!/bin/bash
# Betcheza bug fixes - run this on your server as root
# cd /home/admin/apps/betcheza && bash apply-fixes.sh

set -e
APP_DIR="/home/admin/apps/betcheza"
cd "$APP_DIR"

echo "Applying fixes to $APP_DIR ..."

# ── 1. lib/db.ts ──────────────────────────────────────────────────────────────
cat > lib/db.ts << 'ENDOFFILE'
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

let pool: mysql.Pool | null = null;

interface FileDbConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}

function getFileConfig(): FileDbConfig | null {
  try {
    const configFile = path.join(process.cwd(), '.local', 'state', 'admin', 'db-config.json');
    if (fs.existsSync(configFile)) {
      return JSON.parse(fs.readFileSync(configFile, 'utf8')) as FileDbConfig;
    }
  } catch { /* ignore */ }
  return null;
}

export function getPool(): mysql.Pool | null {
  const envHost     = process.env.DB_HOST     || process.env.MYSQL_HOST;
  const envUser     = process.env.DB_USER     || process.env.MYSQL_USER;
  const envPassword = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD;
  const envDatabase = process.env.DB_NAME     || process.env.MYSQL_DATABASE;

  // Fall back to admin-panel saved config when env vars are not set
  const fileCfg = (!envHost || !envUser || !envDatabase) ? getFileConfig() : null;

  const host     = envHost     || fileCfg?.host;
  const user     = envUser     || fileCfg?.user;
  const password = envPassword || fileCfg?.password;
  const database = envDatabase || fileCfg?.database;

  if (!host || !user || !database) return null;

  if (!pool) {
    pool = mysql.createPool({
      host,
      port: fileCfg?.port || parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306'),
      user,
      password: password || '',
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
    });
  }

  return pool;
}

/** Reset the pool so the next call to getPool() picks up new config. */
export function resetPool(): void {
  if (pool) {
    pool.end().catch(() => { /* ignore */ });
    pool = null;
  }
}

export interface QueryResult<T> {
  rows: T[];
  affectedRows?: number;
}

export async function query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
  const p = getPool();
  if (!p) {
    return { rows: [] };
  }
  const [rows] = await p.execute(sql, params);
  return { rows: rows as T[], affectedRows: undefined };
}

export async function queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
  const result = await query<T>(sql, params);
  return result.rows[0] || null;
}

export interface ExecuteResult {
  insertId: number;
  affectedRows: number;
}

export async function execute(sql: string, params?: unknown[]): Promise<ExecuteResult> {
  const p = getPool();
  if (!p) {
    throw new Error('No MySQL database connection available');
  }
  const [result] = await p.execute(sql, params);
  const r = result as mysql.ResultSetHeader;
  return { insertId: r.insertId, affectedRows: r.affectedRows };
}

export async function withTransaction<T>(
  callback: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const p = getPool();
  if (!p) {
    throw new Error('No MySQL database connection available');
  }
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
ENDOFFILE
echo "✓ lib/db.ts written"

# ── 2. app/api/admin/db-config/route.ts ──────────────────────────────────────
mkdir -p app/api/admin/db-config
cat > app/api/admin/db-config/route.ts << 'ENDOFFILE'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPool, resetPool } from '@/lib/db'
import { fileStoreGet, fileStoreSet } from '@/lib/file-store'
import fs from 'fs'
import path from 'path'

interface DbConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
  ssl: boolean
}

const CONFIG_KEY = 'db-config'
const STATE_DIR = path.join(process.cwd(), '.local', 'state', 'admin')
const CONFIG_FILE = path.join(STATE_DIR, `${CONFIG_KEY}.json`)

export async function GET() {
  try {
    const session = await getCurrentUser()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const envHost = process.env.DB_HOST || process.env.MYSQL_HOST
    const envUser = process.env.DB_USER || process.env.MYSQL_USER
    const envDb   = process.env.DB_NAME || process.env.MYSQL_DATABASE
    const hasEnvVar = !!(envHost && envUser && envDb)

    const fileConfig = fileStoreGet<DbConfig | null>(CONFIG_KEY, null)
    const fromFile = !hasEnvVar && !!fileConfig
    const source: 'env' | 'file' | 'none' = hasEnvVar ? 'env' : fromFile ? 'file' : 'none'

    return NextResponse.json({
      source,
      hasEnvVar,
      config: hasEnvVar
        ? {
            host: envHost || '',
            port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306'),
            user: envUser || '',
            password: '••••••••••••',
            database: envDb || '',
            ssl: false,
          }
        : fileConfig ?? null,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    resetPool()
    const pool = getPool()
    if (!pool) {
      return NextResponse.json({ success: false, message: 'No MySQL database connection configured.' })
    }

    try {
      const conn = await pool.getConnection()
      await conn.query('SELECT 1')
      conn.release()
      return NextResponse.json({ success: true, message: 'MySQL connection successful!' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      return NextResponse.json({ success: false, message: `Connection failed: ${msg}` })
    }
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getCurrentUser()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as DbConfig
    if (!body.host || !body.user || !body.database) {
      return NextResponse.json({ error: 'host, user and database are required' }, { status: 400 })
    }

    fileStoreSet<DbConfig>(CONFIG_KEY, {
      host: body.host,
      port: body.port || 3306,
      user: body.user,
      password: body.password || '',
      database: body.database,
      ssl: body.ssl || false,
    })

    resetPool()

    return NextResponse.json({ success: true, message: 'Configuration saved. Restart the server to fully apply.' })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const session = await getCurrentUser()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE)
    } catch { /* ignore */ }

    resetPool()

    return NextResponse.json({ success: true, message: 'Database configuration removed.' })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
ENDOFFILE
echo "✓ app/api/admin/db-config/route.ts written"

# ── 3. app/api/admin/payment-gateways/route.ts ────────────────────────────────
mkdir -p app/api/admin/payment-gateways
cat > app/api/admin/payment-gateways/route.ts << 'ENDOFFILE'
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
  { id: 'payhero', name: 'PayHero (M-Pesa)', provider: 'payhero', enabled: true, countries: ['KE'], currencies: ['KES'], type: 'mobile_money', credentials: { basic_token: process.env.PAYHERO_BASIC_TOKEN || '', account_id: process.env.PAYHERO_ACCOUNT_ID || '' }, fees: { percent: 0, fixed: 0, currency: 'KES' }, minAmount: 1, maxAmount: 300000, supportsPayouts: true },
  { id: 'stripe', name: 'Stripe', provider: 'stripe', enabled: false, countries: ['US','GB','CA','AU','EU'], currencies: ['USD','GBP','EUR','AUD','CAD'], type: 'card', credentials: { publishable_key: '', secret_key: '', webhook_secret: '' }, fees: { percent: 2.9, fixed: 0.30, currency: 'USD' }, minAmount: 1, maxAmount: 999999, supportsPayouts: true, logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg' },
  { id: 'paypal', name: 'PayPal', provider: 'paypal', enabled: false, countries: ['US','GB','CA','AU','EU'], currencies: ['USD','GBP','EUR','AUD','CAD'], type: 'ewallet', credentials: { client_id: '', client_secret: '', mode: 'sandbox' }, fees: { percent: 3.49, fixed: 0.49, currency: 'USD' }, minAmount: 1, maxAmount: 10000, supportsPayouts: true, logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg' },
  { id: 'mpesa', name: 'M-Pesa (Daraja)', provider: 'safaricom', enabled: false, countries: ['KE','TZ','UG'], currencies: ['KES','TZS','UGX'], type: 'mobile_money', credentials: { consumer_key: '', consumer_secret: '', passkey: '', shortcode: '' }, fees: { percent: 1.5, fixed: 0, currency: 'KES' }, minAmount: 1, maxAmount: 300000, supportsPayouts: true },
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
      `INSERT INTO admin_settings (name, value, type, description) VALUES ('payment_gateways', ?, 'json', 'Payment gateway configuration') ON DUPLICATE KEY UPDATE value = VALUES(value)`,
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
      `INSERT INTO admin_settings (name, value, type, description) VALUES ('payout_settings', ?, 'json', 'Tipster payout configuration') ON DUPLICATE KEY UPDATE value = VALUES(value)`,
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
  } catch (error) {
    console.error('[Admin API] Failed to get payment gateways:', error)
    return NextResponse.json({ error: 'Failed to get payment gateways' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()

    // Support both { type, data } (new) and legacy { gateways, payoutSettings } formats
    let type = body.type
    let data = body.data
    if (!type) {
      if (body.gateways) { type = 'gateways_bulk'; data = body.gateways }
      else if (body.payoutSettings) { type = 'payout'; data = body.payoutSettings }
    }

    if (type === 'gateway') {
      const current = await loadGateways()
      const idx = current.findIndex(g => g.id === data.id)
      if (idx === -1) return NextResponse.json({ error: 'Gateway not found' }, { status: 404 })
      const existing = current[idx]
      const updated = {
        ...existing,
        ...data,
        credentials: {
          ...existing.credentials,
          ...Object.fromEntries(
            Object.entries(data.credentials || {}).filter(([, v]) => v !== '' && !(v as string).includes('•'))
          ),
        },
      }
      current[idx] = updated
      await saveGateways(current)
      return NextResponse.json({ success: true, gateway: updated })
    }
    if (type === 'gateways_bulk') {
      // Array of gateways — merge each one preserving existing credentials for masked values
      const current = await loadGateways()
      for (const gw of (data as PaymentGateway[])) {
        const idx = current.findIndex(g => g.id === gw.id)
        if (idx === -1) continue
        const existing = current[idx]
        current[idx] = {
          ...existing,
          ...gw,
          credentials: {
            ...existing.credentials,
            ...Object.fromEntries(
              Object.entries(gw.credentials || {}).filter(([, v]) => v !== '' && !(v as string).includes('•'))
            ),
          },
        }
      }
      await saveGateways(current)
      return NextResponse.json({ success: true })
    }
    if (type === 'payout') {
      await savePayoutSettings(data)
      return NextResponse.json({ success: true, payoutSettings: data })
    }
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error) {
    console.error('[Admin API] Failed to update payment gateway:', error)
    return NextResponse.json({ error: 'Failed to update payment gateway' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id, enabled } = await req.json()
    if (!id || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'id and enabled required' }, { status: 400 })
    }
    const current = await loadGateways()
    const idx = current.findIndex(g => g.id === id)
    if (idx === -1) return NextResponse.json({ error: 'Gateway not found' }, { status: 404 })
    current[idx] = { ...current[idx], enabled }
    await saveGateways(current)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin API] Failed to toggle gateway:', error)
    return NextResponse.json({ error: 'Failed to toggle gateway' }, { status: 500 })
  }
}
ENDOFFILE
echo "✓ app/api/admin/payment-gateways/route.ts written"

# ── Rebuild & restart ─────────────────────────────────────────────────────────
echo ""
echo "Building..."
npm run build 2>&1 | tail -20

echo ""
echo "Restarting PM2..."
pm2 restart betcheza --update-env

echo ""
echo "All done! Check betcheza.co.ke/admin/payment-gateways"
