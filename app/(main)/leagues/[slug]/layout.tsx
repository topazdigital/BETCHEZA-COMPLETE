import type { Metadata } from 'next';
import { ALL_LEAGUES, ALL_SPORTS } from '@/lib/sports-data';
import { resolveLeagueSlug } from '@/lib/league-aliases';
import { pingIndexNow } from '@/lib/indexnow';

const SITE_NAME = 'Betcheza';
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';

const KNOWN_LEAGUE_SLUGS = new Set(ALL_LEAGUES.map(l => l.slug));

function detectSportFromSlug(slug: string): { name: string; slug: string; id: number } {
  const s = slug.toLowerCase();
  if (/atp|wta|grand.?slam|wimbledon|french.?open|us.?open|australian.?open|roland.?garros|challenger|itf|davis.?cup|fed.?cup|billie.?jean/.test(s)) {
    return { name: 'Tennis', slug: 'tennis', id: 3 };
  }
  if (/nba|euroleague|fiba|basketball|nbl|bbl|wnba|ncaa.?basketball|acb/.test(s)) {
    return { name: 'Basketball', slug: 'basketball', id: 2 };
  }
  if (/ipl|cricket|test.?match|odi|t20|big.?bash|hundred|psl|bbl.?cricket|cpl|wbbl|rpl/.test(s)) {
    return { name: 'Cricket', slug: 'cricket', id: 4 };
  }
  if (/six.?nations|super.?rugby|rugby.?union|rugby.?league|urc|gallagher|premiership.?rugby|nrl|state.?of.?origin/.test(s)) {
    return { name: 'Rugby', slug: 'rugby', id: 9 };
  }
  if (/nfl|nfc|afc|super.?bowl|american.?football|ncaa.?football/.test(s)) {
    return { name: 'American Football', slug: 'american-football', id: 5 };
  }
  if (/nhl|ice.?hockey|khl|ahl|shl|liiga/.test(s)) {
    return { name: 'Ice Hockey', slug: 'ice-hockey', id: 8 };
  }
  if (/mlb|baseball|npb|kbo/.test(s)) {
    return { name: 'Baseball', slug: 'baseball', id: 6 };
  }
  if (/ufc|mma|bellator|one.?championship|pfl|cage|fighting.?championship/.test(s)) {
    return { name: 'MMA', slug: 'mma', id: 17 };
  }
  if (/boxing|wbc|wbo|ibf|wba|wbo|ring.?magazine/.test(s)) {
    return { name: 'Boxing', slug: 'boxing', id: 18 };
  }
  if (/pga|lpga|golf|masters|open.?championship|ryder.?cup|presidents.?cup|dp.?world/.test(s)) {
    return { name: 'Golf', slug: 'golf', id: 19 };
  }
  if (/snooker|world.?snooker|ukopen|masters.?snooker/.test(s)) {
    return { name: 'Snooker', slug: 'snooker', id: 23 };
  }
  if (/darts|pdc|pdc.?world|premier.?league.?darts/.test(s)) {
    return { name: 'Darts', slug: 'darts', id: 24 };
  }
  if (/volleyball|fivb|vnl|beach.?volleyball/.test(s)) {
    return { name: 'Volleyball', slug: 'volleyball', id: 25 };
  }
  if (/handball|ehf|bundesliga.?handball/.test(s)) {
    return { name: 'Handball', slug: 'handball', id: 26 };
  }
  if (/table.?tennis|ittf|wtt|ping.?pong/.test(s)) {
    return { name: 'Table Tennis', slug: 'table-tennis', id: 20 };
  }
  if (/badminton|bwf/.test(s)) {
    return { name: 'Badminton', slug: 'badminton', id: 21 };
  }
  if (/cycling|tour.?de.?france|giro|vuelta|uci/.test(s)) {
    return { name: 'Cycling', slug: 'cycling', id: 28 };
  }
  if (/formula.?1|f1|motogp|indycar|nascar|motorsport/.test(s)) {
    return { name: 'Motorsport', slug: 'motorsport', id: 29 };
  }
  if (/esport|esports|counter.?strike|dota|league.?of.?legends|valorant|overwatch/.test(s)) {
    return { name: 'Esports', slug: 'esports', id: 30 };
  }
  return { name: 'Football', slug: 'football', id: 1 };
}

