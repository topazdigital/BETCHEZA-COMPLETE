import { query, getPool } from './db';

export interface FeaturedConfig {
  enabled: boolean;
  minConfidence: number;
  minOdds: number;
  maxOdds: number;
  topTipsterOnly: boolean;
  sport: string;
  pinnedMatchIds: string[];
  hiddenMatchIds: string[];
  limit: number;
  updatedAt: string;
}

export const DEFAULT_FEATURED_CONFIG: FeaturedConfig = {
  enabled: true,
  minConfidence: 60,
  minOdds: 1.5,
  maxOdds: 4.0,
  topTipsterOnly: false,
  sport: '',
  pinnedMatchIds: [],
  hiddenMatchIds: [],
  limit: 6,
  updatedAt: new Date().toISOString(),
};

const g = globalThis as { __featuredConfig?: FeaturedConfig };

function hasDb(): boolean {
  return !!getPool();
}

async function ensureTable(): Promise<void> {
  if (!hasDb()) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS featured_config (
        id INT NOT NULL DEFAULT 1 PRIMARY KEY,
        config_json TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
  } catch (e) {
    console.warn('[featured-store] ensureTable failed:', e);
  }
}

export async function getFeaturedConfig(): Promise<FeaturedConfig> {
  if (g.__featuredConfig) return g.__featuredConfig;
  if (hasDb()) {
    await ensureTable();
    try {
      const r = await query<{ config_json: string }>(
        `SELECT config_json FROM featured_config WHERE id = 1`
      );
      if (r.rows[0]?.config_json) {
        try {
          const parsed = JSON.parse(r.rows[0].config_json) as Partial<FeaturedConfig>;
          const merged: FeaturedConfig = { ...DEFAULT_FEATURED_CONFIG, ...parsed };
          g.__featuredConfig = merged;
          return merged;
        } catch {}
      }
    } catch (e) {
      console.warn('[featured-store] read failed:', e);
    }
  }
  g.__featuredConfig = { ...DEFAULT_FEATURED_CONFIG };
  return g.__featuredConfig;
}

export async function saveFeaturedConfig(patch: Partial<FeaturedConfig>): Promise<FeaturedConfig> {
  const current = await getFeaturedConfig();
  const next: FeaturedConfig = {
    ...current,
    ...patch,
    pinnedMatchIds: Array.isArray(patch.pinnedMatchIds) ? patch.pinnedMatchIds : current.pinnedMatchIds,
    hiddenMatchIds: Array.isArray(patch.hiddenMatchIds) ? patch.hiddenMatchIds : current.hiddenMatchIds,
    updatedAt: new Date().toISOString(),
  };
  g.__featuredConfig = next;
  if (hasDb()) {
    await ensureTable();
    try {
      await query(
        `INSERT INTO featured_config (id, config_json) VALUES (1, ?)
         ON DUPLICATE KEY UPDATE config_json = VALUES(config_json)`,
        [JSON.stringify(next)]
      );
    } catch (e) {
      console.warn('[featured-store] write failed:', e);
    }
  }
  return next;
}

export function invalidateFeaturedConfigCache(): void {
  delete g.__featuredConfig;
}
