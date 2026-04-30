import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/site-settings';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const title = `Tipster Leaderboard · ${s.site_name}`;
  const description = `Daily, weekly and monthly tipster rankings. See who is on the hottest streak across every sport on ${s.site_name}.`;
  return { title, description, openGraph: { title, description }, twitter: { title, description } };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
