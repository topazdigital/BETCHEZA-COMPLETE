import type { Metadata } from 'next';

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke').replace(/\/$/, '');

export const metadata: Metadata = {
  title: 'Sports News & Betting Insights | Football, Tennis, Cricket & More | Betcheza Kenya',
  description: "Latest football news, transfer rumours, injury updates, match previews and betting analysis. Covering Premier League, Champions League, Kenya Premier League, ATP tennis, NBA basketball and all major sports — updated hourly on Betcheza Kenya.",
  keywords: [
    'football news today Kenya', 'sports news Kenya', 'football transfer news',
    'injury news football', 'Premier League news', 'Champions League news',
    'Kenya Premier League news', 'FKF Premier League news', 'Africa Cup of Nations news',
    'football betting news Kenya', 'match preview Kenya', 'football odds news',
    'tennis news today', 'ATP news', 'WTA news', 'Wimbledon news', 'Grand Slam news',
    'NBA news today', 'basketball news Kenya', 'cricket news today', 'IPL news',
    'rugby news today', 'Six Nations news', 'UFC news today', 'boxing news today',
    'sports betting news Kenya', 'SportPesa news', 'Betika news', 'Odibets news',
    'football analysis Kenya', 'sports tips news Kenya', 'Betcheza news',
    'football headlines Kenya', 'latest sports news Africa',
  ],
  openGraph: {
    title: 'Sports News & Betting Insights | Betcheza Kenya',
    description: "Breaking football news, transfer rumours, injury updates and expert betting analysis — covering Premier League, Champions League, Kenya Premier League and all major sports.",
    url: `${BASE_URL}/news`,
    type: 'website',
    siteName: 'Betcheza',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sports News & Betting Analysis | Betcheza Kenya',
    description: "Latest football news, injuries, transfers and betting insights from Kenya's #1 sports prediction platform.",
    site: '@betcheza',
  },
  alternates: { canonical: `${BASE_URL}/news` },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
  },
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Betcheza', item: BASE_URL },
    { '@type': 'ListItem', position: 2, name: 'News', item: `${BASE_URL}/news` },
  ],
};

const webSiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  '@id': `${BASE_URL}/news`,
  url: `${BASE_URL}/news`,
  name: 'Sports News & Betting Insights | Betcheza Kenya',
  description: 'Latest football news, match previews, injuries, transfers and betting analysis.',
  isPartOf: { '@id': `${BASE_URL}/#website` },
  about: { '@type': 'Thing', name: 'Sports News' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }} />
      {children}
    </>
  );
}
