import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/site-settings';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const title = `Community Feed · ${s.site_name}`;
  const description = `Live feed of tips, analysis, and community chatter from top tipsters on ${s.site_name}. Join the conversation and follow your favourite predictors.`;
  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { title, description },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
