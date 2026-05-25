import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Best Tipsters in Kenya | Most Trusted Betting Tips | Betcheza',
  description: 'Find the most trusted betting tipsters in Kenya with verified win rates and transparent records. Follow the best prediction experts for SportPesa, Betika, Odibets and more — all free on Betcheza.',
  keywords: [
    'best tipsters Kenya', 'most trusted tipsters Kenya', 'top football predictors Kenya',
    'free tipsters Kenya', 'verified tipsters Kenya', 'highest win rate tipsters Kenya',
    'SportPesa tipster Kenya', 'Betika tipster Kenya', 'football tipster Kenya',
    'tipster leaderboard Kenya', 'football prediction experts Kenya',
    'best football predictions today Kenya', 'follow tipster Kenya',
    'top betting experts Kenya', 'tipster ROI Kenya', 'trusted prediction experts Kenya',
    'free football tips experts Kenya', 'tipster community Kenya',
    'best betting tipsters Africa', 'most accurate tipster Kenya',
    'which prediction site has 90 accuracy Kenya', 'genuine tipsters Kenya',
    'legit tipsters Kenya', 'verified win rate tipster Kenya',
    'best free tipster Kenya', 'professional sports tipster Kenya',
  ],
  openGraph: {
    title: 'Best Tipsters in Kenya | Top Football Predictors | Betcheza',
    description: 'Find and follow the best verified tipsters in Kenya. Compare win rates, ROI and picks for SportPesa, Betika and Odibets.',
    url: 'https://betcheza.co.ke/tipsters',
    type: 'website',
    siteName: 'Betcheza',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Best Tipsters Kenya | Betcheza',
    description: "Follow Kenya's top verified football tipsters. Free tips from experts with proven win rates.",
  },
  alternates: { canonical: 'https://betcheza.co.ke/tipsters' },
  robots: { index: true, follow: true },
};

const baseUrl = 'https://betcheza.co.ke';

const itemListSchema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Best Sports Tipsters in Kenya',
  description: "Kenya's top verified football tipsters ranked by win rate and ROI on Betcheza.",
  url: `${baseUrl}/tipsters`,
  itemListOrder: 'https://schema.org/ItemListOrderDescending',
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Betcheza', item: baseUrl },
    { '@type': 'ListItem', position: 2, name: 'Tipsters', item: `${baseUrl}/tipsters` },
  ],
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      {children}
    </>
  );
}
