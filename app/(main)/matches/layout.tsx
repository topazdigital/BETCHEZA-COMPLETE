import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/site-settings';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const title = `All Matches & Fixtures · ${s.site_name}`;
  const description = `Browse upcoming football, basketball and tennis fixtures with odds, lineups and tipster predictions on ${s.site_name}.`;
  return { title, description, openGraph: { title, description }, twitter: { title, description } };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
