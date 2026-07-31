// ============================================================
// camel1.tv — HTML/RSC scraper (no API key required)
// Camel Live uses TheSports as their data backend.
// We parse the server-rendered RSC payload from the homepage
// to extract hotTeamMatches → hottest featured matches
// and the full schedule from the faceoff sidebar.
// Gives ~20-60 fresh top matches per fetch with team logos.
// ============================================================

import type { UnifiedMatch } from './unified-sports-api';

const CAMEL_BASE = 'https://camel1.tv/en';
const CAMEL_URL = CAMEL_BASE;
const CAMEL_FOOTBALL_URL = `${CAMEL_BASE}/football`;
const CACHE_MS = 10 * 60 * 1000;

// All sport pages available on camel1.tv
// NOTE: sportId must match lib/sports-data.ts ALL_SPORTS ids:
//   1=Football, 2=Basketball, 3=Tennis, 6=Baseball, 7=Ice Hockey, 12=Rugby, 14=Volleyball, 24=Handball
const CAMEL_SPORT_PAGES: Array<{ url: string; sportId: number; sportKey: string; sportName: string; icon: string }> = [
  { url: `${CAMEL_BASE}/basketball`, sportId: 2,  sportKey: 'basketball', sportName: 'Basketball',       icon: '🏀' },
  { url: `${CAMEL_BASE}/tennis`,     sportId: 3,  sportKey: 'tennis',     sportName: 'Tennis',           icon: '🎾' },
  { url: `${CAMEL_BASE}/baseball`,   sportId: 6,  sportKey: 'baseball',   sportName: 'Baseball',         icon: '⚾' },
  { url: `${CAMEL_BASE}/ice-hockey`, sportId: 7,  sportKey: 'hockey',     sportName: 'Ice Hockey',       icon: '🏒' },
  { url: `${CAMEL_BASE}/volleyball`, sportId: 14, sportKey: 'volleyball', sportName: 'Volleyball',       icon: '🏐' },
  { url: `${CAMEL_BASE}/rugby`,      sportId: 12, sportKey: 'rugby',      sportName: 'Rugby',            icon: '🏉' },
  { url: `${CAMEL_BASE}/american-football`, sportId: 5, sportKey: 'americanfootball', sportName: 'American Football', icon: '🏈' },
  { url: `${CAMEL_BASE}/handball`,   sportId: 24, sportKey: 'handball',   sportName: 'Handball',         icon: '🤾' },
];
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
  // Optional timing fields present in some payloads
  timer?: number | null;
  minute?: number | null;
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
    case 5: return 'live';       // extra time
    case 6: return 'live';       // penalties
    case 7: return 'postponed';
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

interface SportMeta { sportId: number; sportKey: string; sportName: string; icon: string }
const SOCCER_META: SportMeta = { sportId: 1, sportKey: 'soccer', sportName: 'Football', icon: '⚽' };

function mapHotMatch(m: CamelMatch, sport: SportMeta = SOCCER_META): UnifiedMatch | null {
  if (!m.home_team?.name || !m.away_team?.name) return null;
  const comp = m.competition?.name_en || m.competition?.name || 'Unknown';
  const leagueId = leagueIdFromName(comp);
  const kickoff = new Date(m.match_time * 1000);
  const hs = scoreFromArr(m.home_scores);
  const as_ = scoreFromArr(m.away_scores);
  const status = statusFromId(m.status_id);
  const minute: number | undefined =
    typeof m.minute === 'number' ? m.minute :
    typeof m.timer === 'number' ? Math.floor(m.timer / 60) :
    undefined;
  return {
    id: `camel1_${m.id}`,
    externalId: m.id,
    source: 'sportsdata-io',
    sportId: sport.sportId,
    sportKey: sport.sportKey,
    leagueId,
    leagueKey: `camel1_${leagueId}`,
    homeTeam: {
      id: `camel1_h_${m.id}`,
      name: m.home_team.name_en || m.home_team.name,
      shortName: (m.home_team.name_en || m.home_team.name).slice(0, 50),
      logo: m.home_team.logo || undefined,
    },
    awayTeam: {
      id: `camel1_a_${m.id}`,
      name: m.away_team.name_en || m.away_team.name,
      shortName: (m.away_team.name_en || m.away_team.name).slice(0, 50),
      logo: m.away_team.logo || undefined,
    },
    kickoffTime: kickoff,
    status,
    homeScore: hs,
    awayScore: as_,
    minute: status === 'live' && minute !== undefined ? minute : undefined,
    league: {
      id: leagueId,
      name: comp,
      slug: comp.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      country: 'International',
      countryCode: 'INT',
      tier: 2,
    },
    sport: { id: sport.sportId, name: sport.sportName, slug: sport.sportKey, icon: sport.icon },
    tipsCount: 0,
  };
}

