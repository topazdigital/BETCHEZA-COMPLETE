import type { Metadata } from 'next';
import { getSiteSettings } from '@/lib/site-settings';

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const title = `Community Betting Tips Feed | Free Tips Kenya | ${s.site_name}`;
  const description = `Real-time feed of free betting tips, match analysis and predictions from Kenya's top tipsters. Follow expert picks for SportPesa, Betika, Odibets and all major bookmakers.`;
  return {
    title,
    description,
    keywords: [
      'community betting tips Kenya', 'free tips feed Kenya', 'tipster tips feed',
      'betting tips community Kenya', 'football tips today Kenya', 'sports tips feed Kenya',
      'free predictions feed', 'tipster community Kenya', 'betting social feed',
      'sports tips share Kenya', 'SportPesa tips community', 'Betika tips community',
    ],
    openGraph: {
      title,
      description,
      type: 'website',
      url: 'https://betcheza.co.ke/feed',
      siteName: s.site_name,
    },
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical: 'https://betcheza.co.ke/feed' },
    robots: { index: true, follow: true },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
