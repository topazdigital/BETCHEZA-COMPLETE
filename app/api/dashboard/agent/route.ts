import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  // Fetch username from DB (not in JWT payload) so we can call getReferralStats correctly
  const userRow = await queryOne<{ username: string }>(
    `SELECT username FROM users WHERE id = ? LIMIT 1`,
    [user.userId],
  ).catch(() => null);
  const username = userRow?.username ?? '';

  // Look up applications strictly by the authenticated user's own email.
  // No caller-supplied parameters are accepted.
  const emailRows = user.email
    ? await query<{
        id: number; name: string; phone: string; role: string;
        status: string; created_at: string; notes: string | null;
      }>(
        `SELECT id, name, phone, role, status, created_at, notes
           FROM career_applications
          WHERE email = ?
          ORDER BY created_at DESC
          LIMIT 10`,
        [user.email],
      ).catch(() => ({ rows: [] as { id: number; name: string; phone: string; role: string; status: string; created_at: string; notes: string | null }[] }))
    : { rows: [] as { id: number; name: string; phone: string; role: string; status: string; created_at: string; notes: string | null }[] };

  const applications = emailRows.rows;

  // Referral stats — scoped to the authenticated user's own ID + username
  const { getReferralStats } = await import('@/lib/referral-store');
  const referralStats = await getReferralStats(user.userId, username).catch(() => null);

  const qualified = referralStats?.qualifiedReferrals ?? 0;
  const total     = referralStats?.totalReferrals     ?? 0;
  const earned    = referralStats?.totalEarned        ?? 0;

  // Agent tier based on qualified referrals
  let tier = 'Starter';
  let rate = 200;
  if (qualified >= 100)     { tier = 'Elite';  rate = 500; }
  else if (qualified >= 51) { tier = 'Pro';    rate = 400; }
  else if (qualified >= 21) { tier = 'Active'; rate = 300; }

  return NextResponse.json({
    ok: true,
    applications,
    referralStats: referralStats ? {
      code:               referralStats.code,
      referralUrl:        referralStats.referralUrl,
      totalReferrals:     total,
      verifiedReferrals:  referralStats.verifiedReferrals,
      qualifiedReferrals: qualified,
      pendingReferrals:   referralStats.pendingReferrals,
      totalEarned:        earned,
      referrals:          referralStats.referrals,
    } : null,
    agentTier: {
      tier,
      rate,
      nextTier: tier === 'Elite' ? null : (
        tier === 'Pro'    ? { name: 'Elite',  threshold: 100 } :
        tier === 'Active' ? { name: 'Pro',    threshold: 51  } :
                            { name: 'Active', threshold: 21  }
      ),
      qualifiedThisMonth: qualified,
    },
  });
}
