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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  try {
    const r = await fetch(`${baseUrl}/api/tipsters/${encodeURIComponent(id)}`, {
      next: { revalidate: 600 },
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
    return { title: `Tipster Profile · ${settings.site_name}` };
  }
  const name = t.displayName || t.username || 'Tipster';
  const wr = typeof t.winRate === 'number' ? ` — ${Math.round(t.winRate)}% win rate` : '';
  const title = `${name}${wr} · Tipster Profile · ${settings.site_name}`;
  const description = t.bio
    || `Follow ${name} on ${settings.site_name}. Track their picks, win rate and ROI across every sport.`;
  return { title, description, openGraph: { title, description }, twitter: { title, description } };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
