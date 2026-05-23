import { NextRequest, NextResponse } from 'next/server';
import {
  getCompetitions,
  settleCompetition,
  addCompetition,
  type Competition,
} from '@/lib/competitions-store';
import { computeLeaderboard, findLeagueRoundEndDate } from '@/lib/competition-league-utils';
import { createPost } from '@/lib/feed-store';
import { query } from '@/lib/db';
import { sendMail } from '@/lib/mailer';
import { credit } from '@/lib/wallet-store';

// Grace period after the last match kicks off before we treat a round-scoped
// competition as eligible to settle (enough time for 90 min + extra time).
const KICKOFF_GRACE_MS = 3 * 60 * 60 * 1000; // 3 hours

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || 'betcheza-cron-2024';

// League seasons — used to decide whether to restart a competition
// True = league is actively running (should restart), false = off-season
const LEAGUE_ACTIVE: Record<string, boolean> = {
  football: true,
  'premier-league': true,
  epl: true,
  laliga: true,
  bundesliga: true,
  seriea: true,
  ligue1: true,
  'champions-league': true,
  'europa-league': true,
  basketball: true,
  tennis: true,
  'multi-sport': true,
};

function isLeagueActive(sportFocus: string): boolean {
  const key = sportFocus.toLowerCase().replace(/\s+/g, '-');
  if (LEAGUE_ACTIVE[key] !== undefined) return LEAGUE_ACTIVE[key];
  // Default: assume active for unknown sports
  return true;
}

