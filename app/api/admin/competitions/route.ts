import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import {
  addCompetition,
  updateCompetition,
  deleteCompetition,
  getCompetitionsAsync,
  type NewCompetitionInput,
} from '@/lib/competitions-store';
import {
  validateCompetitionLeague,
  findLeagueRoundEndDate,
  migrateCompetitionsTable,
} from '@/lib/competition-league-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

let _migrated = false;
async function ensureMigrated() {
  if (_migrated) return;
  _migrated = true;
  await migrateCompetitionsTable();
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureMigrated();
  const competitions = await getCompetitionsAsync();
  return NextResponse.json({ competitions });
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureMigrated();

  let body: Partial<NewCompetitionInput> & { roundBased?: boolean } = {};
  try { body = await req.json(); } catch {}

  if (!body.name || !body.startDate || !body.endDate) {
    return NextResponse.json(
      { error: 'name, startDate, and endDate are required.' },
      { status: 400 },
    );
  }

  const name = String(body.name).trim();
  const validation = validateCompetitionLeague(name);

  if (!validation.valid) {
    return NextResponse.json(
      {
        error: validation.warning,
        hint: 'Use a recognised league name (e.g. "Premier League Weekly") or a generic name (e.g. "Weekly Tipster Challenge").',
        leagueList: 'See /api/admin/competitions/validate-league for all valid leagues.',
      },
      { status: 400 },
    );
  }

  const detected = validation.detected;
  const sportFocus = String(body.sportFocus || validation.sportFocus || 'multi-sport');

  let endDate = String(body.endDate);
  let roundBased = false;

  if (detected && body.type === 'weekly') {
    const roundEnd = await findLeagueRoundEndDate(
      detected.leagueName,
      String(body.startDate),
      endDate,
    );
    if (roundEnd) {
      endDate = roundEnd;
      roundBased = true;
    }
  }

  const defaultRules = detected
    ? [
        `Only ${detected.leagueName} matches count for scoring.`,
        'Minimum 3 tips required to appear on the leaderboard.',
        'Score = (wins × 10) + average win odds bonus − (losses × 5).',
        'Competition ends after the last match of the round.',
      ]
    : [
        'All sports and leagues are accepted.',
        'Minimum 3 tips required to appear on the leaderboard.',
        'Score = (wins × 10) + average win odds bonus − (losses × 5).',
        'Tie-breaker: win rate then ROI.',
      ];

  const comp = await addCompetition({
    name,
    description: String(body.description || ''),
    type: (body.type as NewCompetitionInput['type']) || 'weekly',
    status: body.status,
    startDate: String(body.startDate),
    endDate,
    prizePool: Number(body.prizePool || 0),
    currency: body.currency || 'KES',
    entryFee: Number(body.entryFee || 0),
    maxParticipants: Number(body.maxParticipants || 100),
    prizes: body.prizes,
    rules: (body.rules && body.rules.length > 0) ? body.rules : defaultRules,
    ruleConfig: Array.isArray(body.ruleConfig) ? body.ruleConfig : undefined,
    sportFocus,
    leagueId: detected?.leagueId ?? null,
    leagueName: detected?.leagueName ?? null,
    roundBased,
    matchKickoffFrom: body.matchKickoffFrom ? String(body.matchKickoffFrom) : null,
    matchKickoffTo: body.matchKickoffTo ? String(body.matchKickoffTo) : null,
  });

  return NextResponse.json({
    success: true,
    competition: comp,
    detectedLeague: detected ? { leagueId: detected.leagueId, leagueName: detected.leagueName } : null,
    roundBased,
  });
}

export async function PATCH(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureMigrated();

  let body: { id?: number } & Partial<NewCompetitionInput> = {};
  try { body = await req.json(); } catch {}
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const updated = await updateCompetition(Number(body.id), body);
  if (!updated) {
    return NextResponse.json(
      { error: 'Competition not found.' },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, competition: updated });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureMigrated();

  const id = Number(req.nextUrl.searchParams.get('id') || 0);
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const ok = await deleteCompetition(id);
  if (!ok) {
    return NextResponse.json(
      { error: 'Competition not found.' },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
