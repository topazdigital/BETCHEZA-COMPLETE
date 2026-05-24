import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { getBalance } from '@/lib/wallet-store';
import {
  checkSubscription,
  createSubscription,
  cancelSubscription,
  SUBSCRIPTION_DAYS,
  TIPSTER_SHARE,
} from '@/lib/subscription-store';
import { initiateStkPush, isConfigured as payHeroConfigured, normalizeKenyanPhone, storePending } from '@/lib/payhero';
import { sendMail } from '@/lib/mailer';
import { tipsterSubscriptionEmail } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET — return subscription status for the current user */
export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ subscribed: false, daysLeft: 0 });

  const tipsterId = Number(id);
  if (!tipsterId) return NextResponse.json({ subscribed: false, daysLeft: 0 });

  const result = await checkSubscription(user.userId, tipsterId);
  return NextResponse.json(result);
}

/** POST — subscribe user to tipster, processing wallet or M-Pesa payment */
export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    tipsterId?: number;
    tipsterName?: string;
    tipsterUsername?: string;
    price?: number;
    currency?: string;
    paymentMethod?: 'wallet' | 'mpesa';
    phone?: string;
  };

  const tipsterId = Number(id) || body.tipsterId;
  if (!tipsterId) {
    return NextResponse.json({ error: 'Invalid tipster ID' }, { status: 400 });
  }

  // Look up the tipster's actual price from DB
  let price = body.price ?? 0;
  let currency = body.currency ?? 'KES';
  let tipsterDisplayName = body.tipsterName ?? `Tipster #${tipsterId}`;
  let tipsterUsername = body.tipsterUsername ?? String(tipsterId);

  try {
    const r = await query<{
      id: number; username: string; display_name: string | null;
      subscription_price: number | null; subscription_currency: string | null;
    }>(
      `SELECT u.id, u.username,
              COALESCE(up.display_name, u.username) AS display_name,
              u.subscription_price, u.subscription_currency
       FROM users u LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.id = ? LIMIT 1`,
      [tipsterId]
    );
    if (r.rows[0]) {
      price = r.rows[0].subscription_price ?? price;
      currency = r.rows[0].subscription_currency ?? currency;
      tipsterDisplayName = r.rows[0].display_name ?? tipsterDisplayName;
      tipsterUsername = r.rows[0].username ?? tipsterUsername;
    }
  } catch { /* use body values as fallback */ }

  if (price <= 0) {
    // Free / price not set — just record subscription without payment
    const result = await createSubscription({
      userId: user.userId, tipsterId,
      tipsterUsername, tipsterDisplayName,
      price: 0, currency, paymentMethod: 'free',
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({
      success: true,
      free: true,
      message: `Subscribed to ${tipsterDisplayName}!`,
      expiresAt: result.subscription.expiresAt,
      daysLeft: result.subscription.daysLeft,
    });
  }

  const paymentMethod = body.paymentMethod ?? 'wallet';

  // ── Wallet payment path ─────────────────────────────────────────────────────
  if (paymentMethod === 'wallet') {
    const walletBalance = getBalance(user.userId, currency);

    if (walletBalance < price) {
      return NextResponse.json({
        error: `Insufficient wallet balance. You have ${currency} ${walletBalance.toLocaleString()} but need ${currency} ${price.toLocaleString()}.`,
        balance: walletBalance,
        required: price,
        currency,
        canUseMpesa: payHeroConfigured(),
      }, { status: 402 });
    }

    const tipsterEarning = Math.round(price * TIPSTER_SHARE);
    const result = await createSubscription({
      userId: user.userId, tipsterId,
      tipsterUsername, tipsterDisplayName,
      price, currency, paymentMethod: 'wallet',
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    // Send confirmation email to subscriber (non-blocking)
    try {
      const userRow = await queryOne<{ email: string; username: string; display_name: string | null }>(
        `SELECT u.email, u.username, COALESCE(up.display_name, u.username) AS display_name
         FROM users u LEFT JOIN user_profiles up ON up.user_id = u.id
         WHERE u.id = ? LIMIT 1`,
        [user.userId]
      );
      if (userRow?.email) {
        const tpl = tipsterSubscriptionEmail({
          subscriberName: userRow.display_name || userRow.username,
          tipsterName: tipsterDisplayName,
          tipsterUsername,
          price,
          currency,
          expiresAt: result.subscription.expiresAt,
          daysLeft: result.subscription.daysLeft,
        });
        sendMail({ to: userRow.email, subject: tpl.subject, html: tpl.html, text: tpl.text }).catch(() => {});
      }
    } catch { /* email errors must never block the subscription response */ }

    return NextResponse.json({
      success: true,
      message: `Subscribed to ${tipsterDisplayName} for ${SUBSCRIPTION_DAYS} days!`,
      expiresAt: result.subscription.expiresAt,
      daysLeft: result.subscription.daysLeft,
      tipsterEarning,
      platformCut: result.platformCut,
      newBalance: getBalance(user.userId, currency),
    });
  }

  // ── M-Pesa STK push path ────────────────────────────────────────────────────
  if (paymentMethod === 'mpesa') {
    if (!payHeroConfigured()) {
      return NextResponse.json({ error: 'M-Pesa payments are not configured. Please use wallet balance.' }, { status: 503 });
    }

    const phone = body.phone;
    if (!phone) {
      return NextResponse.json({ error: 'Phone number required for M-Pesa payment' }, { status: 400 });
    }

    const normalizedPhone = normalizeKenyanPhone(phone);
    const reference = `SUB_${user.userId}_${tipsterId}_${Date.now()}`;

    const stkResult = await initiateStkPush(price, normalizedPhone, reference);
    if (!stkResult.ok) {
      return NextResponse.json({ error: stkResult.error ?? 'M-Pesa payment failed' }, { status: 502 });
    }

    // Store pending subscription — will be confirmed via PayHero callback
    storePending(reference, {
      userId: user.userId,
      amount: price,
      currency,
      phone: normalizedPhone,
      type: 'deposit',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    // Store subscription intent in a temp format so callback can finalize it
    try {
      await query(
        `INSERT INTO tipster_subscriptions (user_id, tipster_id, price, currency, status, payment_method, payment_ref, expires_at)
         VALUES (?, ?, ?, ?, 'pending', 'mpesa', ?, DATE_ADD(NOW(), INTERVAL ? DAY))
         ON DUPLICATE KEY UPDATE status='pending', payment_ref=?, payment_method='mpesa', updated_at=NOW()`,
        [user.userId, tipsterId, price, currency, reference, SUBSCRIPTION_DAYS, reference]
      ).catch(() => {});
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      pending: true,
      message: `M-Pesa payment of ${currency} ${price} sent to ${normalizedPhone}. Check your phone and enter your PIN to complete.`,
      reference,
      checkoutRequestId: stkResult.checkoutRequestId,
      pollUrl: `/api/tipsters/${tipsterId}/subscribe/status?ref=${reference}`,
    });
  }

  return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
}

/** DELETE — cancel subscription */
export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

  const tipsterId = Number(id);
  const cancelled = await cancelSubscription(user.userId, tipsterId);
  return NextResponse.json({ success: cancelled });
}
