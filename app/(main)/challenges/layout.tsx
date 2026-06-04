import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';

export const metadata: Metadata = {
  title: 'Tipster Challenges | Bet Head-to-Head on Football',
  description:
    'Challenge rival tipsters 1v1 on real football matches. Pick your predictions, score points for every correct tip, and win KES cash. Highest score takes the pot.',
  keywords: [
    'tipster challenges Kenya',
    'head to head betting Kenya',
    'bet against other tipsters',
    'football prediction challenge',
    'P2P betting Kenya',
    'win cash betting tips Kenya',
    'live points betting challenge',
    'betcheza challenges',
    'tipster battle Kenya',
    'best tipster community Kenya',
    'win KES betting predictions',
    'challenge tipster football Kenya',
    'sports prediction contest Kenya',
    'football betting competition Kenya',
  ],
  alternates: {
    canonical: `${siteUrl}/challenges`,
    languages: {
      'en-KE': `${siteUrl}/challenges`,
      'x-default': `${siteUrl}/challenges`,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_KE',
    url: `${siteUrl}/challenges`,
    siteName: 'Betcheza',
    title: 'Tipster Challenges | Bet Head-to-Head on Football',
    description:
      'Challenge rival tipsters 1v1 on real football matches. Pick your predictions, score points for every correct tip, and win KES cash. Highest score takes the pot.',
    images: [{ url: `${siteUrl}/og-image.png`, width: 1200, height: 630, alt: 'Betcheza Tipster Challenges' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tipster Challenges | Bet Head-to-Head on Football',
    description:
      'Challenge rival tipsters 1v1 on real football matches. Pick your predictions, score points for every correct tip, and win KES cash.',
    images: [`${siteUrl}/og-image.png`],
  },
};

export default function ChallengesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            '@id': `${siteUrl}/challenges`,
            name: 'Tipster Challenges',
            description:
              'Head-to-head football prediction battles on Betcheza. Challenge other tipsters, pick your markets, and win KES cash prizes based on correct pick accuracy.',
            url: `${siteUrl}/challenges`,
            isPartOf: { '@id': `${siteUrl}/#website` },
            breadcrumb: {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
                { '@type': 'ListItem', position: 2, name: 'Challenges', item: `${siteUrl}/challenges` },
              ],
            },
          }),
        }}
      />
      {children}
    </>
  );
}