function mapFaceoff(f: FaceoffMatch, sport: SportMeta = SOCCER_META): UnifiedMatch | null {
  if (!f.homeTeam || !f.awayTeam) return null;
  const comp = f.competitionName || 'Unknown';
  const leagueId = leagueIdFromName(comp);
  const kickoff = new Date(f.matchTime);
  return {
    id: `camel1f_${f.faceoffId}`,
    externalId: f.faceoffId,
    source: 'sportsdata-io',
    sportId: sport.sportId,
    sportKey: sport.sportKey,
    leagueId,
    leagueKey: `camel1_${leagueId}`,
    homeTeam: {
      id: `camel1f_h_${f.faceoffId}`,
      name: f.homeTeam,
      shortName: f.homeTeam.slice(0, 50),
    },
    awayTeam: {
      id: `camel1f_a_${f.faceoffId}`,
      name: f.awayTeam,
      shortName: f.awayTeam.slice(0, 50),
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
    sport: { id: sport.sportId, name: sport.sportName, slug: sport.sportKey, icon: sport.icon },
    tipsCount: 0,
  };
}

/**
 * Extract a JSON array from a decoded RSC string given a field name.
 * Handles nested brackets/braces for robustness.
 */
function extractJsonArray(decoded: string, fieldName: string): unknown[] | null {
  const idx = decoded.indexOf(`"${fieldName}":`)
  if (idx < 0) return null;
  const start = decoded.indexOf('[', idx)
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < Math.min(start + 600000, decoded.length); i++) {
    const ch = decoded[i]
    if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(decoded.slice(start, i + 1)) as unknown[];
        } catch { return null; }
      }
    }
  }
  return null;
}

function parseRSC(html: string, sport: SportMeta = SOCCER_META): UnifiedMatch[] {
  const out: UnifiedMatch[] = [];

  // Extract all RSC push payloads (standard Next.js streaming format)
  const pushRegex = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let m: RegExpExecArray | null;
  const payloads: string[] = [];
  while ((m = pushRegex.exec(html)) !== null) {
    payloads.push(m[1]);
  }

  // Also try the inline script payload format used on newer Next.js versions
  const inlineRegex = /\\"hotTeamMatches\\":|"hotTeamMatches":|"matchList":|"liveMatches":/g;
  if (payloads.length === 0 && inlineRegex.test(html)) {
    payloads.push(html);
  }

  const seenIds = new Set<string>();

  for (const raw of payloads) {
    let decoded: string;
    try {
      decoded = JSON.parse(`"${raw}"`);
    } catch {
      decoded = raw.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }

    // --- hotTeamMatches ---
    const hotArr = extractJsonArray(decoded, 'hotTeamMatches');
    if (hotArr) {
      for (const match of hotArr as CamelMatch[]) {
        if (!match?.id || seenIds.has(String(match.id))) continue;
        const u = mapHotMatch(match, sport);
        if (u) { seenIds.add(String(match.id)); out.push(u); }
      }
    }

    // --- matchList (alternative field name used in some pages) ---
    const listArr = extractJsonArray(decoded, 'matchList');
    if (listArr) {
      for (const match of listArr as CamelMatch[]) {
        if (!match?.id || seenIds.has(String(match.id))) continue;
        const u = mapHotMatch(match, sport);
        if (u) { seenIds.add(String(match.id)); out.push(u); }
      }
    }

    // --- liveMatches ---
    const liveArr = extractJsonArray(decoded, 'liveMatches');
    if (liveArr) {
      for (const match of liveArr as CamelMatch[]) {
        if (!match?.id || seenIds.has(String(match.id))) continue;
        const u = mapHotMatch(match, sport);
        if (u) { seenIds.add(String(match.id)); out.push(u); }
      }
    }

    // --- faceoffMatches ---
    const faceArr = extractJsonArray(decoded, 'faceoffMatches');
    if (faceArr) {
      for (const f of faceArr as FaceoffMatch[]) {
        if (!f?.faceoffId || seenIds.has(String(f.faceoffId))) continue;
        const u = mapFaceoff(f, sport);
        if (u) { seenIds.add(String(f.faceoffId)); out.push(u); }
      }
    }
  }

  return out;
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function fetchCamel1Matches(): Promise<UnifiedMatch[]> {
  if (process.env.DISABLE_CAMEL1 === 'true') return [];
  if (cache && cache.expires > Date.now()) return cache.data;

  try {
    // Fetch homepage, football page, and all other sport pages in parallel
    const pagesToFetch: Array<{ url: string; sport: SportMeta }> = [
      { url: CAMEL_URL, sport: SOCCER_META },
      { url: CAMEL_FOOTBALL_URL, sport: SOCCER_META },
      ...CAMEL_SPORT_PAGES.map(p => ({
        url: p.url,
        sport: { sportId: p.sportId, sportKey: p.sportKey, sportName: p.sportName, icon: p.icon },
      })),
    ];

    const results = await Promise.allSettled(
      pagesToFetch.map(p => fetchPage(p.url))
    );

    const seenIds = new Set<string>();
    const allMatches: UnifiedMatch[] = [];

    const addAll = (matches: UnifiedMatch[]) => {
      for (const m of matches) {
        if (!seenIds.has(m.id)) {
          seenIds.add(m.id);
          allMatches.push(m);
        }
      }
    };

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        addAll(parseRSC(result.value, pagesToFetch[i].sport));
      }
    }

    console.log(`[camel1] fetched ${allMatches.length} matches from ${results.filter(r => r.status === 'fulfilled').length}/${pagesToFetch.length} pages`);
    cache = { data: allMatches, expires: Date.now() + CACHE_MS };
    return allMatches;
  } catch {
    cache = { data: [], expires: Date.now() + CACHE_MS };
    return [];
  }
}
