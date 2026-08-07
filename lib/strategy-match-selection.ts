/**
 * Select real fixtures for the daily strategy.
 *
 * Match feeds are not guaranteed to be sorted by kickoff time and can contain
 * stale finished events. Keep the strategy generator independent of provider
 * ordering so it never recommends a match that has already started and does
 * not over-select the first (usually early) fixtures in the feed.
 */

export const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

export interface StrategyMatchCandidate {
  homeTeam: { name: string };
  awayTeam: { name: string };
  league: { name: string };
  sport?: { slug?: string };
  kickoffTime: Date | string;
  status?: string | null;
}

export interface StrategyMatchSelectionOptions {
  maxMatches?: number;
  now?: Date;
  seed?: number;
  excludeMatches?: string[];
}

export function toEATDateStr(date: Date): string {
  return new Date(date.getTime() + EAT_OFFSET_MS).toISOString().slice(0, 10);
}

export function normalizeStrategyTeamName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function strategyMatchKey(homeTeam: string, awayTeam: string): string {
  return `${normalizeStrategyTeamName(homeTeam)}|${normalizeStrategyTeamName(awayTeam)}`;
}

/**
 * Return a balanced, rotated pool of future fixtures for one EAT calendar day.
 *
 * Rotation is intentional: repeated regeneration should not keep selecting the
 * same provider-ordered fixtures. The caller can also exclude the currently
 * displayed picks; if that would leave no alternatives, it should retry without
 * exclusions rather than fail unnecessarily.
 */
export function selectStrategyMatchPool<T extends StrategyMatchCandidate>(
  matches: T[],
  targetDateEAT: string,
  options: StrategyMatchSelectionOptions = {},
): T[] {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const maxMatches = Math.max(1, options.maxMatches ?? 30);
  const excluded = new Set(options.excludeMatches ?? []);

  const eligible = matches.filter((match) => {
    const kickoffMs = new Date(match.kickoffTime).getTime();
    if (!Number.isFinite(kickoffMs)) return false;
    if (toEATDateStr(new Date(kickoffMs)) !== targetDateEAT) return false;

    const sport = match.sport?.slug?.toLowerCase();
    if (sport && sport !== 'soccer' && sport !== 'football') return false;

    const status = (match.status || '').toLowerCase();
    if (['finished', 'live', 'halftime', 'postponed', 'cancelled', 'extra_time', 'penalties'].includes(status)) {
      return false;
    }

    // A future day's fixtures are all valid. For today, kickoff time is the
    // source of truth because stale feeds often leave status as "scheduled".
    if (kickoffMs <= nowMs) return false;

    const key = strategyMatchKey(match.homeTeam.name, match.awayTeam.name);
    return !excluded.has(key);
  });

  // De-duplicate provider collisions before spreading fixtures across time.
  const unique = new Map<string, T>();
  for (const match of eligible) {
    const key = strategyMatchKey(match.homeTeam.name, match.awayTeam.name);
    const existing = unique.get(key);
    if (!existing || new Date(match.kickoffTime).getTime() < new Date(existing.kickoffTime).getTime()) {
      unique.set(key, match);
    }
  }

  const buckets: T[][] = [[], [], []]; // morning, afternoon, evening/night
  for (const match of unique.values()) {
    const eatHour = new Date(new Date(match.kickoffTime).getTime() + EAT_OFFSET_MS).getUTCHours();
    const bucket = eatHour < 12 ? 0 : eatHour < 18 ? 1 : 2;
    buckets[bucket].push(match);
  }
  for (const bucket of buckets) {
    bucket.sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime());
  }

  const seed = Math.abs(Math.trunc(options.seed ?? Date.now()));
  // Rotate each time bucket so regeneration does not always start at its
  // earliest fixture, while round-robin still preserves broad time coverage.
  const rotated = buckets.map((bucket, bucketIndex) => {
    if (bucket.length < 2) return bucket;
    const offset = (seed + bucketIndex * 7) % bucket.length;
    return [...bucket.slice(offset), ...bucket.slice(0, offset)];
  });

  const selected: T[] = [];
  let round = 0;
  while (selected.length < maxMatches && selected.length < unique.size) {
    let added = false;
    const startBucket = (seed + round) % rotated.length;
    for (let step = 0; step < rotated.length && selected.length < maxMatches; step++) {
      const bucket = rotated[(startBucket + step) % rotated.length];
      const match = bucket[round];
      if (match) {
        selected.push(match);
        added = true;
      }
    }
    if (!added) break;
    round += 1;
  }

  return selected;
}