function slugToTitle(slug: string): string {
  return slug
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bAtp\b/g, 'ATP').replace(/\bWta\b/g, 'WTA')
    .replace(/\bNba\b/g, 'NBA').replace(/\bNfl\b/g, 'NFL')
    .replace(/\bNhl\b/g, 'NHL').replace(/\bMls\b/g, 'MLS')
    .replace(/\bUfc\b/g, 'UFC').replace(/\bMma\b/g, 'MMA')
    .replace(/\bIpl\b/g, 'IPL').replace(/\bT20\b/g, 'T20')
    .replace(/\bOdi\b/g, 'ODI').replace(/\bNrl\b/g, 'NRL')
    .replace(/\bUrc\b/g, 'URC').replace(/\bCaf\b/g, 'CAF')
    .replace(/\bUefa\b/g, 'UEFA').replace(/\bFifa\b/g, 'FIFA')
    .replace(/\bEfl\b/g, 'EFL').replace(/\bPga\b/g, 'PGA')
    .replace(/\bLpga\b/g, 'LPGA').replace(/\bNcaa\b/g, 'NCAA')
    .replace(/\bIttf\b/g, 'ITTF').replace(/\bBwf\b/g, 'BWF')
    .replace(/\bFivb\b/g, 'FIVB').replace(/\bEhf\b/g, 'EHF')
    .replace(/\bPdc\b/g, 'PDC').replace(/\bWbc\b/g, 'WBC')
    .replace(/\bWbo\b/g, 'WBO').replace(/\bIbf\b/g, 'IBF')
    .replace(/\bWba\b/g, 'WBA').replace(/\bKhl\b/g, 'KHL')
    .replace(/\bNpb\b/g, 'NPB').replace(/\bKbo\b/g, 'KBO')
    .replace(/\bWnba\b/g, 'WNBA').replace(/\bVnl\b/g, 'VNL')
    .replace(/\bUci\b/g, 'UCI').replace(/\bF1\b/, 'F1')
    .replace(/\bPsl\b/g, 'PSL').replace(/\bCpl\b/g, 'CPL');
}

