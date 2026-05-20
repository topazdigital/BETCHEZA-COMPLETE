import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/site-settings';

interface TipsterResponse {
  username?: string;
  displayName?: string;
  winRate?: number;
  totalTips?: number;
  bio?: string;
}

async function fetchTipster(id: string): Promise<TipsterResponse | null> {
  const baseUrl = process.env.INTERNAL_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  try {
    const r = await fetch(`${baseUrl}/api/tipsters/${encodeURIComponent(id)}?includeTips=false&includeStats=false`, {
      cache: 'no-store',
    });
    if (!r.ok) return null;
    // API returns { tipster: {...}, recentTips: [...] } — extract the nested tipster object
    const json = await r.json();
    return (json.tipster ?? json) as TipsterResponse;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const [{ id }, settings] = await Promise.all([params, getSiteSettings()]);
  const t = await fetchTipster(id);
  const siteName = settings.site_name || 'Betcheza';
  if (!t || (!t.displayName && !t.username)) {
    return {
      title: `Top Sports Tipster Profile | ${siteName}`,
      description: `View this tipster's verified picks, win rate and prediction history on ${siteName} — Kenya's #1 sports betting tips community. Free football tips daily.`,
    };
  }
  const name = t.displayName || t.username || 'Tipster';
  const wr = typeof t.winRate === 'number' ? `${Math.round(t.winRate)}%` : null;
  const totalTips = t.totalTips ? `${t.totalTips} tips` : null;
  // Primary title: name first for better click-through
  const title = [name, wr ? `${wr} Win Rate` : null, totalTips, `${siteName} Tipster`]
    .filter(Boolean).join(' | ');
  // Use bio if available, otherwise a rich keyword description
  const description = t.bio
    || `Follow ${name} on ${siteName} — verified sports tipster with ${wr ? wr + ' win rate' : 'expert predictions'}. Track ${name}'s football picks, ROI, win streak and full prediction history. Free tips from Kenya's top betting experts.`;
  const slugId = encodeURIComponent(id);
  const canonical = `https://betcheza.co.ke/tipsters/${slugId}`;
  return {
    title,
    description,
    keywords: [
      `${name} tips`, `${name} predictions`, `${name} tipster`, `${name} football tips`,
      `${name} win rate`, `follow ${name}`,
      'free tipster Kenya', 'best tipster Kenya', 'verified tipster Kenya',
      'top football tipster Kenya', 'sports betting tipster Kenya',
      'tipster leaderboard Kenya', 'highest win rate tipster', 'free football predictions Kenya',
      'expert tipster Africa', 'betting tips Kenya', 'football tipster Africa',
      `${siteName} tipster profile`, `${siteName} predictions`,
      'sure tips today Kenya', 'daily betting tips Kenya', 'free tips today football',
    ],
    openGraph: {
      title,
      description,
      type: 'profile',
      url: canonical,
      siteName,
    },
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical },
    robots: { index: true, follow: true },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
