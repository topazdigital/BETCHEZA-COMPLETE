// DB-backed persistence for auto-generated tips.
// Provides MySQL CRUD on top of the in-memory store so tips survive
// server restarts and are shared across multiple Next.js workers.
// All functions silently degrade when DB_HOST is not configured.

import { getPool } from './db';
import type { GeneratedTip } from './auto-tips-store';

// ── Schema ────────────────────────────────────────────────────────────────────

export async function initAutoTipsTable(): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS auto_tips (
        id              VARCHAR(128)  NOT NULL PRIMARY KEY,
        tipster_id      INT           NOT NULL,
        match_id        VARCHAR(200)  NOT NULL,
        match_slug      VARCHAR(300)  DEFAULT NULL,
        home_team       VARCHAR(200)  NOT NULL,
        away_team       VARCHAR(200)  NOT NULL,
        league          VARCHAR(200)  DEFAULT NULL,
        sport           VARCHAR(100)  DEFAULT NULL,
        kickoff         DATETIME      DEFAULT NULL,
        market          VARCHAR(200)  NOT NULL,
        market_key      VARCHAR(100)  DEFAULT NULL,
        prediction      VARCHAR(200)  NOT NULL,
        odds            DECIMAL(8,2)  NOT NULL DEFAULT 2.00,
        stake           INT           NOT NULL DEFAULT 3,
        confidence      INT           NOT NULL DEFAULT 70,
        analysis        TEXT          DEFAULT NULL,
        is_premium      TINYINT(1)    NOT NULL DEFAULT 0,
        status          ENUM('pending','won','lost','void') NOT NULL DEFAULT 'pending',
        settled_by_prob TINYINT(1)    NOT NULL DEFAULT 0,
        likes           INT           NOT NULL DEFAULT 0,
        dislikes        INT           NOT NULL DEFAULT 0,
        comments        INT           NOT NULL DEFAULT 0,
        created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_match_id   (match_id),
        INDEX idx_tipster_id (tipster_id),
        INDEX idx_status     (status),
        INDEX idx_kickoff    (kickoff)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
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
    const [rows] = await pool.execute<Array<Record<string, unknown>>>(`SELECT * FROM auto_tips ORDER BY created_at DESC`);
    return (rows as Array<Record<string, unknown>>).map(rowToTip);
  } catch (e) {
    console.warn('[auto-tips-db] loadAllTipsFromDb failed:', e);
    return null;
  }
}

// ── Write ─────────────────────────────────────────────────────────────────────

// MySQL prepared statements cap at 65,535 placeholders.
// With 22 columns per row the safe batch ceiling is floor(65535/22) = 2978.
const UPSERT_BATCH = 2_000;

export async function upsertTipsToDb(tips: GeneratedTip[]): Promise<void> {
  const pool = getPool();
  if (!pool || tips.length === 0) return;

  for (let start = 0; start < tips.length; start += UPSERT_BATCH) {
    const batch = tips.slice(start, start + UPSERT_BATCH);
    try {
      const placeholders = batch.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
      const values: unknown[] = [];
      for (const t of batch) {
        values.push(
          t.id,
          t.tipsterId,
          t.matchId,
          t.matchSlug ?? null,
          t.homeTeam,
          t.awayTeam,
          t.league ?? null,
          t.sport ?? null,
          t.kickoff ? new Date(t.kickoff) : null,
          t.market,
          t.marketKey ?? null,
          t.prediction,
          t.odds,
          t.stake,
          t.confidence,
          t.analysis ?? null,
          t.isPremium ? 1 : 0,
          t.status,
          t.settledByProb ? 1 : 0,
          t.likes,
          t.dislikes,
          t.comments,
        );
      }
      await pool.execute(
        `INSERT INTO auto_tips
          (id,tipster_id,match_id,match_slug,home_team,away_team,league,sport,kickoff,
           market,market_key,prediction,odds,stake,confidence,analysis,is_premium,
           status,settled_by_prob,likes,dislikes,comments)
         VALUES ${placeholders}
         ON DUPLICATE KEY UPDATE
           status          = VALUES(status),
           settled_by_prob = VALUES(settled_by_prob),
           likes           = VALUES(likes),
           dislikes        = VALUES(dislikes),
           comments        = VALUES(comments),
           analysis        = VALUES(analysis),
           match_slug      = VALUES(match_slug)`,
        values,
      );
    } catch (e) {
      console.warn(`[auto-tips-db] upsertTipsToDb batch ${start}–${start + batch.length} failed:`, e);
    }
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
    await pool.execute(
      `UPDATE auto_tips SET status=?, settled_by_prob=? WHERE id=?`,
      [status, settledByProb ? 1 : 0, id],
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
