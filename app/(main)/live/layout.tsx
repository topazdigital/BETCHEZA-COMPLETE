import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/site-settings';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const title = `Live Scores & In-Play Matches · ${s.site_name}`;
  const description = `Real-time live scores, minute-by-minute updates and in-play tips across football, basketball, tennis and cricket.`;
  return { title, description, openGraph: { title, description }, twitter: { title, description } };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
