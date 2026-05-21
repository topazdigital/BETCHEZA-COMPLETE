// DB-backed persistence for auto-generated tips.
// Provides PostgreSQL CRUD on top of the in-memory store so tips survive
// server restarts and are shared across multiple Next.js workers.
// All functions silently degrade when DATABASE_URL is not configured.

import { query, getPool } from './db';
import type { GeneratedTip } from './auto-tips-store';

// ── Schema ────────────────────────────────────────────────────────────────────

export async function initAutoTipsTable(): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS auto_tips (
        id              VARCHAR(128)  NOT NULL PRIMARY KEY,
        tipster_id      INT           NOT NULL,
        match_id        VARCHAR(200)  NOT NULL,
        match_slug      VARCHAR(300)  DEFAULT NULL,
        home_team       VARCHAR(200)  NOT NULL,
        away_team       VARCHAR(200)  NOT NULL,
        league          VARCHAR(200)  DEFAULT NULL,
        sport           VARCHAR(100)  DEFAULT NULL,
        kickoff         TIMESTAMP     DEFAULT NULL,
        market          VARCHAR(200)  NOT NULL,
        market_key      VARCHAR(100)  DEFAULT NULL,
        prediction      VARCHAR(200)  NOT NULL,
        odds            DECIMAL(8,2)  NOT NULL DEFAULT 2.00,
        stake           INT           NOT NULL DEFAULT 3,
        confidence      INT           NOT NULL DEFAULT 70,
        analysis        TEXT          DEFAULT NULL,
        is_premium      BOOLEAN       NOT NULL DEFAULT FALSE,
        status          VARCHAR(20)   NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','won','lost','void')),
        settled_by_prob BOOLEAN       NOT NULL DEFAULT FALSE,
        likes           INT           NOT NULL DEFAULT 0,
        dislikes        INT           NOT NULL DEFAULT 0,
        comments        INT           NOT NULL DEFAULT 0,
        created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_auto_tips_match_id ON auto_tips(match_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_auto_tips_tipster_id ON auto_tips(tipster_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_auto_tips_status ON auto_tips(status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_auto_tips_kickoff ON auto_tips(kickoff)`);
    return true;
  } catch (e) {
    console.warn('[auto-tips-db] initAutoTipsTable failed:', e);
    return false;
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function loadAllTipsFromDb(): Promise<GeneratedTip[] | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    const result = await query<Record<string, unknown>>(`SELECT * FROM auto_tips ORDER BY created_at DESC`);
    return result.rows.map(rowToTip);
  } catch (e) {
    console.warn('[auto-tips-db] loadAllTipsFromDb failed:', e);
    return null;
  }
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function upsertTipsToDb(tips: GeneratedTip[]): Promise<void> {
  const pool = getPool();
  if (!pool || tips.length === 0) return;
  try {
    for (const t of tips) {
      await query(
        `INSERT INTO auto_tips
          (id,tipster_id,match_id,match_slug,home_team,away_team,league,sport,kickoff,
           market,market_key,prediction,odds,stake,confidence,analysis,is_premium,
           status,settled_by_prob,likes,dislikes,comments)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT (id) DO UPDATE SET
           status          = EXCLUDED.status,
           settled_by_prob = EXCLUDED.settled_by_prob,
           likes           = EXCLUDED.likes,
           dislikes        = EXCLUDED.dislikes,
           comments        = EXCLUDED.comments,
           analysis        = EXCLUDED.analysis,
           match_slug      = EXCLUDED.match_slug`,
        [
          t.id, t.tipsterId, t.matchId, t.matchSlug ?? null,
          t.homeTeam, t.awayTeam, t.league ?? null, t.sport ?? null,
          t.kickoff ? new Date(t.kickoff) : null,
          t.market, t.marketKey ?? null, t.prediction,
          t.odds, t.stake, t.confidence, t.analysis ?? null,
          t.isPremium, t.status, t.settledByProb,
          t.likes, t.dislikes, t.comments,
        ],
      );
    }
  } catch (e) {
    console.warn('[auto-tips-db] upsertTipsToDb failed:', e);
  }
}

export async function updateTipStatusInDb(
  id: string,
  status: GeneratedTip['status'],
  settledByProb: boolean,
): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  try {
    await query(
      `UPDATE auto_tips SET status=?, settled_by_prob=? WHERE id=?`,
      [status, settledByProb, id],
    );
  } catch (e) {
    console.warn('[auto-tips-db] updateTipStatusInDb failed:', e);
  }
}

export async function bulkUpdateStatusInDb(
  updates: Array<{ id: string; status: GeneratedTip['status']; settledByProb: boolean }>,
): Promise<void> {
  const pool = getPool();
  if (!pool || updates.length === 0) return;
  try {
    await Promise.all(updates.map(u => updateTipStatusInDb(u.id, u.status, u.settledByProb)));
  } catch (e) {
    console.warn('[auto-tips-db] bulkUpdateStatusInDb failed:', e);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToTip(row: Record<string, unknown>): GeneratedTip {
  return {
    id:             String(row.id),
    tipsterId:      Number(row.tipster_id),
    matchId:        String(row.match_id),
    matchSlug:      row.match_slug ? String(row.match_slug) : undefined,
    homeTeam:       String(row.home_team),
    awayTeam:       String(row.away_team),
    league:         row.league ? String(row.league) : undefined,
    sport:          row.sport ? String(row.sport) : undefined,
    kickoff:        row.kickoff ? new Date(row.kickoff as string).toISOString() : undefined,
    market:         String(row.market),
    marketKey:      row.market_key ? String(row.market_key) : undefined,
    prediction:     String(row.prediction),
    odds:           Number(row.odds),
    stake:          Number(row.stake),
    confidence:     Number(row.confidence),
    analysis:       String(row.analysis ?? ''),
    isPremium:      Boolean(row.is_premium),
    status:         String(row.status) as GeneratedTip['status'],
    settledByProb:  Boolean(row.settled_by_prob),
    likes:          Number(row.likes),
    dislikes:       Number(row.dislikes),
    comments:       Number(row.comments),
    createdAt:      row.created_at ? new Date(row.created_at as string).toISOString() : new Date().toISOString(),
  };
}
