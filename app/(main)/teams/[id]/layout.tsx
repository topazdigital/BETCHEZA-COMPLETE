import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/site-settings';

interface TeamResponse {
  team?: {
    name?: string;
    nickname?: string;
    league?: string;
    country?: string;
    venue?: string;
    canonicalId?: string;
  };
}

async function fetchTeam(id: string): Promise<TeamResponse['team'] | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  try {
    // Bypass Next's fetch cache so a stale "Premier League" probe doesn't
    // get baked into the page metadata for ten minutes after a deploy.
    // The team API itself caches at the resolver level (in-memory map),
    // so this is cheap.
    const r = await fetch(`${baseUrl}/api/teams/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const data = (await r.json()) as TeamResponse;
    return data.team ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const [{ id }, settings] = await Promise.all([params, getSiteSettings()]);
  const team = await fetchTeam(id);
  if (!team?.name) {
    return { title: `Team · ${settings.site_name}` };
  }
  const leaguePart = team.league ? ` — ${team.league}` : '';
  const title = `${team.name}${leaguePart} · Fixtures, Squad & Tips · ${settings.site_name}`;
  const venuePart = team.venue ? ` Plays home games at ${team.venue}.` : '';
  const description = `${team.name}${team.country ? ` (${team.country})` : ''}${leaguePart}. Live fixtures, results, squad, injuries and expert betting tips.${venuePart}`;
  // Canonical URL — browsers and crawlers will see the slug+id form even
  // when the page was reached via a legacy `espn_xxx_id` link.
  const canonicalPath = team.canonicalId ? `/teams/${team.canonicalId}` : undefined;
  return {
    title,
    description,
    alternates: canonicalPath ? { canonical: canonicalPath } : undefined,
    openGraph: { title, description, type: 'website' },
    twitter: { title, description, card: 'summary_large_image' },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
