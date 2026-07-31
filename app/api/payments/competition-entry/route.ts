import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { debit, credit, getBalance } from '@/lib/wallet-store';
import { initiateStkPush, checkTransactionStatus } from '@/lib/payhero';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PendingCompetitionPayment {
  userId: number;
  phone: string;
  reference: string;
  initiatedAt: string;
  checkoutRequestId?: string;
  walletContribution: number;
  amount: number;
  currency: string;
  competitionName: string;
  competitionSlug?: string;
}

interface PaymentBody {
  method?: 'mpesa' | 'wallet';
  action?: 'check';
  reference?: string;
  amount?: number;
  currency?: string;
  competitionName?: string;
  competitionSlug?: string;
  phone?: string;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Sign in required.' }, { status: 401 });
  }

  let body: PaymentBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
  }

  // ── Poll payment status ─────────────────────────────────────────────────
  if (body.action === 'check' && body.reference) {
    const status = await checkTransactionStatus(body.reference);
    if (status === 'completed') {
      const pending = fileStoreGet<PendingCompetitionPayment[]>('competition-pending', []);
      fileStoreSet('competition-pending', pending.filter(p => p.reference !== body.reference));
      return NextResponse.json({ success: true, status, reference: body.reference });
    }
    return NextResponse.json({ success: false, status });
  }

  if (!body.amount || body.amount <= 0) {
    return NextResponse.json({ success: false, error: 'A positive amount is required.' }, { status: 400 });
  }

  const { amount, currency = 'KES', competitionName = '', competitionSlug } = body;

  // ── Full wallet payment ─────────────────────────────────────────────────
  if (body.method === 'wallet') {
    const balance = getBalance(user.userId, currency);

    if (balance >= amount) {
      const result = debit(user.userId, amount, {
        type: 'competition_entry',
        currency,
        method: 'wallet',
        description: `Entry fee · ${competitionName}`,
        meta: { competitionSlug },
      });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.error, balance: result.balance }, { status: 402 });
      }
      return NextResponse.json({
        success: true,
        reference: result.txn.id,
        method: 'wallet',
        amount,
        currency,
        newBalance: result.newBalance,
        paidAt: result.txn.createdAt,
      });
    }

    // Partial wallet — return how much top-up is needed so UI can prompt for phone
    const topUpAmount = amount - balance;
    const rawPhone = String(body.phone || '').replace(/\s+/g, '');

    if (!rawPhone) {
      return NextResponse.json({
        needsTopUp: true,
        walletBalance: balance,
        topUpAmount,
        message: `Wallet covers ${currency} ${balance.toLocaleString()}. Pay the remaining ${currency} ${topUpAmount.toLocaleString()} via M-Pesa.`,
      });
    }

    // Deduct available wallet balance first
    let walletContribution = 0;
    if (balance > 0) {
      const walletResult = debit(user.userId, balance, {
        type: 'competition_entry',
        currency,
        description: `Entry fee (wallet portion) · ${competitionName}`,
        meta: { competitionSlug },
      });
      if (walletResult.ok) walletContribution = balance;
    }

    // Initiate STK push for the remainder
    const reference = `COMP-TOPUP-${user.userId}-${Date.now()}`;
    const stkResult = await initiateStkPush(topUpAmount, rawPhone, reference);

    if (!stkResult.ok) {
      if (walletContribution > 0) {
        credit(user.userId, walletContribution, {
          type: 'refund',
          currency,
          description: `Refund — M-Pesa top-up failed for ${competitionName}`,
        });
      }
      return NextResponse.json({ success: false, error: stkResult.error || 'Payment initiation failed' }, { status: 502 });
    }

    const pending = fileStoreGet<PendingCompetitionPayment[]>('competition-pending', []);
    const filtered = pending.filter(p => !(p.userId === user.userId && p.competitionSlug === competitionSlug));
    filtered.push({
      userId: user.userId,
      phone: rawPhone,
      reference,
      initiatedAt: new Date().toISOString(),
      checkoutRequestId: stkResult.checkoutRequestId,
      walletContribution,
      amount,
      currency,
      competitionName,
      competitionSlug,
    });
    fileStoreSet('competition-pending', filtered);

    return NextResponse.json({
      success: true,
      reference,
      topUpAmount,
      walletContribution,
      message: `STK push sent for ${currency} ${topUpAmount.toLocaleString()}. Enter your M-Pesa PIN to complete.`,
    });
  }

  // ── Full M-Pesa STK push ────────────────────────────────────────────────
  if (body.method === 'mpesa') {
    const rawPhone = String(body.phone || '').replace(/\s+/g, '');
    if (!rawPhone) return NextResponse.json({ success: false, error: 'Phone number required' }, { status: 400 });

    const reference = `COMP-${user.userId}-${Date.now()}`;
    const result = await initiateStkPush(amount, rawPhone, reference);

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error || 'Payment initiation failed' }, { status: 502 });
    }

    const pending = fileStoreGet<PendingCompetitionPayment[]>('competition-pending', []);
    const filtered = pending.filter(p => !(p.userId === user.userId && p.competitionSlug === competitionSlug));
    filtered.push({
      userId: user.userId,
      phone: rawPhone,
      reference,
      initiatedAt: new Date().toISOString(),
      checkoutRequestId: result.checkoutRequestId,
      walletContribution: 0,
      amount,
      currency,
      competitionName,
      competitionSlug,
    });
    fileStoreSet('competition-pending', filtered);

    return NextResponse.json({
      success: true,
      reference,
      message: 'STK push sent. Enter your M-Pesa PIN to complete payment.',
    });
  }

  return NextResponse.json({ success: false, error: 'Invalid payment method.' }, { status: 400 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ balance: 0 }, { status: 401 });
  return NextResponse.json({ balance: getBalance(user.userId, 'KES'), currency: 'KES' });
}
