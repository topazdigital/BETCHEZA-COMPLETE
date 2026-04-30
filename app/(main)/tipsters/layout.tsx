import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/site-settings';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const title = `Top Tipsters & Predictors · ${s.site_name}`;
  const description = `Follow the highest-ranked tipsters on ${s.site_name}. Compare win rates, ROI and recent picks across every sport.`;
  return { title, description, openGraph: { title, description }, twitter: { title, description } };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