function nextPeriodDates(comp: Competition): { startDate: string; endDate: string } {
  const now = new Date();
  const originalDuration = new Date(comp.endDate).getTime() - new Date(comp.startDate).getTime();

  switch (comp.type) {
    case 'daily':
      return {
        startDate: now.toISOString(),
        endDate: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      };
    case 'weekly':
      return {
        startDate: now.toISOString(),
        endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
    case 'monthly':
      return {
        startDate: now.toISOString(),
        endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
    default:
      return {
        startDate: now.toISOString(),
        endDate: new Date(now.getTime() + originalDuration).toISOString(),
      };
  }
}

function buildPlaceLabel(rank: number): string {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  return `${rank}th`;
}

function winnersText(
  payouts: Array<{ rank: number; username: string; amount: number; isFakeTipster: boolean }>
): string {
  const real = payouts.filter(p => !p.isFakeTipster).slice(0, 3);
  const fake = payouts.filter(p => p.isFakeTipster).slice(0, 3 - real.length);
  const all = [...real, ...fake].slice(0, 3);
  if (all.length === 0) return '';
  return all.map(p => `${buildPlaceLabel(p.rank)}: ${p.username} (KES ${p.amount.toLocaleString()})`).join(' | ');
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const secret = req.nextUrl.searchParams.get('secret');
  if (auth !== `Bearer ${CRON_SECRET}` && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const competitions = getCompetitions();
  const results: Array<{ id: number; name: string; action: string }> = [];

  for (const comp of competitions) {
    // Only settle active competitions
    if (comp.status !== 'active') continue;

    const endedAt = new Date(comp.endDate).getTime();

    // ── Kickoff-window scoped competition (any round / any league) ─────
    // A competition with matchKickoffFrom/matchKickoffTo is treated as a
    // single-round contest.  It becomes eligible to settle once the kickoff
    // window closes AND a grace period has passed (matches need time to finish).
    const isRoundScoped = !!(comp.matchKickoffFrom && comp.matchKickoffTo);
    if (isRoundScoped) {
      const windowEnds = new Date(comp.matchKickoffTo!).getTime();
      if (now < windowEnds + KICKOFF_GRACE_MS) {
        // Matches haven't had time to finish yet — wait
        results.push({ id: comp.id, name: comp.name, action: 'round-in-progress' });
        continue;
      }
      // Window is over — fall through to settle regardless of endDate
    } else {
      // Normal time-based competition: only settle when endDate has passed
      if (endedAt > now) continue;
    }

    // ── 1. Check round-based end for league competitions ───────────────
    // For weekly league competitions, the cron auto-extends the end date
    // to match the actual last kickoff of the round.
    if (!isRoundScoped && comp.roundBased && comp.leagueName) {
      const weekAhead = new Date(new Date(comp.startDate).getTime() + 8 * 24 * 60 * 60 * 1000).toISOString();
      const roundEnd = await findLeagueRoundEndDate(comp.leagueName, comp.startDate, weekAhead);
      if (roundEnd && new Date(roundEnd).getTime() > now) {
        // Round hasn't finished yet — skip this competition
        results.push({ id: comp.id, name: comp.name, action: 'round-not-finished' });
        continue;
      }
    }

    // ── 2. Build real leaderboard from auto_tips before settling ──────
    // Round-scoped competitions require only 1 tip minimum (short window).
    const realLeaderboard = await computeLeaderboard({
      startDate: comp.startDate,
      endDate: comp.endDate,
      leagueId: comp.leagueId,
      leagueName: comp.leagueName,
      sportFocus: comp.sportFocus,
      matchKickoffFrom: comp.matchKickoffFrom,
      matchKickoffTo: comp.matchKickoffTo,
      minTips: isRoundScoped ? 1 : 3,
      limit: 50,
    });

    // Inject real scores back into comp.participants so settleCompetition uses them
    if (realLeaderboard.length > 0) {
      const realMap = new Map(realLeaderboard.map((r, i) => [r.userId, { ...r, rank: i + 1 }]));
      for (const p of comp.participants) {
        const real = realMap.get(p.tipsterId);
        if (real) {
          p.points = real.points;
          p.roi = real.roi;
          p.winRate = real.winRate;
          p.won = real.won;
          p.tips = real.totalTips;
          p.rank = real.rank;
        }
      }
      // Add real users that aren't in fake participants yet
      for (const [, real] of realMap) {
        const exists = comp.participants.some(p => p.tipsterId === real.userId);
        if (!exists) {
          comp.participants.push({
            rank: real.rank,
            tipsterId: real.userId,
            username: real.username,
            displayName: real.displayName || real.username,
            avatar: real.avatar,
            countryCode: null,
            winRate: real.winRate,
            roi: real.roi,
            tips: real.totalTips,
            won: real.won,
            points: real.points,
            streak: 0,
            isVerified: false,
          });
        }
      }
    }

    // 3. SETTLE the competition
    const settlement = settleCompetition(comp.id);
    if (!settlement.ok || settlement.alreadySettled) continue;

    const payouts = settlement.toCredit;
    const winner = payouts[0];

    // 4. CREDIT real winners in the wallet (wallet-store = source of truth for
    //    the wallet dashboard; also mirror to MySQL wallet_balance for PayHero)
    for (const payout of payouts) {
      try {
        // Primary: file-based wallet-store (what /api/wallet reads from)
        credit(payout.userId, payout.amount, {
          type: 'prize_payout',
          currency: comp.currency || 'KES',
          method: 'system',
          reference: `comp-${comp.id}-rank-${payout.rank}`,
          description: `${buildPlaceLabel(payout.rank)} place prize — ${comp.name}`,
          meta: {
            competitionId: comp.id,
            competitionName: comp.name,
            place: payout.place,
            rank: payout.rank,
          },
        });

        // Mirror to MySQL wallet_balance so PayHero/admin panels stay in sync
        await query(
          `UPDATE users SET wallet_balance = COALESCE(wallet_balance, 0) + ? WHERE id = ?`,
          [payout.amount, payout.userId]
        ).catch(() => {}); // non-critical if column missing

        // Transaction history record
        await query(
          `INSERT INTO transactions (user_id, type, amount, description, status, created_at)
           VALUES (?, 'competition_prize', ?, ?, 'completed', NOW())`,
          [payout.userId, payout.amount, `${buildPlaceLabel(payout.rank)} place in ${comp.name}`]
        ).catch(() => {});
      } catch {
        // Non-critical — wallet-store credit already applied above
      }
    }

    // 3. ANNOUNCE in the feed
    // Build winner strings from real users (toCredit) and top fake participants
    const fakeWinnerSlots = comp.participants
      .filter(p => p.tipsterId >= 1000)
      .slice(0, 3)
      .map(p => ({ rank: p.rank, username: p.username, amount: 0, isFakeTipster: true as const }));
    const realWinnerSlots = settlement.toCredit.map(p => ({
      rank: p.rank,
      username: p.username,
      amount: p.amount,
      isFakeTipster: p.isFakeTipster,
    }));
    const winnersStr = winnersText([...realWinnerSlots, ...fakeWinnerSlots]);

    const announcementContent = winner
      ? `Competition ENDED: ${comp.name} — Congratulations to our winners! ${winnersStr} | Total prize pool: KES ${comp.prizePool.toLocaleString()} | Great competing everyone — see you in the next round!`
      : `Competition ENDED: ${comp.name} — Thank you to all participants! KES ${comp.prizePool.toLocaleString()} prize pool has been distributed. See you in the next round!`;

    await createPost({
      userId: 0,
      authorName: 'Betcheza',
      authorAvatar: null,
      content: announcementContent,
      matchId: null,
      matchTitle: null,
      pick: null,
      odds: null,
      imageUrl: null,
    }).catch(() => {});

    // 4. EMAIL real winners
    for (const payout of payouts.slice(0, 10)) {
      try {
        const userRow = await query<{ email: string; username: string; display_name: string | null }>(
          `SELECT u.email, u.username, up.display_name
           FROM users u LEFT JOIN user_profiles up ON up.user_id = u.id
           WHERE u.id = ? LIMIT 1`,
          [payout.userId]
        );
        const user = userRow.rows[0];
        if (!user?.email) continue;

        const displayName = user.display_name || user.username || `User #${payout.userId}`;
        await sendMail({
          to: user.email,
          subject: `🏆 You won ${buildPlaceLabel(payout.rank)} in ${comp.name}!`,
          html: `<!DOCTYPE html><html><body style="background:#0f1117;font-family:system-ui;margin:0;padding:24px">
<div style="max-width:500px;margin:0 auto;background:#1a1f2e;border-radius:16px;overflow:hidden;border:1px solid #2a2f3e">
  <div style="background:linear-gradient(135deg,#f59e0b,#ef4444);padding:28px 24px;text-align:center">
    <div style="font-size:40px">🏆</div>
    <h1 style="margin:8px 0 0;color:#fff;font-size:20px">You won ${buildPlaceLabel(payout.rank)} place!</h1>
  </div>
  <div style="padding:24px">
    <p style="color:#e2e8f0;font-size:16px">Hi <strong>${displayName}</strong>,</p>
    <p style="color:#94a3b8;font-size:14px">Congratulations! You finished ${buildPlaceLabel(payout.rank)} in <strong style="color:#e2e8f0">${comp.name}</strong>.</p>
    <div style="background:#0f1117;border-radius:12px;padding:20px;text-align:center;margin:16px 0;border:1px solid #2a2f3e">
      <div style="color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Prize Awarded</div>
      <div style="color:#f59e0b;font-size:36px;font-weight:700;margin-top:4px">KES ${payout.amount.toLocaleString()}</div>
      <div style="color:#94a3b8;font-size:13px;margin-top:4px">Added to your wallet</div>
    </div>
    <div style="text-align:center;margin-top:20px">
      <a href="https://betcheza.co.ke/competitions" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;border-radius:10px;padding:14px 28px;font-weight:600;font-size:15px;display:inline-block">Join the Next Competition →</a>
    </div>
  </div>
</div></body></html>`,
          text: `Hi ${displayName}, you finished ${buildPlaceLabel(payout.rank)} in ${comp.name} and won KES ${payout.amount.toLocaleString()}. Visit betcheza.co.ke/competitions.`,
        }).catch(() => {});
      } catch {
        // Non-critical
      }
    }

    // 5. RESTART if recurring and league is active.
    //    Round-scoped competitions (matchKickoffFrom/To set) are one-off —
    //    the admin sets the next round manually, so never auto-restart them.
    let restarted = false;
    if (!isRoundScoped && comp.type !== 'special' && isLeagueActive(comp.sportFocus)) {
      const { startDate, endDate: baseEndDate } = nextPeriodDates(comp);

      // For round-based league competitions: auto-detect the new round's end date
      let newEndDate = baseEndDate;
      let newRoundBased = comp.roundBased;
      if (comp.roundBased && comp.leagueName) {
        const weekAhead = new Date(new Date(startDate).getTime() + 8 * 24 * 60 * 60 * 1000).toISOString();
        const roundEnd = await findLeagueRoundEndDate(comp.leagueName, startDate, weekAhead);
        if (roundEnd) {
          newEndDate = roundEnd;
          newRoundBased = true;
        }
      }

      addCompetition({
        name: comp.name,
        description: comp.description,
        type: comp.type,
        status: 'active',
        startDate,
        endDate: newEndDate,
        prizePool: comp.prizePool,
        currency: comp.currency,
        entryFee: comp.entryFee,
        maxParticipants: comp.maxParticipants,
        prizes: comp.prizes,
        rules: comp.rules,
        sportFocus: comp.sportFocus,
        leagueId: comp.leagueId ?? null,
        leagueName: comp.leagueName ?? null,
        roundBased: newRoundBased ?? false,
        // Note: matchKickoffFrom/To are intentionally NOT copied — each round
        // gets its own window set manually by the admin.
      });
      restarted = true;
    }

    results.push({
      id: comp.id,
      name: comp.name,
      action: restarted ? 'settled+restarted' : isRoundScoped ? 'round-settled' : 'settled',
    });

    console.log(`[cron] competition-settle: "${comp.name}" ${isRoundScoped ? 'round-scoped ' : ''}settled. Winners: ${winnersStr}. Restarted: ${restarted}`);
  }

  return NextResponse.json({ processed: results.length, competitions: results });
}
