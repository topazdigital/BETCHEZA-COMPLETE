/**
 * Sport-aware live status label.
 *
 * - Soccer / football / rugby use minute counters (e.g. "67'").
 * - Halftime / extra time / penalty shootout get explicit labels.
 * - Sports where ESPN's `minute` field really means "current period"
 *   are translated to human-friendly period labels (Q1 / Set 3 / Inn 5 / Rd 4 / P2).
 *
 * Used by both match cards and the match detail hero so the live indicator
 * looks identical everywhere. `minute` may be undefined when the API has
 * not yet exposed a period — in that case we fall back to a plain "LIVE".
 */
export function liveStatusLabel(sportSlug: string, status: string, minute?: number): string {
  if (status === 'halftime') return 'HT';
  if (status === 'extra_time') return minute && minute > 90 ? `${minute}'` : 'ET';
  if (status === 'penalties') return 'PEN';
  if (minute !== undefined && minute !== null && minute <= 45 && status !== 'live') return 'HT';
  const m = minute ?? 0;
  switch (sportSlug) {
    case 'basketball':
    case 'american-football':
      return m > 0 ? `Q${Math.min(m, 4)}` : 'LIVE';
    case 'tennis':
      return m > 0 ? `Set ${m}` : 'LIVE';
    case 'baseball':
      return m > 0 ? `Inn ${m}` : 'LIVE';
    case 'ice-hockey':
    case 'hockey':
      return m > 0 ? `P${Math.min(m, 3)}` : 'LIVE';
    case 'mma':
    case 'boxing':
      return m > 0 ? `Rd ${m}` : 'LIVE';
    case 'cricket':
      return m > 0 ? `Inn ${m}` : 'LIVE';
    case 'volleyball':
    case 'table-tennis':
      return m > 0 ? `Set ${m}` : 'LIVE';
    case 'rugby':
      return m > 0 ? `${m}'` : 'LIVE';
    default:
      // soccer / football / generic
      return m > 0 ? `${m}'` : 'LIVE';
  }
}

/**
 * Should this sport use a soccer-style ticking minute counter on the
 * match detail hero? For these sports we trust the kickoff time + a
 * setInterval to keep the displayed minute fresh between API polls.
 */
export function isMinuteTickingSport(sportSlug: string): boolean {
  return (
    sportSlug === 'soccer' ||
    sportSlug === 'football' ||
    sportSlug === 'rugby'
  );
}
