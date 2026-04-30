import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/site-settings';

interface DetailsResponse {
  match?: {
    homeTeam?: { name?: string };
    awayTeam?: { name?: string };
    league?: { name?: string };
    kickoffTime?: string;
  };
}

async function fetchMatch(id: string): Promise<DetailsResponse['match'] | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  try {
    const r = await fetch(`${baseUrl}/api/matches/${encodeURIComponent(id)}/details`, {
      next: { revalidate: 600 },
    });
    if (!r.ok) return null;
    const data = (await r.json()) as DetailsResponse;
    return data.match ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const [{ id }, settings] = await Promise.all([params, getSiteSettings()]);
  const match = await fetchMatch(id);
  if (!match || !match.homeTeam?.name || !match.awayTeam?.name) {
    return { title: `Match Preview · ${settings.site_name}` };
  }
  const fixture = `${match.homeTeam.name} vs ${match.awayTeam.name}`;
  const leaguePart = match.league?.name ? ` — ${match.league.name}` : '';
  const title = `${fixture}${leaguePart} · Tips & Predictions · ${settings.site_name}`;
  const description = `${fixture}${leaguePart}. Lineups, head-to-head stats, odds and expert betting tips on ${settings.site_name}.`;
  return { title, description, openGraph: { title, description }, twitter: { title, description } };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
