import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/site-settings';

interface MatchData {
  homeTeam?: { name?: string; logo?: string };
  awayTeam?: { name?: string; logo?: string };
  league?: { name?: string; country?: string; countryCode?: string };
  kickoffTime?: string;
  status?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  venue?: string;
  venueCity?: string;
  venueCountry?: string;
  sport?: { name?: string; slug?: string };
}

interface DetailsResponse {
  match?: MatchData;
}

async function fetchMatch(id: string): Promise<MatchData | null> {
  const baseUrl =
    process.env.INTERNAL_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    `http://localhost:${process.env.PORT || 5000}`;
  try {
    const r = await fetch(`${baseUrl}/api/matches/${encodeURIComponent(id)}/details`, {
      next: { revalidate: 120 },
    });
    if (!r.ok) return null;
    const data = (await r.json()) as DetailsResponse;
    return data.match ?? null;
  } catch {
    return null;
  }
}

function isFinished(status?: string): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return (
    s === 'finished' || s === 'ft' || s === 'full-time' || s === 'aet' ||
    s === 'pen' || s === 'walkover' || s === 'awarded' || s === 'postponed' ||
    s === 'cancelled' || s === 'abandoned'
  );
}

function isLive(status?: string): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return (
    s === 'live' || s === 'inprogress' || s === 'in_progress' ||
    s === 'halftime' || s === 'extra_time' || s === 'penalties' ||
    s === 'break' || s === 'ht'
  );
}

function isCancelled(status?: string): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === 'cancelled' || s === 'abandoned';
}

function isPostponed(status?: string): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === 'postponed';
}

function formatKickoffDate(kickoffTime?: string): string {
  if (!kickoffTime) return '';
  try {
    return new Date(kickoffTime).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  } catch {
    return '';
  }
}

function buildJsonLd(
  match: MatchData,
  id: string,
  siteName: string,
  baseUrl: string,
): object[] {
  const home = match.homeTeam?.name ?? '';
  const away = match.awayTeam?.name ?? '';
  const league = match.league?.name ?? '';
  const canonical = `${baseUrl}/matches/${encodeURIComponent(id)}`;
  const finished = isFinished(match.status);
  const live = isLive(match.status);

  // Google-recognised eventStatus values
  let eventStatus = 'https://schema.org/EventScheduled';
  if (isCancelled(match.status)) eventStatus = 'https://schema.org/EventCancelled';
  else if (isPostponed(match.status)) eventStatus = 'https://schema.org/EventPostponed';
  else if (finished) eventStatus = 'https://schema.org/EventScheduled';

  // Build competitor entries — Schema.org SportsEvent uses `competitor`
  const homeTeamSchema: Record<string, unknown> = {
    '@type': 'SportsTeam',
    name: home,
    ...(match.homeTeam?.logo ? { image: match.homeTeam.logo } : {}),
  };
  const awayTeamSchema: Record<string, unknown> = {
    '@type': 'SportsTeam',
    name: away,
    ...(match.awayTeam?.logo ? { image: match.awayTeam.logo } : {}),
  };

  // Location object
  const locationParts = [match.venue, match.venueCity, match.venueCountry].filter(Boolean);
  const locationObj = locationParts.length
    ? {
        '@type': 'Place',
        name: match.venue || locationParts.join(', '),
        ...(match.venueCity || match.venueCountry
          ? {
              address: {
                '@type': 'PostalAddress',
                addressLocality: match.venueCity ?? undefined,
                addressCountry: match.venueCountry ?? match.league?.countryCode ?? undefined,
              },
            }
          : {}),
      }
    : undefined;

  // SportsEvent — Google's rich result for matches
  const sportsEvent: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    '@id': canonical,
    name: `${home} vs ${away}`,
    startDate: match.kickoffTime,
    eventStatus,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: canonical,
    description: finished
      ? `${home} ${match.homeScore ?? 0} - ${match.awayScore ?? 0} ${away} full time result${league ? ` | ${league}` : ''}.`
      : live
      ? `Live: ${home} ${match.homeScore ?? 0} - ${match.awayScore ?? 0} ${away}${league ? ` | ${league}` : ''}.`
      : `${home} vs ${away}${league ? ` | ${league}` : ''} — predictions, tips and odds.`,
    ...(locationObj ? { location: locationObj } : {}),
    // Standard Schema.org competitor array
    competitor: [homeTeamSchema, awayTeamSchema],
    // Google also reads homeTeam/awayTeam for score display
    homeTeam: {
      ...homeTeamSchema,
      ...(finished && match.homeScore != null
        ? { score: { '@type': 'QuantitativeValue', value: match.homeScore } }
        : {}),
    },
    awayTeam: {
      ...awayTeamSchema,
      ...(finished && match.awayScore != null
        ? { score: { '@type': 'QuantitativeValue', value: match.awayScore } }
        : {}),
    },
    ...(league
      ? {
          organizer: {
            '@type': 'Organization',
            name: league,
            ...(match.league?.country ? { location: { '@type': 'Country', name: match.league.country } } : {}),
          },
        }
      : {}),
    ...(match.sport?.name ? { sport: match.sport.name } : {}),
  };

  // BreadcrumbList — helps Google show navigation path in results
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: siteName, item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Matches', item: `${baseUrl}/matches` },
      { '@type': 'ListItem', position: 3, name: `${home} vs ${away}`, item: canonical },
    ],
  };

  // WebPage — signals to Google what kind of page this is
  const webPage = {
    '@context': 'https://schema.org',
    '@type': finished ? 'WebPage' : 'WebPage',
    '@id': `${canonical}#webpage`,
    url: canonical,
    name: finished
      ? `${home} ${match.homeScore ?? 0}-${match.awayScore ?? 0} ${away} Result`
      : `${home} vs ${away} Predictions`,
    isPartOf: { '@id': `${baseUrl}/#website` },
    breadcrumb: { '@id': `${canonical}#breadcrumb` },
  };

  return [sportsEvent, breadcrumb, webPage];
}

