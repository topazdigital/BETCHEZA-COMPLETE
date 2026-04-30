import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/site-settings';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const title = `Sports News & Betting Insights · ${s.site_name}`;
  const description = `Latest football news, transfer rumours, injury updates and betting analysis from the ${s.site_name} editorial desk.`;
  return { title, description, openGraph: { title, description }, twitter: { title, description } };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
