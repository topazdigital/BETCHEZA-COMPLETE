import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import {
  addCompetition,
  updateCompetition,
  deleteCompetition,
  getCompetitions,
  type NewCompetitionInput,
} from '@/lib/competitions-store';
import {
  validateCompetitionLeague,
  detectSportFocusFromName,
  findLeagueRoundEndDate,
  migrateCompetitionsTable,
} from '@/lib/competition-league-utils';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Ensure DB columns exist the first time an admin hits this route
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
  return NextResponse.json({ competitions: getCompetitions() });
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

  // ── League detection & validation ──────────────────────────────────
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

  // ── Round-based end date detection ─────────────────────────────────
  let endDate = String(body.endDate);
  let roundBased = false;

  if (detected && body.type === 'weekly') {
    // Try to find the last match of the league round within the competition window
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

  // ── Build rules based on whether it's league-specific ──────────────
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

  const comp = addCompetition({
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
  });

  // ── Persist to MySQL if DB is available ────────────────────────────
  await query(
    `INSERT INTO competitions
       (id, name, description, type, status, sport_focus, league_id, league_name,
        prize_pool, entry_fee, max_participants, currency, prize_breakdown, slug,
        rules, start_date, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO NOTHING`,
    [
      comp.id,
      comp.name,
      comp.description,
      comp.type,
      comp.status,
      sportFocus,
      detected?.leagueId ?? null,
      detected?.leagueName ?? null,
      comp.prizePool,
      comp.entryFee,
      comp.maxParticipants,
      comp.currency,
      JSON.stringify(comp.prizes),
      comp.slug,
      JSON.stringify(comp.rules),
      comp.startDate,
      comp.endDate,
    ],
  ).catch(e => console.warn('[competitions POST] DB insert failed:', e));

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

  const updated = updateCompetition(Number(body.id), body);
  if (!updated) {
    return NextResponse.json(
      { error: 'Competition not found or is a built-in (not editable).' },
      { status: 404 },
    );
  }

  // Mirror update to DB
  await query(
    `UPDATE competitions SET status = ?, end_date = ?, start_date = ?, prize_pool = ?, entry_fee = ? WHERE id = ?`,
    [updated.status, updated.endDate, updated.startDate, updated.prizePool, updated.entryFee, updated.id],
  ).catch(() => {});

  return NextResponse.json({ success: true, competition: updated });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await ensureMigrated();

  const id = Number(req.nextUrl.searchParams.get('id') || 0);
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const ok = deleteCompetition(id);
  if (!ok) {
    return NextResponse.json(
      { error: 'Competition not found or is a built-in (cannot be deleted).' },
      { status: 404 },
    );
  }

  await query(`DELETE FROM competitions WHERE id = ?`, [id]).catch(() => {});
  return NextResponse.json({ success: true });
}
