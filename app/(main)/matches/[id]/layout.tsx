import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/site-settings';

interface DetailsResponse {
  match?: {
    homeTeam?: { name?: string };
    awayTeam?: { name?: string };
    league?: { name?: string; country?: string };
    kickoffTime?: string;
    status?: string;
    homeScore?: number | null;
    awayScore?: number | null;
    venue?: string;
    sport?: { name?: string; slug?: string };
  };
}

async function fetchMatch(id: string): Promise<DetailsResponse['match'] | null> {
  const baseUrl = process.env.INTERNAL_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
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
  return s === 'finished' || s === 'ft' || s === 'full-time' || s === 'aet' ||
    s === 'pen' || s === 'walkover' || s === 'awarded' || s === 'postponed' ||
    s === 'cancelled' || s === 'abandoned';
}

function isLive(status?: string): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === 'live' || s === 'inprogress' || s === 'in_progress' ||
    s === 'halftime' || s === 'extra_time' || s === 'penalties' ||
    s === 'break' || s === 'ht';
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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
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
    const outcomeDesc = winner
      ? `${winner} win`
      : `${home} and ${away} drew`;
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
    ].filter(Boolean),
  };

  const ogTitle = title.replace(/🔴 LIVE: /, '');

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': isFinished(match.status) ? 'SportsEvent' : 'SportsEvent',
    name: `${home} vs ${away}`,
    startDate: match.kickoffTime,
    location: match.venue ? { '@type': 'Place', name: match.venue } : undefined,
    homeTeam: { '@type': 'SportsTeam', name: home },
    awayTeam: { '@type': 'SportsTeam', name: away },
    ...(isFinished(match.status) && match.homeScore != null ? {
      homeTeam: { '@type': 'SportsTeam', name: home, score: match.homeScore },
      awayTeam: { '@type': 'SportsTeam', name: away, score: match.awayScore },
    } : {}),
    organizer: league ? { '@type': 'Organization', name: league } : undefined,
    url: canonical,
  };

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
    other: {
      'script:ld+json': JSON.stringify(articleJsonLd),
    },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
