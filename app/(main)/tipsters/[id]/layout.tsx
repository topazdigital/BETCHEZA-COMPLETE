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
    const r = await fetch(`${baseUrl}/api/tipsters/${encodeURIComponent(id)}`, {
      next: { revalidate: 600 },
      cache: 'no-store',
    });
    if (!r.ok) return null;
    return (await r.json()) as TipsterResponse;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const [{ id }, settings] = await Promise.all([params, getSiteSettings()]);
  const t = await fetchTipster(id);
  if (!t) {
    return {
      title: `Tipster Profile · ${settings.site_name}`,
      description: `View this tipster's picks, win rate and prediction history on ${settings.site_name} — Kenya's #1 sports betting tips community.`,
    };
  }
  const name = t.displayName || t.username || 'Tipster';
  const wr = typeof t.winRate === 'number' ? ` — ${Math.round(t.winRate)}% win rate` : '';
  const totalTips = t.totalTips ? `, ${t.totalTips} tips placed` : '';
  const title = `${name}${wr}${totalTips} | ${settings.site_name} Tipster`;
  const description = t.bio
    || `Follow ${name} on ${settings.site_name}. Track their verified picks, win rate, ROI and prediction history across football, basketball and 35+ sports. Free tips from Kenya's top tipsters.`;
  const slugId = encodeURIComponent(id);
  return {
    title,
    description,
    keywords: [
      `${name} tips`, `${name} predictions`, `${name} tipster`,
      'free tipster Kenya', 'best tipster Kenya', 'verified tipster Kenya',
      `tipster profile ${settings.site_name}`, 'football tipster Kenya', 'sports tipster Kenya',
    ],
    openGraph: {
      title,
      description,
      type: 'profile',
      url: `https://betcheza.co.ke/tipsters/${slugId}`,
      siteName: settings.site_name,
    },
    twitter: { card: 'summary', title, description },
    alternates: { canonical: `https://betcheza.co.ke/tipsters/${slugId}` },
    robots: { index: true, follow: true },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
