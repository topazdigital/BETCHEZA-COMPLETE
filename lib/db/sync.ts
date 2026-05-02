import { getPool, execute, queryOne } from '../db';
import type { UnifiedMatch } from '../api/unified-sports-api';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'unknown';
}

let firstFailure = true;
function logOnce(err: unknown) {
  if (firstFailure) {
    console.warn('[db-sync] write skipped:', err instanceof Error ? err.message : err);
    firstFailure = false;
  }
}

async function ensureSport(id: number, name: string, slug: string): Promise<number | null> {
  try {
    await execute(
      `INSERT IGNORE INTO sports (id, name, slug, icon, is_active)
       VALUES (?, ?, ?, ?, TRUE)`,
      [id, name, slug, slug]
    );
    return id;
  } catch (e) { logOnce(e); return null; }
}

async function ensureLeague(
  apiId: string,
  sportId: number,
  countryId: number,
  name: string
): Promise<number | null> {
  const slug = slugify(name);
  try {
    const existing = await queryOne<{ id: number }>(
      `SELECT id FROM leagues WHERE slug = ? OR (api_id = ? AND api_id IS NOT NULL) LIMIT 1`,
      [slug, apiId]
    );
    if (existing) return existing.id;
    const result = await execute(
      `INSERT INTO leagues (sport_id, country_id, name, slug, api_id, is_active)
       VALUES (?, ?, ?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE api_id = VALUES(api_id)`,
      [sportId, countryId, name, slug, apiId]
    );
    if (result.insertId) return result.insertId;
    const found = await queryOne<{ id: number }>(`SELECT id FROM leagues WHERE slug = ? LIMIT 1`, [slug]);
    return found?.id ?? null;
  } catch (e) { logOnce(e); return null; }
}

async function ensureCountry(name: string | undefined, code: string | undefined): Promise<number | null> {
  const country = name || 'World';
  const countryCode = (code || 'XX').toUpperCase().slice(0, 10);
  try {
    const existing = await queryOne<{ id: number }>(`SELECT id FROM countries WHERE code = ? LIMIT 1`, [countryCode]);
    if (existing) return existing.id;
    const result = await execute(
      `INSERT IGNORE INTO countries (name, code) VALUES (?, ?)`,
      [country, countryCode]
    );
    if (result.insertId) return result.insertId;
    const found = await queryOne<{ id: number }>(`SELECT id FROM countries WHERE code = ? LIMIT 1`, [countryCode]);
    return found?.id ?? null;
  } catch (e) { logOnce(e); return null; }
}

interface TeamPayload {
  apiId: string;
  name: string;
  shortName?: string;
  logo?: string;
  sportId: number;
  leagueId: number | null;
  countryId: number | null;
}

async function upsertTeam(t: TeamPayload): Promise<void> {
  const slug = slugify(t.name);
  try {
    const byApi = await queryOne<{ id: number }>(
      `SELECT id FROM teams WHERE api_id = ? AND api_id IS NOT NULL LIMIT 1`,
      [t.apiId]
    );
    if (byApi) {
      await execute(
        `UPDATE teams SET name = ?, logo_url = COALESCE(?, logo_url),
         short_name = COALESCE(?, short_name), league_id = COALESCE(?, league_id),
         country_id = COALESCE(?, country_id) WHERE id = ?`,
        [t.name, t.logo || null, t.shortName || null, t.leagueId, t.countryId, byApi.id]
      );
      return;
    }
    await execute(
      `INSERT INTO teams (sport_id, country_id, league_id, name, slug, short_name, logo_url, api_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         logo_url = COALESCE(VALUES(logo_url), logo_url),
         api_id   = COALESCE(VALUES(api_id), api_id),
         league_id = COALESCE(VALUES(league_id), league_id)`,
      [t.sportId, t.countryId, t.leagueId, t.name, slug, t.shortName || null, t.logo || null, t.apiId]
    );
  } catch (e) { logOnce(e); }
}

/**
 * Best-effort persistence of teams + leagues from a batch of matches.
 * Silently no-ops when no MySQL pool is configured.
 * Runs FULLY ASYNC — never blocks the caller, never throws.
 */
export function persistMatchEntities(matches: UnifiedMatch[]): void {
  if (!getPool()) return;
  (async () => {
    try {
      const seen = new Set<string>();
      for (const m of matches) {
        const sportSlug = m.sport.slug || slugify(m.sport.name);
        await ensureSport(m.sport.id, m.sport.name, sportSlug);

        const countryId = await ensureCountry(m.league.country, m.league.countryCode);

        const leagueApiId = `espn-${m.league.id}`;
        const leagueId = await ensureLeague(leagueApiId, m.sport.id, countryId || 1, m.league.name);

        for (const team of [m.homeTeam, m.awayTeam]) {
          if (!team?.id || team.name === 'TBD') continue;
          const key = `${team.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          await upsertTeam({
            apiId: String(team.id),
            name: team.name,
            shortName: team.shortName,
            logo: team.logo,
            sportId: m.sport.id,
            leagueId,
            countryId,
          });
        }
      }
    } catch (e) {
      logOnce(e);
    }
  })();
}
