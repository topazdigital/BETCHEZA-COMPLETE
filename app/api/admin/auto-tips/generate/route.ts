import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requireAdmin } from '@/lib/admin-auth';
import { seedTipsForMatch, getAutoTipsStats, type GeneratedTip } from '@/lib/auto-tips-store';
import { pushActivity, listActivity } from '@/lib/auto-tip-activity';
import { getAllMatches } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

interface Body {
  matchIds?: string[];
  onlyTipsterIds?: number[];
  limit?: number;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const onlyTipsterIds = new Set(body.onlyTipsterIds || []);
  const limit = Math.max(1, Math.min(50, body.limit ?? 10));

  // Resolve target matches.
  let targets: Array<{
    id: string;
    homeTeam: string;
    awayTeam: string;
    league?: string;
    sport?: string;
    kickoff?: string;
    leagueTier?: number;
  }> = [];

  try {
    const all = await getAllMatches();
    if (body.matchIds && body.matchIds.length > 0) {
      const want = new Set(body.matchIds);
      targets = all
        .filter((m) => want.has(m.id))
        .map((m) => ({
          id: m.id,
          homeTeam: m.homeTeam.name,
          awayTeam: m.awayTeam.name,
          league: m.league.name,
          sport: m.sport.name,
          kickoff: m.kickoffTime instanceof Date ? m.kickoffTime.toISOString() : String(m.kickoffTime),
          leagueTier: m.league.tier,
        }));
    } else {
      // Pick the next N upcoming scheduled matches.
      const upcoming = all
        .filter((m) => m.status === 'scheduled')
        .sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime())
        .slice(0, limit);
      targets = upcoming.map((m) => ({
        id: m.id,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        league: m.league.name,
        sport: m.sport.name,
        kickoff: m.kickoffTime instanceof Date ? m.kickoffTime.toISOString() : String(m.kickoffTime),
        leagueTier: m.league.tier,
      }));
    }
  } catch (e) {
    pushActivity('error', `Failed to load matches: ${(e as Error).message}`);
    return NextResponse.json({ error: 'Failed to load matches' }, { status: 500 });
  }

  if (targets.length === 0) {
    pushActivity('warn', 'No matches matched the request — nothing to generate.');
    return NextResponse.json({
      generated: 0,
      matches: 0,
      tipstersUsed: 0,
      log: listActivity(50),
      stats: getAutoTipsStats(),
    });
  }

  pushActivity('info', `Starting generation for ${targets.length} match${targets.length === 1 ? '' : 'es'}…`);

  let generated = 0;
  const tipstersUsed = new Set<number>();
  const generatedTips: GeneratedTip[] = [];
  let matchesTouched = 0;

  for (const t of targets) {
    try {
      const tips = seedTipsForMatch({
        matchId: t.id,
        homeTeam: t.homeTeam,
        awayTeam: t.awayTeam,
        league: t.league,
        sport: t.sport,
        kickoff: t.kickoff,
        leagueTier: t.leagueTier,
      });
      const filtered = onlyTipsterIds.size > 0 ? tips.filter((tp) => onlyTipsterIds.has(tp.tipsterId)) : tips;
      if (filtered.length > 0) {
        matchesTouched++;
        generated += filtered.length;
        for (const tip of filtered) {
          tipstersUsed.add(tip.tipsterId);
          generatedTips.push(tip);
        }
        pushActivity(
          'success',
          `${t.homeTeam} vs ${t.awayTeam} — ${filtered.length} tip${filtered.length === 1 ? '' : 's'} generated.`,
        );
      } else {
        pushActivity('info', `${t.homeTeam} vs ${t.awayTeam} — already has tips, skipped.`);
      }
    } catch (e) {
      pushActivity('error', `${t.homeTeam} vs ${t.awayTeam} — failed: ${(e as Error).message}`);
    }
  }

  pushActivity(
    'success',
    `Done. ${generated} tip${generated === 1 ? '' : 's'} across ${matchesTouched} match${matchesTouched === 1 ? '' : 'es'} from ${tipstersUsed.size} tipster${tipstersUsed.size === 1 ? '' : 's'}.`,
  );

  return NextResponse.json({
    generated,
    matches: matchesTouched,
    tipstersUsed: tipstersUsed.size,
    sampleTips: generatedTips.slice(0, 12),
    log: listActivity(50),
    stats: getAutoTipsStats(),
  });
}
