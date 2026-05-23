import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/site-settings';
import { getCompetitionsAsync } from '@/lib/competitions-store';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const siteName = s.site_name || 'Betcheza';

  const comps = (await getCompetitionsAsync()).filter(c => c.status === 'active');
  const totalPrize = comps.reduce((sum, c) => sum + c.prizePool, 0);
  const topPrize = Math.max(...comps.map(c => c.prizePool), 0);
  const currency = comps[0]?.currency || 'KES';

  const prizeStr = totalPrize > 0
    ? `Win up to ${currency} ${topPrize.toLocaleString()} in prizes. ${comps.length} active competitions with a combined ${currency} ${totalPrize.toLocaleString()} prize pool.`
    : `Enter daily and weekly tipping competitions on ${siteName}.`;

  const title = `Live Tipster Competitions & Prize Pools · ${siteName}`;
  const description = `Compete against tipsters worldwide on ${siteName}. ${prizeStr} Predict matches, climb the leaderboard, and win real prizes today.`;

  const keywords = comps
    .flatMap(c => [c.name, c.sportFocus, c.leagueName].filter(Boolean))
    .slice(0, 10)
    .join(', ');

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      title,
      description,
      card: 'summary',
    },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
