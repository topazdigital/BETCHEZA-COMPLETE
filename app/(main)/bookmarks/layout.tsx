import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/site-settings';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const title = `My Bookmarks · ${s.site_name}`;
  const description = `Your saved matches, tips and tipsters on ${s.site_name}.`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
