import fs from 'fs';
import path from 'path';

export type WalletTxnType = 'deposit' | 'withdraw' | 'competition_entry' | 'prize_payout' | 'refund' | 'adjustment';
export type WalletTxnStatus = 'pending' | 'completed' | 'failed' | 'reversed';

export interface WalletTxn {
  id: string;
  userId: number;
  type: WalletTxnType;
  amount: number;
  currency: string;
  status: WalletTxnStatus;
  method?: string;
  reference?: string;
  description?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface WalletState {
  balances: Record<string, number>;
  txns: WalletTxn[];
}

const STATE_DIR = path.join(process.cwd(), '.local', 'state');
const STATE_FILE = path.join(STATE_DIR, 'wallets.json');

const g = globalThis as { __walletState?: WalletState };

function load(): WalletState {
  if (g.__walletState) return g.__walletState;
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as WalletState;
      if (parsed && typeof parsed === 'object' && parsed.balances && Array.isArray(parsed.txns)) {
        g.__walletState = parsed;
        return parsed;
      }
    }
  } catch {
    // corrupted file — start fresh
  }
  g.__walletState = { balances: {}, txns: [] };
  return g.__walletState;
}

function persist(): void {
  if (!g.__walletState) return;
  try {
    if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(g.__walletState, null, 2), 'utf-8');
  } catch {
    // ignore — in-memory still works
  }
}

function key(userId: number, currency: string): string {
  return `${userId}:${currency.toUpperCase()}`;
}

function newTxnId(): string {
  return `tx_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function getBalance(userId: number, currency = 'KES'): number {
  const s = load();
  return s.balances[key(userId, currency)] ?? 0;
}

export function getWallet(userId: number): { balances: Record<string, number>; txns: WalletTxn[] } {
  const s = load();
  const userBalances: Record<string, number> = {};
  for (const k of Object.keys(s.balances)) {
    const [uid, cur] = k.split(':');
    if (parseInt(uid, 10) === userId) userBalances[cur] = s.balances[k];
  }
  if (!userBalances.KES) userBalances.KES = 0;
  const txns = s.txns.filter((t) => t.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { balances: userBalances, txns };
}

function pushTxn(txn: WalletTxn): WalletTxn {
  const s = load();
  s.txns.unshift(txn);
  // keep last 500 txns per ledger to bound memory/file size
  if (s.txns.length > 5000) s.txns.length = 5000;
  persist();
  return txn;
}

export function credit(
  userId: number,
  amount: number,
  opts: {
    type: WalletTxnType;
    currency?: string;
    method?: string;
    reference?: string;
    description?: string;
    meta?: Record<string, unknown>;
    status?: WalletTxnStatus;
  },
): WalletTxn {
  const currency = (opts.currency || 'KES').toUpperCase();
  const s = load();
  const k = key(userId, currency);
  const status: WalletTxnStatus = opts.status || 'completed';
  if (status === 'completed') {
    s.balances[k] = (s.balances[k] ?? 0) + amount;
  }
  const txn: WalletTxn = {
    id: newTxnId(),
    userId,
    type: opts.type,
    amount,
    currency,
    status,
    method: opts.method,
    reference: opts.reference,
    description: opts.description,
    meta: opts.meta,
    createdAt: new Date().toISOString(),
  };
  return pushTxn(txn);
}

export function debit(
  userId: number,
  amount: number,
  opts: {
    type: WalletTxnType;
    currency?: string;
    method?: string;
    reference?: string;
    description?: string;
    meta?: Record<string, unknown>;
  },
): { ok: true; txn: WalletTxn; newBalance: number } | { ok: false; error: string; balance: number } {
  const currency = (opts.currency || 'KES').toUpperCase();
  const s = load();
  const k = key(userId, currency);
  const current = s.balances[k] ?? 0;
  if (amount <= 0) return { ok: false, error: 'Amount must be positive', balance: current };
  if (current < amount) {
    return { ok: false, error: `Insufficient ${currency} wallet balance. You have ${current.toLocaleString()} ${currency}.`, balance: current };
  }
  s.balances[k] = current - amount;
  const txn: WalletTxn = {
    id: newTxnId(),
    userId,
    type: opts.type,
    amount: -amount,
    currency,
    status: 'completed',
    method: opts.method,
    reference: opts.reference,
    description: opts.description,
    meta: opts.meta,
    createdAt: new Date().toISOString(),
  };
  pushTxn(txn);
  return { ok: true, txn, newBalance: s.balances[k] };
}

export function listTxns(userId: number, limit = 50): WalletTxn[] {
  const s = load();
  return s.txns.filter((t) => t.userId === userId).slice(0, limit);
}

export function getAllTxns(opts?: { limit?: number; offset?: number; type?: WalletTxnType; status?: WalletTxnStatus }): {
  txns: WalletTxn[];
  total: number;
} {
  const s = load();
  let txns = [...s.txns].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (opts?.type) txns = txns.filter((t) => t.type === opts.type);
  if (opts?.status) txns = txns.filter((t) => t.status === opts.status);
  const total = txns.length;
  const offset = opts?.offset ?? 0;
  const limit = opts?.limit ?? 100;
  return { txns: txns.slice(offset, offset + limit), total };
}
