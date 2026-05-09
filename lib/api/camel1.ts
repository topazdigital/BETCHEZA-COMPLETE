// ============================================================
// camel1.tv — HTML/RSC scraper (no API key required)
// Camel Live uses TheSports as their data backend.
// We parse the server-rendered RSC payload from the homepage
// to extract hotTeamMatches → hottest featured matches
// and the full schedule from the faceoff sidebar.
// Gives ~20-60 fresh top matches per fetch with team logos.
// ============================================================

import type { UnifiedMatch } from './unified-sports-api';

const CAMEL_URL = 'https://camel1.tv/en';
const CACHE_MS = 10 * 60 * 1000;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface CamelTeam {
  name: string;
  name_en: string;
  logo: string;
  country_logo: string;
}

interface CamelMatch {
  id: string;
  match_time: number;
  status_id: number;
  home_scores: number[];
  away_scores: number[];
  competition: { name: string; name_en: string };
  home_team: CamelTeam;
  away_team: CamelTeam;
}

interface FaceoffMatch {
  faceoffId: string;
  matchTime: number;
  homeTeam: string;
  awayTeam: string;
  competitionName: string;
}

let cache: { data: UnifiedMatch[]; expires: number } | null = null;

function statusFromId(id: number): UnifiedMatch['status'] {
  switch (id) {
    case 1: return 'scheduled';
    case 2: return 'live';
    case 3: return 'halftime';
    case 4: return 'finished';
    case 8: return 'cancelled';
    default: return 'scheduled';
  }
}

function scoreFromArr(arr: number[]): number | null {
  if (!arr || arr.length === 0) return null;
  const s = arr[0];
  return typeof s === 'number' ? s : null;
}

function leagueIdFromName(name: string): number {
  // Hash the competition name into the 9000-9999 range (camel1 namespace)
  let h = 9000;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 1000;
  return 9000 + h;
}

function mapHotMatch(m: CamelMatch): UnifiedMatch | null {
  if (!m.home_team?.name || !m.away_team?.name) return null;
  const comp = m.competition?.name_en || m.competition?.name || 'Unknown';
  const leagueId = leagueIdFromName(comp);
  const kickoff = new Date(m.match_time * 1000);
  const hs = scoreFromArr(m.home_scores);
  const as_ = scoreFromArr(m.away_scores);
  return {
    id: `camel1_${m.id}`,
    externalId: m.id,
    source: 'sportsdata-io',
    sportId: 1,
    sportKey: 'soccer',
    leagueId,
    leagueKey: `camel1_${leagueId}`,
    homeTeam: {
      id: `camel1_h_${m.id}`,
      name: m.home_team.name_en || m.home_team.name,
      shortName: m.home_team.name_en || m.home_team.name,
      logo: m.home_team.logo || undefined,
    },
    awayTeam: {
      id: `camel1_a_${m.id}`,
      name: m.away_team.name_en || m.away_team.name,
      shortName: m.away_team.name_en || m.away_team.name,
      logo: m.away_team.logo || undefined,
    },
    kickoffTime: kickoff,
    status: statusFromId(m.status_id),
    homeScore: hs,
    awayScore: as_,
    league: {
      id: leagueId,
      name: comp,
      slug: comp.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      country: 'International',
      countryCode: 'INT',
      tier: 2,
    },
    sport: { id: 1, name: 'Football', slug: 'soccer', icon: '⚽' },
    tipsCount: 0,
  };
}

function mapFaceoff(f: FaceoffMatch): UnifiedMatch | null {
  if (!f.homeTeam || !f.awayTeam) return null;
  const comp = f.competitionName || 'Unknown';
  const leagueId = leagueIdFromName(comp);
  const kickoff = new Date(f.matchTime);
  return {
    id: `camel1f_${f.faceoffId}`,
    externalId: f.faceoffId,
    source: 'sportsdata-io',
    sportId: 1,
    sportKey: 'soccer',
    leagueId,
    leagueKey: `camel1_${leagueId}`,
    homeTeam: {
      id: `camel1f_h_${f.faceoffId}`,
      name: f.homeTeam,
      shortName: f.homeTeam,
    },
    awayTeam: {
      id: `camel1f_a_${f.faceoffId}`,
      name: f.awayTeam,
      shortName: f.awayTeam,
    },
    kickoffTime: kickoff,
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    league: {
      id: leagueId,
      name: comp,
      slug: comp.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      country: 'International',
      countryCode: 'INT',
      tier: 2,
    },
    sport: { id: 1, name: 'Football', slug: 'soccer', icon: '⚽' },
    tipsCount: 0,
  };
}

function parseRSC(html: string): UnifiedMatch[] {
  const out: UnifiedMatch[] = [];

  // Extract all RSC push payloads
  const pushRegex = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let m: RegExpExecArray | null;
  const payloads: string[] = [];
  while ((m = pushRegex.exec(html)) !== null) {
    payloads.push(m[1]);
  }

  for (const raw of payloads) {
    let decoded: string;
    try {
      decoded = JSON.parse(`"${raw}"`);
    } catch {
      decoded = raw.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }

    // --- hotTeamMatches ---
    const hotIdx = decoded.indexOf('"hotTeamMatches":');
    if (hotIdx >= 0) {
      // Extract the JSON array
      let depth = 0;
      let start = decoded.indexOf('[', hotIdx);
      if (start >= 0) {
        let end = start;
        for (let i = start; i < Math.min(start + 500000, decoded.length); i++) {
          if (decoded[i] === '[' || decoded[i] === '{') depth++;
          else if (decoded[i] === ']' || decoded[i] === '}') {
            depth--;
            if (depth === 0) { end = i; break; }
          }
        }
        try {
          const arr = JSON.parse(decoded.slice(start, end + 1)) as CamelMatch[];
          for (const match of arr) {
            const u = mapHotMatch(match);
            if (u) out.push(u);
          }
        } catch { /* ignore parse errors */ }
      }
    }

    // --- faceoffMatches ---
    const faceIdx = decoded.indexOf('"faceoffMatches":');
    if (faceIdx >= 0) {
      let depth = 0;
      let start = decoded.indexOf('[', faceIdx);
      if (start >= 0) {
        let end = start;
        for (let i = start; i < Math.min(start + 300000, decoded.length); i++) {
          if (decoded[i] === '[' || decoded[i] === '{') depth++;
          else if (decoded[i] === ']' || decoded[i] === '}') {
            depth--;
            if (depth === 0) { end = i; break; }
          }
        }
        try {
          const arr = JSON.parse(decoded.slice(start, end + 1)) as FaceoffMatch[];
          for (const f of arr) {
            const u = mapFaceoff(f);
            if (u) out.push(u);
          }
        } catch { /* ignore parse errors */ }
      }
    }
  }

  return out;
}

export async function fetchCamel1Matches(): Promise<UnifiedMatch[]> {
  if (process.env.DISABLE_CAMEL1 === 'true') return [];
  if (cache && cache.expires > Date.now()) return cache.data;

  try {
    const res = await fetch(CAMEL_URL, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      cache = { data: [], expires: Date.now() + CACHE_MS };
      return [];
    }

    const html = await res.text();
    const matches = parseRSC(html);

    cache = { data: matches, expires: Date.now() + CACHE_MS };
    return matches;
  } catch {
    cache = { data: [], expires: Date.now() + CACHE_MS };
    return [];
  }
}