// ─── generateMetadata ─────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const [{ id }, settings] = await Promise.all([params, getSiteSettings()]);
  const match = await fetchMatch(id);
  const siteName = settings.site_name || 'Betcheza';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';

  if (!match || !match.homeTeam?.name || !match.awayTeam?.name) {
    return {
      title: `Match Preview | ${siteName}`,
      alternates: { canonical: `${baseUrl}/matches/${encodeURIComponent(id)}` },
    };
  }

  const home = match.homeTeam.name;
  const away = match.awayTeam.name;
  const league = match.league?.name || '';
  const leagueSuffix = league ? ` | ${league}` : '';
  const canonical = `${baseUrl}/matches/${encodeURIComponent(id)}`;
  const dateStr = formatKickoffDate(match.kickoffTime);

  let title: string;
  let description: string;
  let keywords: string[];

  if (isFinished(match.status)) {
    const hs = match.homeScore ?? 0;
    const as_ = match.awayScore ?? 0;
    const winner = hs > as_ ? home : as_ > hs ? away : null;
    const resultLine = `${home} ${hs} - ${as_} ${away}`;
    const outcomeDesc = winner ? `${winner} win` : `${home} and ${away} drew`;
    title = `${resultLine} Full Time Result${leagueSuffix} | ${siteName}`;
    description = `Full time result: ${resultLine}. ${outcomeDesc}${league ? ` in the ${league}` : ''}. Match stats, lineups, tips and analysis on ${siteName}.`;
    keywords = [
      `${home} vs ${away} result`,
      `${home} vs ${away} score`,
      `${home} ${hs}-${as_} ${away}`,
      `${home} vs ${away} full time`,
      league ? `${league} results` : '',
      league ? `${league} scores today` : '',
      `${home} score today`,
      `${away} score today`,
      'football results Kenya', 'match scores', 'full time result',
    ].filter(Boolean);
  } else if (isLive(match.status)) {
    const hs = match.homeScore ?? 0;
    const as_ = match.awayScore ?? 0;
    title = `🔴 LIVE: ${home} ${hs}-${as_} ${away}${leagueSuffix} | ${siteName}`;
    description = `Live score: ${home} ${hs} - ${as_} ${away}${league ? ` | ${league}` : ''}. Follow live commentary, lineups, stats and betting tips on ${siteName}.`;
    keywords = [
      `${home} vs ${away} live`,
      `${home} vs ${away} live score`,
      `${home} live score`,
      `${away} live score`,
      league ? `${league} live` : '',
      'live football scores Kenya', 'live match score',
    ].filter(Boolean);
  } else {
    const datePart = dateStr ? ` on ${dateStr}` : '';
    title = `${home} vs ${away} Predictions & Tips${leagueSuffix}${datePart ? ` | ${datePart}` : ''} | ${siteName}`;
    description = `Expert predictions and betting tips for ${home} vs ${away}${league ? ` in the ${league}` : ''}${datePart}. AI-powered match analysis, odds comparison, lineups and H2H stats on ${siteName}.`;
    keywords = [
      `${home} vs ${away} prediction`,
      `${home} vs ${away} tips`,
      `${home} vs ${away} odds`,
      `${home} vs ${away} betting tips`,
      `${home} vs ${away} preview`,
      league ? `${league} predictions` : '',
      league ? `${league} tips` : '',
      dateStr ? `${home} vs ${away} ${dateStr}` : '',
      'football tips Kenya', 'match prediction', 'sports betting tips', 'AI football predictor',
    ].filter(Boolean);
  }

  const ogTitle = title.replace(/🔴 LIVE: /, '');

  return {
    title,
    description,
    keywords,
    openGraph: {
      title: ogTitle,
      description,
      type: 'article',
      url: canonical,
      siteName,
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
    },
    alternates: { canonical },
    robots: { index: true, follow: true },
  };
}

// ─── Layout — renders children + JSON-LD scripts ──────────────────────────────
// Next.js App Router: structured data must be injected as a <script> tag in
// the component, not via the metadata API. Both fetchMatch calls share the same
// Next.js fetch cache so only one network request is made.

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [match, settings] = await Promise.all([fetchMatch(id), getSiteSettings()]);

  if (!match || !match.homeTeam?.name || !match.awayTeam?.name) {
    return <>{children}</>;
  }

  const siteName = settings.site_name || 'Betcheza';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';
  const schemas = buildJsonLd(match, id, siteName, baseUrl);

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      {children}
    </>
  );
}