async function fetchLeagueFromAPI(rawSlug: string): Promise<{
  name: string; country?: string; sportSlug?: string; sportName?: string;
} | null> {
  const base = process.env.INTERNAL_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(`${base}/api/matches`, {
      signal: ctrl.signal,
      next: { revalidate: 120 },
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const data = await r.json() as { matches?: Record<string, unknown>[] } | Record<string, unknown>[];
    const matches: Record<string, unknown>[] = Array.isArray(data) ? data : ((data as { matches?: Record<string, unknown>[] }).matches ?? []);
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const target = norm(rawSlug);
    const m = matches.find((match) => {
      const lg = match.league as { slug?: string; name?: string } | undefined;
      const mSlug = norm(lg?.slug ?? lg?.name ?? '');
      return mSlug === target || (target.length > 6 && mSlug.includes(target.slice(0, 8))) || (mSlug.length > 6 && target.includes(mSlug.slice(0, 8)));
    });
    if (!m) return null;
    const lg = m.league as { name?: string; country?: string } | undefined;
    const sp = m.sport as { slug?: string; name?: string } | undefined;
    if (!lg?.name) return null;
    return { name: lg.name, country: lg.country, sportSlug: sp?.slug, sportName: sp?.name };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const normSlug = resolveLeagueSlug(slug) || slug;
  const canonical = `${BASE_URL}/leagues/${normSlug}`;

  const knownLeague = ALL_LEAGUES.find(l => l.slug === normSlug);

  let leagueName: string;
  let leagueCountry: string | undefined;
  let sport = detectSportFromSlug(normSlug);
  let isNewLeague = false;

  if (knownLeague) {
    leagueName = knownLeague.name;
    leagueCountry = knownLeague.country;
    const knownSport = ALL_SPORTS.find(s => s.id === knownLeague.sportId);
    if (knownSport) sport = { name: knownSport.name, slug: knownSport.slug, id: knownSport.id };
  } else {
    const fetched = await fetchLeagueFromAPI(normSlug);
    if (fetched?.name) {
      leagueName = fetched.name;
      leagueCountry = fetched.country;
      if (fetched.sportSlug) {
        const fetchedSport = ALL_SPORTS.find(s => s.slug === fetched.sportSlug);
        if (fetchedSport) sport = { name: fetchedSport.name, slug: fetchedSport.slug, id: fetchedSport.id };
        else sport = { name: fetched.sportName || sport.name, slug: fetched.sportSlug, id: sport.id };
      }
    } else {
      leagueName = slugToTitle(normSlug);
      sport = detectSportFromSlug(normSlug);
    }
    if (!KNOWN_LEAGUE_SLUGS.has(normSlug)) {
      isNewLeague = true;
    }
  }

  if (isNewLeague) {
    try { pingIndexNow([canonical]); } catch { /* fire-and-forget */ }
  }

  const locationStr = leagueCountry ? ` (${leagueCountry})` : '';
  const sportLabel = sport.name;
  const title = `${leagueName} Predictions, Tips & Standings | ${SITE_NAME}`;
  const description = `Free ${leagueName}${locationStr} ${sportLabel.toLowerCase()} predictions, match tips, fixtures and results. AI-powered analysis for every ${leagueName} match on ${SITE_NAME} Kenya.`;

  const keywords = [
    `${leagueName} predictions`, `${leagueName} tips`, `${leagueName} betting tips`,
    `${leagueName} predictions today`, `${leagueName} tips today`,
    `${leagueName} fixtures`, `${leagueName} results`, `${leagueName} standings`,
    `${leagueName} match preview`, `${leagueName} odds`,
    leagueCountry ? `${leagueName} ${leagueCountry}` : '',
    leagueCountry ? `${leagueCountry} ${sportLabel.toLowerCase()} predictions` : '',
    `${sportLabel} predictions Kenya`, `${sportLabel} tips Kenya`,
    `${leagueName} predictions Kenya`, `${leagueName} tips Kenya`,
    `${leagueName} SportPesa tips`, `${leagueName} Betika tips`,
    `${leagueName} 1xBet tips`, `${leagueName} Odibets tips`,
    `${sportLabel} betting tips Kenya`, `free ${sportLabel.toLowerCase()} tips`,
    `${SITE_NAME} ${leagueName}`, `${SITE_NAME} ${sportLabel}`,
  ].filter(Boolean);

  return {
    title: { absolute: title },
    description,
    keywords,
    alternates: { canonical },
    robots: { index: true, follow: true, 'max-image-preview': 'large' as const },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonical,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      site: '@betcheza',
    },
  };
}

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const normSlug = resolveLeagueSlug(slug) || slug;
  const canonical = `${BASE_URL}/leagues/${normSlug}`;
  const knownLeague = ALL_LEAGUES.find(l => l.slug === normSlug);

  let leagueName = knownLeague?.name ?? slugToTitle(normSlug);
  let leagueCountry = knownLeague?.country;
  let sport = detectSportFromSlug(normSlug);

  if (knownLeague) {
    const knownSport = ALL_SPORTS.find(s => s.id === knownLeague.sportId);
    if (knownSport) sport = { name: knownSport.name, slug: knownSport.slug, id: knownSport.id };
  } else {
    const fetched = await fetchLeagueFromAPI(normSlug);
    if (fetched?.name) {
      leagueName = fetched.name;
      leagueCountry = fetched.country;
      if (fetched.sportSlug) {
        const fetchedSport = ALL_SPORTS.find(s => s.slug === fetched.sportSlug);
        if (fetchedSport) sport = { name: fetchedSport.name, slug: fetchedSport.slug, id: fetchedSport.id };
      }
    }
  }

  const sportOrgSchema = {
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    '@id': canonical,
    name: leagueName,
    url: canonical,
    ...(leagueCountry ? { location: { '@type': 'Country', name: leagueCountry } } : {}),
    sport: sport.name,
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: `${sport.name} Leagues`, item: `${BASE_URL}/sports/${sport.slug}` },
      { '@type': 'ListItem', position: 3, name: leagueName, item: canonical },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(sportOrgSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      {children}
    </>
  );
}
