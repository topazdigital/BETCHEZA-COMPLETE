import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/site-settings';

interface TipsterResponse {
  username?: string;
  displayName?: string;
  winRate?: number;
  roi?: number;
  totalTips?: number;
  bio?: string;
  avatar?: string;
  sport?: string;
  verified?: boolean;
  country?: string;
  followers?: number;
}

async function fetchTipster(id: string): Promise<TipsterResponse | null> {
  const baseUrl =
    process.env.INTERNAL_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    `http://localhost:${process.env.PORT || 5000}`;
  try {
    const r = await fetch(
      `${baseUrl}/api/tipsters/${encodeURIComponent(id)}?includeTips=false&includeStats=true`,
      { next: { revalidate: 300 } },
    );
    if (!r.ok) return null;
    const json = await r.json();
    return (json.tipster ?? json) as TipsterResponse;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const [{ id }, settings] = await Promise.all([params, getSiteSettings()]);
  const t = await fetchTipster(id);
  const siteName = settings.site_name || 'Betcheza';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';
  const canonical = `${baseUrl}/tipsters/${encodeURIComponent(id)}`;

  if (!t || (!t.displayName && !t.username)) {
    return {
      title: `Top Sports Tipster Profile`,
      description: `View this tipster's verified picks, win rate and prediction history on ${siteName} — Kenya's #1 sports betting tips community. Free football tips daily.`,
      alternates: { canonical },
    };
  }

  const name = t.displayName || t.username || 'Tipster';
  const wr = typeof t.winRate === 'number' ? `${Math.round(t.winRate)}%` : null;
  const roiStr = typeof t.roi === 'number' ? `${t.roi >= 0 ? '+' : ''}${t.roi.toFixed(1)}% ROI` : null;
  const sport = t.sport || 'football';

  const title = [name, wr ? `${wr} Win Rate` : null, t.totalTips ? `${t.totalTips} Tips` : null, `${siteName} Tipster`]
    .filter(Boolean).join(' | ');

  const description =
    t.bio ||
    `Follow ${name} on ${siteName}${t.verified ? ' — verified tipster' : ''}. ${wr ? wr + ' win rate' : 'Expert predictions'}${roiStr ? ', ' + roiStr : ''} across ${t.totalTips ?? 'hundreds of'} ${sport} tips. Track full prediction history, ROI and win streak. Free tips from Kenya's top betting experts.`;

  return {
    title,
    description,
    keywords: [
      `${name} tips`,
      `${name} predictions`,
      `${name} tipster`,
      `${name} ${sport} tips`,
      `${name} win rate`,
      `follow ${name}`,
      'free tipster Kenya',
      'best tipster Kenya',
      'verified tipster Kenya',
      `top ${sport} tipster Kenya`,
      'sports betting tipster Kenya',
      'tipster leaderboard Kenya',
      'highest win rate tipster',
      'free football predictions Kenya',
      'expert tipster Africa',
      'betting tips Kenya',
      'sure tips today Kenya',
      'daily betting tips Kenya',
    ],
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: 'profile',
      url: canonical,
      siteName,
      ...(t.avatar ? { images: [{ url: t.avatar }] } : {}),
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [t, settings] = await Promise.all([fetchTipster(id), getSiteSettings()]);

  const siteName = settings.site_name || 'Betcheza';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';
  const canonical = `${baseUrl}/tipsters/${encodeURIComponent(id)}`;

  if (!t || (!t.displayName && !t.username)) {
    return <>{children}</>;
  }

  const name = t.displayName || t.username || 'Tipster';
  const wr = typeof t.winRate === 'number' ? t.winRate : undefined;
  const roi = typeof t.roi === 'number' ? t.roi : undefined;

  const personSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': canonical,
    name,
    url: canonical,
    ...(t.username ? { alternateName: t.username } : {}),
    ...(t.avatar ? { image: t.avatar } : {}),
    ...(t.bio ? { description: t.bio } : {}),
    ...(t.country ? { nationality: { '@type': 'Country', name: t.country } } : {}),
    jobTitle: `Sports Tipster${t.verified ? ' (Verified)' : ''}`,
    worksFor: { '@type': 'Organization', name: siteName, url: baseUrl },
    ...(wr !== undefined || roi !== undefined
      ? {
          knowsAbout: [
            'Sports Betting',
            'Football Predictions',
            t.sport ?? 'Football',
            'Kenya Sports Betting',
          ],
        }
      : {}),
    ...(t.followers ? { interactionStatistic: { '@type': 'InteractionCounter', interactionType: 'https://schema.org/FollowAction', userInteractionCount: t.followers } } : {}),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: siteName, item: baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Tipsters', item: `${baseUrl}/tipsters` },
      { '@type': 'ListItem', position: 3, name, item: canonical },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      {children}
    </>
  );
}
