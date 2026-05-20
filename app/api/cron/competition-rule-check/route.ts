/**
 * Competition rule-violation checker.
 * Called every 60 min by the cron scheduler.
 *
 * For every ACTIVE competition with enforceable ruleConfig entries, we:
 *  1. Compute each joined real user's current stats from auto_tips.
 *  2. If a stat violates the rule threshold we kick the user
 *     (remove from join list + participant list) and send an email.
 *
 * Fake tipsters (id >= 1000) are never kicked — they always behave correctly.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCompetitions,
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
  // Fetch the user's email from DB
  try {
    const result = await query<{ email: string; display_name: string }>(
      `SELECT email, display_name FROM users WHERE id = ? LIMIT 1`,
      [userId],
    );
    const user = result.rows[0];
    if (!user?.email) return;

    // Log the email (actual sending would use an email service)
    console.log(
      `[rule-check] VIOLATION EMAIL → ${user.email} (${user.display_name}): ` +
        `removed from "${competitionName}" — rule: ${violatedRule}`,
    );

    // If SMTP / email service is configured, send here.
    // For now we record the kick in the store (kickUserFromCompetition already does this).
  } catch (e) {
    console.warn('[rule-check] email lookup failed:', e);
  }
}

function checkViolation(
  rule: RuleConfig,
  stats: UserStats,
): string | null {
  switch (rule.type) {
    case 'min_tips': {
      const min = Number(rule.value ?? 3);
      if (stats.tipCount < min) {
        return `Posted only ${stats.tipCount} tip(s) — minimum is ${min}.`;
      }
      break;
    }
    case 'min_avg_odds': {
      const min = Number(rule.value ?? 1.5);
      if (stats.avgOdds < min && stats.tipCount > 0) {
        return `Average odds ${stats.avgOdds.toFixed(2)} is below minimum ${min}.`;
      }
      break;
    }
    case 'max_losses': {
      const max = Number(rule.value ?? 999);
      if (stats.lostCount > max) {
        return `Loss count ${stats.lostCount} exceeds maximum allowed ${max}.`;
      }
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

  const active = getCompetitions().filter(
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

    const joinedIds = getJoinedUserIds(comp.id).filter((id) => id < 1000);

    for (const userId of joinedIds) {
      // Skip already-kicked users
      if (comp.kickedUsers?.includes(userId)) continue;

      const stats = await fetchUserStats(userId, comp.startDate, comp.endDate);

      for (const rule of enforceable) {
        const violation = checkViolation(rule, stats);
        if (violation) {
          kickUserFromCompetition(comp.id, userId);
          await sendViolationEmail(userId, comp.name, rule.label);
          totalKicked++;
          log.push(`Kicked user ${userId} from "${comp.name}": ${violation}`);
          break; // one kick per user per run
        }
      }
    }
  }

  return NextResponse.json({
    checked: active.length,
    kicked: totalKicked,
    log,
  });
}
