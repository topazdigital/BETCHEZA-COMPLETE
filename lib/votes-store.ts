import { query, getPool, execute } from './db';

export type VotePick = 'home' | 'draw' | 'away';

export interface VoteTotals {
  home: number;
  draw: number;
  away: number;
  total: number;
}

interface MemoryVote {
  matchId: string;
  voterId: string;
  pick: VotePick;
  ts: number;
}

const g = globalThis as { __matchVotes?: MemoryVote[] };
function memory(): MemoryVote[] {
  if (!g.__matchVotes) g.__matchVotes = [];
  return g.__matchVotes;
}

function hasDb(): boolean {
  return !!getPool();
}

let tableReady = false;
async function ensureTable(): Promise<void> {
  if (!hasDb() || tableReady) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS match_votes (
        id BIGSERIAL PRIMARY KEY,
        match_id VARCHAR(191) NOT NULL,
        voter_id VARCHAR(191) NOT NULL,
        pick VARCHAR(10) NOT NULL CHECK (pick IN ('home','draw','away')),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (match_id, voter_id)
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_match_votes_match ON match_votes (match_id)`);
    tableReady = true;
  } catch (e) {
    console.warn('[votes-store] ensureTable failed:', e);
  }
}

function emptyTotals(): VoteTotals {
  return { home: 0, draw: 0, away: 0, total: 0 };
}

export async function getVoteTotals(matchId: string): Promise<VoteTotals> {
  if (hasDb()) {
    await ensureTable();
    try {
      const r = await query<{ pick: VotePick; c: string }>(
        `SELECT pick, COUNT(*) AS c FROM match_votes WHERE match_id = ? GROUP BY pick`,
        [matchId],
      );
      const t = emptyTotals();
      for (const row of r.rows) {
        const c = Number(row.c) || 0;
        if (row.pick === 'home') t.home = c;
        else if (row.pick === 'draw') t.draw = c;
        else if (row.pick === 'away') t.away = c;
      }
      t.total = t.home + t.draw + t.away;
      return t;
    } catch (e) {
      console.warn('[votes-store] getVoteTotals failed:', e);
    }
  }
  const t = emptyTotals();
  for (const v of memory()) {
    if (v.matchId !== matchId) continue;
    t[v.pick]++;
    t.total++;
  }
  return t;
}

export async function getUserVote(matchId: string, voterId: string): Promise<VotePick | null> {
  if (hasDb()) {
    await ensureTable();
    try {
      const r = await query<{ pick: VotePick }>(
        `SELECT pick FROM match_votes WHERE match_id = ? AND voter_id = ? LIMIT 1`,
        [matchId, voterId],
      );
      return r.rows[0]?.pick ?? null;
    } catch (e) {
      console.warn('[votes-store] getUserVote failed:', e);
    }
  }
  const v = memory().find(m => m.matchId === matchId && m.voterId === voterId);
  return v?.pick ?? null;
}

export async function castVote(
  matchId: string,
  voterId: string,
  pick: VotePick,
): Promise<{ ok: boolean; reason?: string; totals: VoteTotals; pick: VotePick }> {
  const existing = await getUserVote(matchId, voterId);
  if (existing) {
    const totals = await getVoteTotals(matchId);
    return { ok: false, reason: 'already_voted', totals, pick: existing };
  }

  if (hasDb()) {
    await ensureTable();
    try {
      await query(
        `INSERT INTO match_votes (match_id, voter_id, pick) VALUES (?, ?, ?) ON CONFLICT (match_id, voter_id) DO NOTHING`,
        [matchId, voterId, pick],
      );
      const totals = await getVoteTotals(matchId);
      return { ok: true, totals, pick };
    } catch (e) {
      console.warn('[votes-store] castVote db failed, falling back to memory:', e);
    }
  }

  memory().push({ matchId, voterId, pick, ts: Date.now() });
  const totals = await getVoteTotals(matchId);
  return { ok: true, totals, pick };
}
