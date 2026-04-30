import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/site-settings';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const title = `Betcheza AI · ${s.site_name}`;
  const description = `Betcheza AI gives you free probability-based match predictions across football, basketball, tennis and more — updated continuously from real bookmaker odds.`;
  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { title, description, card: 'summary_large_image' },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
