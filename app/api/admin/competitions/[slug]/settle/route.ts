import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import {
  getCompetitionBySlug,
  settleCompetition,
  getSettlement,
  computePayouts,
} from '@/lib/competitions-store';
import { credit } from '@/lib/wallet-store';
import { mockUsers } from '@/lib/mock-data';
import { getTemplate } from '@/lib/email-templates-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function renderTpl(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(vars[k] ?? ''));
}

// GET — preview the payouts that would be applied (does not credit anything)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { slug } = await params;
  const comp = getCompetitionBySlug(slug);
  if (!comp) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    competition: { id: comp.id, slug: comp.slug, name: comp.name, status: comp.status },
    payouts: computePayouts(comp.id),
    settled: getSettlement(comp.id),
  });
}

// POST — perform settlement: marks competition completed and credits wallets
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { slug } = await params;
  const comp = getCompetitionBySlug(slug);
  if (!comp) return NextResponse.json({ error: 'Competition not found' }, { status: 404 });

  const result = settleCompetition(comp.id);
  if (!result.ok) {
    return NextResponse.json({ error: 'Settle failed' }, { status: 400 });
  }
  if (result.alreadySettled) {
    return NextResponse.json({
      success: true,
      alreadySettled: true,
      settlement: getSettlement(comp.id),
    });
  }

  // Credit wallets for each real (human) payout
  const tpl = getTemplate('prize_payout');
  const credited: Array<{
    userId: number;
    username: string;
    amount: number;
    txnId: number | string;
    emailSubject?: string;
  }> = [];

  for (const p of result.toCredit) {
    const txn = credit(p.userId, p.amount, {
      type: 'prize_payout',
      currency: comp.currency || 'KES',
      method: 'system',
      reference: `comp-${comp.id}-rank-${p.rank}`,
      description: `Prize payout — ${comp.name} (${p.place})`,
      meta: {
        competitionId: comp.id,
        competitionSlug: comp.slug,
        competitionName: comp.name,
        place: p.place,
        rank: p.rank,
      },
    });

    // Render the email template (we don't actually deliver, just record)
    const user = mockUsers.find(u => u.id === p.userId);
    let emailSubject: string | undefined;
    if (user) {
      const vars = {
        username: user.username,
        displayName: user.display_name || user.username,
        amount: p.amount,
        currency: comp.currency || 'KES',
        competitionName: comp.name,
        place: p.place,
        rank: p.rank,
      };
      emailSubject = renderTpl(tpl.subject, vars);
    }

    credited.push({
      userId: p.userId,
      username: p.username,
      amount: p.amount,
      txnId: txn.id,
      emailSubject,
    });
  }

  return NextResponse.json({
    success: true,
    alreadySettled: false,
    competition: {
      id: comp.id,
      slug: comp.slug,
      name: comp.name,
      status: comp.status,
    },
    payouts: result.toCredit,
    credited,
    settlement: getSettlement(comp.id),
  });
}
