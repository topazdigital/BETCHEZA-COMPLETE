import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/site-settings';
import { getCompetitionsAsync } from '@/lib/competitions-store';

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke').replace(/\/$/, '');

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const siteName = s.site_name || 'Betcheza';

  const comps = (await getCompetitionsAsync()).filter(c => c.status === 'active');
  const totalPrize = comps.reduce((sum, c) => sum + c.prizePool, 0);
  const topPrize = Math.max(...comps.map(c => c.prizePool), 0);
  const currency = comps[0]?.currency || 'KES';
  const topComp = comps.find(c => c.prizePool === topPrize);

  const prizeStr = totalPrize > 0
    ? `Win up to ${currency} ${topPrize.toLocaleString()} in prizes. ${comps.length} active competitions with a combined ${currency} ${totalPrize.toLocaleString()} prize pool.`
    : `Enter daily and weekly tipping competitions on ${siteName}.`;

  const title = `Tipster Competitions & Prize Pools — Win KES ${topPrize > 0 ? topPrize.toLocaleString() : '50,000'} · ${siteName}`;
  const description = `Compete against tipsters worldwide on ${siteName}. ${prizeStr} Post winning predictions, climb the leaderboard, and win real cash prizes today. Free & paid entry competitions available.`;

  const keywords = [
    'tipster competition Kenya',
    'sports prediction contest',
    'betting tips leaderboard',
    'win money predictions',
    siteName,
    ...comps.flatMap(c => [c.name, c.sportFocus, c.leagueName].filter(Boolean)),
  ].filter(Boolean).slice(0, 12).join(', ');

  const canonicalUrl = `${BASE_URL}/competitions`;
  const topCompUrl = topComp ? `${BASE_URL}/competitions/${topComp.slug}` : undefined;

  return {
    title,
    description,
    keywords,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonicalUrl,
      siteName,
    },
    twitter: {
      title,
      description,
      card: 'summary_large_image',
      site: '@betcheza',
    },
    other: topCompUrl ? {
      'og:see_also': topCompUrl,
    } : {},
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
