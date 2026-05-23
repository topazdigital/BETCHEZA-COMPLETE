import { NextRequest, NextResponse } from 'next/server';
import {
  getCompetitionsAsync,
  getJoinedUserIds,
  kickUserFromCompetition,
  type RuleConfig,
} from '@/lib/competitions-store';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET || 'betcheza-cron-2024';

interface UserStats {
  tipCount: number;
  wonCount: number;
  avgOdds: number;
  lostCount: number;
}

async function fetchUserStats(
  userId: number,
  startDate: string,
  endDate: string,
): Promise<UserStats> {
  try {
    const result = await query<{
      tip_count: number;
      won_count: number;
      avg_odds: number;
      lost_count: number;
    }>(
      `SELECT
         COUNT(*) AS tip_count,
         SUM(status = 'won') AS won_count,
         SUM(status = 'lost') AS lost_count,
         AVG(odds) AS avg_odds
       FROM auto_tips
       WHERE tipster_id = ?
         AND created_at >= ?
         AND created_at <= ?
         AND status IN ('won', 'lost', 'pending')`,
      [userId, startDate, endDate],
    );
    const row = result.rows[0];
    return {
      tipCount: Number(row?.tip_count ?? 0),
      wonCount: Number(row?.won_count ?? 0),
      lostCount: Number(row?.lost_count ?? 0),
      avgOdds: Number(row?.avg_odds ?? 0),
    };
  } catch {
    return { tipCount: 0, wonCount: 0, lostCount: 0, avgOdds: 0 };
  }
}

async function sendViolationEmail(
  userId: number,
  competitionName: string,
  violatedRule: string,
): Promise<void> {
  try {
    const result = await query<{ email: string; display_name: string }>(
      `SELECT email, display_name FROM users WHERE id = ? LIMIT 1`,
      [userId],
    );
    const user = result.rows[0];
    if (!user?.email) return;
    console.log(
      `[rule-check] VIOLATION EMAIL → ${user.email} (${user.display_name}): ` +
        `removed from "${competitionName}" — rule: ${violatedRule}`,
    );
  } catch (e) {
    console.warn('[rule-check] email lookup failed:', e);
  }
}

function checkViolation(rule: RuleConfig, stats: UserStats): string | null {
  switch (rule.type) {
    case 'min_tips': {
      const min = Number(rule.value ?? 3);
      if (stats.tipCount < min) return `Posted only ${stats.tipCount} tip(s) — minimum is ${min}.`;
      break;
    }
    case 'min_avg_odds': {
      const min = Number(rule.value ?? 1.5);
      if (stats.avgOdds < min && stats.tipCount > 0) return `Average odds ${stats.avgOdds.toFixed(2)} is below minimum ${min}.`;
      break;
    }
    case 'max_losses': {
      const max = Number(rule.value ?? 999);
      if (stats.lostCount > max) return `Loss count ${stats.lostCount} exceeds maximum allowed ${max}.`;
      break;
    }
    default:
      break;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (token !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const competitions = await getCompetitionsAsync();
  const active = competitions.filter(
    (c) => c.status === 'active' && Array.isArray(c.ruleConfig) && c.ruleConfig.length > 0,
  );

  if (active.length === 0) {
    return NextResponse.json({ message: 'No active competitions with enforceable rules.' });
  }

  let totalKicked = 0;
  const log: string[] = [];

  for (const comp of active) {
    const enforceable = (comp.ruleConfig ?? []).filter((r) => r.enforceable);
    if (enforceable.length === 0) continue;

    const joinedIds = (await getJoinedUserIds(comp.id)).filter((id) => id < 1000);

    for (const userId of joinedIds) {
      if (comp.kickedUsers?.includes(userId)) continue;

      const stats = await fetchUserStats(userId, comp.startDate, comp.endDate);

      for (const rule of enforceable) {
        const violation = checkViolation(rule, stats);
        if (violation) {
          await kickUserFromCompetition(comp.id, userId);
          await sendViolationEmail(userId, comp.name, rule.label);
          totalKicked++;
          log.push(`Kicked user ${userId} from "${comp.name}": ${violation}`);
          break;
        }
      }
    }
  }

  return NextResponse.json({ checked: active.length, kicked: totalKicked, log });
}
