/**
 * Tipster subscription management.
 * Handles subscription creation, status checks, earnings tracking,
 * and wallet debits/credits for the 80/20 revenue split.
 */

import { query, execute } from '@/lib/db';
import { credit, debit } from '@/lib/wallet-store';

export interface Subscription {
  id: number;
  userId: number;
  tipsterId: number;
  price: number;
  currency: string;
  status: 'active' | 'expired' | 'cancelled';
  paymentMethod: string;
  paymentRef: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface SubscriptionCheckResult {
  subscribed: boolean;
  subscription: Subscription | null;
  daysLeft: number;
}

/** How many days a subscription lasts */
export const SUBSCRIPTION_DAYS = 30;
/** Platform cut percentage (20%) */
export const PLATFORM_CUT = 0.20;
/** Tipster share percentage (80%) */
export const TIPSTER_SHARE = 0.80;

/** Check if a user is actively subscribed to a tipster */
export async function checkSubscription(userId: number, tipsterId: number): Promise<SubscriptionCheckResult> {
  try {
    const res = await query<{
      id: number; user_id: number; tipster_id: number; price: number;
      currency: string; status: string; payment_method: string;
      payment_ref: string | null; expires_at: string; created_at: string;
    }>(
      `SELECT * FROM tipster_subscriptions
       WHERE user_id = ? AND tipster_id = ? AND status = 'active' AND expires_at > NOW()
       ORDER BY expires_at DESC LIMIT 1`,
      [userId, tipsterId]
    );

    if (!res.rows[0]) return { subscribed: false, subscription: null, daysLeft: 0 };

    const row = res.rows[0];
    const daysLeft = Math.max(0, Math.ceil(
      (new Date(row.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ));

    return {
      subscribed: true,
      subscription: {
        id: row.id,
        userId: row.user_id,
        tipsterId: row.tipster_id,
        price: row.price,
        currency: row.currency,
        status: row.status as 'active',
        paymentMethod: row.payment_method,
        paymentRef: row.payment_ref,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      },
      daysLeft,
    };
  } catch {
    return { subscribed: false, subscription: null, daysLeft: 0 };
  }
}

/** Subscribe a user to a tipster, processing wallet payment with 80/20 split */
export async function createSubscription(opts: {
  userId: number;
  tipsterId: number;
  tipsterUsername: string;
  tipsterDisplayName: string;
  price: number;
  currency: string;
  paymentMethod?: string;
  paymentRef?: string;
}): Promise<
  | { ok: true; subscription: { expiresAt: string; daysLeft: number }; tipsterEarning: number; platformCut: number }
  | { ok: false; error: string; balance?: number }
> {
  const { userId, tipsterId, tipsterUsername, tipsterDisplayName, price, currency, paymentMethod = 'wallet', paymentRef } = opts;
  const tipsterEarning = Math.round(price * TIPSTER_SHARE);
  const platformCut = price - tipsterEarning;
  const expiresAt = new Date(Date.now() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);

  // 1. Debit user's wallet
  const debitResult = debit(userId, price, {
    type: 'adjustment',
    currency,
    method: paymentMethod,
    reference: paymentRef,
    description: `Subscription to ${tipsterDisplayName} (@${tipsterUsername}) — ${SUBSCRIPTION_DAYS} days`,
    meta: { tipsterId, tipsterUsername, type: 'subscription_payment' },
  });

  if (!debitResult.ok) {
    return { ok: false, error: debitResult.error, balance: debitResult.balance };
  }

  // 2. Credit tipster's wallet (80%)
  credit(tipsterId, tipsterEarning, {
    type: 'adjustment',
    currency,
    method: 'subscription',
    reference: paymentRef,
    description: `Subscription earning from user #${userId} (${SUBSCRIPTION_DAYS}-day plan, 80% of ${price} ${currency})`,
    meta: { subscriberUserId: userId, grossPrice: price, platformCut, type: 'subscription_earning' },
  });

  // 3. Update user's wallet_balance and tipster's earnings in DB
  try {
    await execute(
      'UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?',
      [price, userId]
    );
    await execute(
      'UPDATE users SET tipster_earnings = tipster_earnings + ?, wallet_balance = wallet_balance + ? WHERE id = ?',
      [tipsterEarning, tipsterEarning, tipsterId]
    );
  } catch { /* DB may not have wallet_balance — file-based wallet is the source of truth */ }

  // 4. Record the subscription in DB
  try {
    await execute(
      `INSERT INTO tipster_subscriptions (user_id, tipster_id, price, currency, status, payment_method, payment_ref, expires_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status='active', price=?, currency=?, payment_method=?, payment_ref=?,
         expires_at=?, updated_at=NOW()`,
      [userId, tipsterId, price, currency, paymentMethod, paymentRef ?? null, expiresAt.toISOString(),
       price, currency, paymentMethod, paymentRef ?? null, expiresAt.toISOString()]
    );
  } catch (e) {
    console.error('[subscription-store] Failed to record subscription in DB:', e);
    // Subscription was paid — don't fail, just log
  }

  return {
    ok: true,
    subscription: {
      expiresAt: expiresAt.toISOString(),
      daysLeft: SUBSCRIPTION_DAYS,
    },
    tipsterEarning,
    platformCut,
  };
}

/** Get subscriber count for a tipster */
export async function getSubscriberCount(tipsterId: number): Promise<number> {
  try {
    const res = await query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM tipster_subscriptions
       WHERE tipster_id = ? AND status = 'active' AND expires_at > NOW()`,
      [tipsterId]
    );
    return Number(res.rows[0]?.cnt ?? 0);
  } catch {
    return 0;
  }
}

/** Get all active subscriptions for a user */
export async function getUserSubscriptions(userId: number): Promise<Array<{
  tipsterId: number;
  price: number;
  currency: string;
  expiresAt: string;
  daysLeft: number;
}>> {
  try {
    const res = await query<{ tipster_id: number; price: number; currency: string; expires_at: string }>(
      `SELECT tipster_id, price, currency, expires_at
       FROM tipster_subscriptions
       WHERE user_id = ? AND status = 'active' AND expires_at > NOW()
       ORDER BY expires_at DESC`,
      [userId]
    );
    return res.rows.map(row => ({
      tipsterId: row.tipster_id,
      price: row.price,
      currency: row.currency,
      expiresAt: row.expires_at,
      daysLeft: Math.max(0, Math.ceil(
        (new Date(row.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )),
    }));
  } catch {
    return [];
  }
}

/** Get a tipster's subscription earnings summary */
export async function getTipsterEarningsSummary(tipsterId: number): Promise<{
  totalSubscribers: number;
  monthlyRevenue: number;
  allTimeRevenue: number;
  currency: string;
}> {
  try {
    const [countRes, revenueRes] = await Promise.all([
      query<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM tipster_subscriptions
         WHERE tipster_id = ? AND status = 'active' AND expires_at > NOW()`,
        [tipsterId]
      ),
      query<{ monthly: number; total: number }>(
        `SELECT
           SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN ROUND(price * ?, 0) ELSE 0 END) AS monthly,
           SUM(ROUND(price * ?, 0)) AS total
         FROM tipster_subscriptions
         WHERE tipster_id = ? AND status = 'active'`,
        [TIPSTER_SHARE, TIPSTER_SHARE, tipsterId]
      ),
    ]);

    return {
      totalSubscribers: Number(countRes.rows[0]?.cnt ?? 0),
      monthlyRevenue: Number(revenueRes.rows[0]?.monthly ?? 0),
      allTimeRevenue: Number(revenueRes.rows[0]?.total ?? 0),
      currency: 'KES',
    };
  } catch {
    return { totalSubscribers: 0, monthlyRevenue: 0, allTimeRevenue: 0, currency: 'KES' };
  }
}

/** Cancel a subscription */
export async function cancelSubscription(userId: number, tipsterId: number): Promise<boolean> {
  try {
    const res = await execute(
      `UPDATE tipster_subscriptions SET status='cancelled', updated_at=NOW()
       WHERE user_id = ? AND tipster_id = ? AND status = 'active'`,
      [userId, tipsterId]
    );
    return res.affectedRows > 0;
  } catch {
    return false;
  }
}
