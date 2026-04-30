import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/site-settings';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const title = `Live Competitions & Prize Pools · ${s.site_name}`;
  const description = `Enter daily and weekly tipping competitions on ${s.site_name}. Predict matches, climb the table, win prizes.`;
  return { title, description, openGraph: { title, description }, twitter: { title, description } };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
