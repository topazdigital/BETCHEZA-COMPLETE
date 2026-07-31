import { NextRequest, NextResponse } from 'next/server';

// Player-only search — backs the Compare Players picker so users get athletes,
// not teams. We hit ESPN's public site search v2 endpoint and filter to
// athlete results.
//
// ESPN endpoint shape (public, no key):
//   https://site.web.api.espn.com/apis/search/v2?query=mbappe&type=player&limit=10
// Note: the older /apis/common/v3/search endpoint returns empty results,
// so v2 is the canonical search to use here.

export const dynamic = 'force-dynamic';
export const revalidate = 30;
export const runtime = 'nodejs';

interface EspnContent {
  uid?: string;
  id?: string;
  type?: string;
  displayName?: string;
  name?: string;
  shortName?: string;
  description?: string;
  subtitle?: string;
  defaultLeagueSlug?: string;
  sport?: string;
  defaultLeague?: { name?: string };
  defaultTeam?: { displayName?: string; logo?: string; logos?: { href?: string }[] };
  position?: { displayName?: string; abbreviation?: string };
  image?: { default?: string; href?: string };
  link?: { web?: string | { href?: string } };
}

interface EspnSearchResult {
  type?: string;
  contents?: EspnContent[];
}

interface EspnSearchResponse {
  results?: EspnSearchResult[];
}

interface PlayerHit {
  id: string;
  name: string;
  position?: string;
  team?: string;
  teamLogo?: string;
  headshot?: string;
  href: string;
  league?: string;
}

// Extract the numeric ESPN athlete id from any of the available fields.
// ESPN uses several shapes:
//   uid:  "s:600~a:231388"      → "231388"
//   link: "https://www.espn.com/soccer/player/_/id/231388/kylian-mbappe"
//   id:   GUID like "61edbcca-..."  → not usable for our routes
// We prefer uid → link → numeric id.
function extractAthleteId(c: EspnContent): string | null {
  const uid = c.uid || '';
  const aMatch = uid.match(/~a:(\d+)/);
  if (aMatch) return aMatch[1];
  const linkHref = typeof c.link?.web === 'string' ? c.link.web : c.link?.web?.href;
  if (linkHref) {
    const lm = linkHref.match(/\/id\/(\d+)/);
    if (lm) return lm[1];
  }
  if (c.id && /^\d+$/.test(String(c.id))) return String(c.id);
  return null;
}

// Headshot CDN guess — ESPN exposes athlete headshots at a predictable URL.
function headshotForId(id: string, sport?: string): string {
  // Soccer headshots live under i/headshots/soccer/players/full
  const s = (sport || 'soccer').toLowerCase();
  return `https://a.espncdn.com/i/headshots/${s}/players/full/${id}.png`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const limit = Math.min(20, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10));

  if (q.length < 2) {
    return NextResponse.json({ q, hits: [] as PlayerHit[] });
  }

  // v2 search returns athletes mixed with articles/clips — we filter to
  // results.type === "player" and pick the athlete entries from .contents.
  const url = `https://site.web.api.espn.com/apis/search/v2?query=${encodeURIComponent(q)}&type=player&limit=${limit * 2}`;

  let payload: EspnSearchResponse | null = null;
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Betcheza/1.0; +https://betcheza.com)',
        Accept: 'application/json',
      },
      next: { revalidate: 30 },
    });
    if (r.ok) payload = (await r.json()) as EspnSearchResponse;
  } catch (err) {
    console.warn('[players/search] ESPN fetch failed:', (err as Error).message);
  }

  const hits: PlayerHit[] = [];
  const seen = new Set<string>();

  for (const result of payload?.results || []) {
    const tag = (result.type || '').toLowerCase();
    if (tag && tag !== 'player' && tag !== 'athlete') continue;
    for (const c of result.contents || []) {
      const id = extractAthleteId(c);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const name = c.displayName || c.name || c.shortName;
      if (!name) continue;
      hits.push({
        id,
        name,
        position: c.position?.displayName || c.position?.abbreviation,
        team: c.subtitle || c.defaultTeam?.displayName,
        teamLogo: c.defaultTeam?.logo || c.defaultTeam?.logos?.[0]?.href,
        headshot: c.image?.default || c.image?.href || headshotForId(id, c.sport),
        href: `/players/${id}`,
        league: c.description || c.defaultLeague?.name,
      });
      if (hits.length >= limit) break;
    }
    if (hits.length >= limit) break;
  }

  return NextResponse.json({ q, hits });
}
