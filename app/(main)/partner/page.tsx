import type { Metadata } from 'next';
import PartnerPage from './PartnerPage';

export const metadata: Metadata = {
  title: 'Partner with Betcheza — CPA, Revenue Share & Hybrid Deals for Bookmakers',
  description:
    'Join Betcheza\'s partnership programme. Reach 50,000+ verified Kenyan bettors through CPA, revenue share and hybrid deals. Full campaign reporting, dedicated account support, and a transparent partnership structure.',
  keywords: [
    'betcheza partner',
    'bookmaker partnership kenya',
    'CPA deal kenya sports betting',
    'revenue share kenya betting',
    'affiliate programme kenya',
    'sports betting partner africa',
    'kenya bookmaker affiliate',
    'betting platform partnership',
    'betcheza bookmaker deal',
    'east africa betting partners',
  ],
  openGraph: {
    title: "Partner with Betcheza — Kenya's #1 Sports Predictions Platform",
    description:
      'CPA, Revenue Share & Hybrid partnership deals. 50K+ real bettors, 320K monthly pageviews, full reporting dashboard.',
    url: 'https://betcheza.co.ke/partner',
    siteName: 'Betcheza',
    locale: 'en_KE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Partner with Betcheza',
    description: "Kenya's #1 sports tips platform. CPA, RevShare & Hybrid deals for bookmakers.",
  },
  alternates: { canonical: 'https://betcheza.co.ke/partner' },
  robots: { index: true, follow: true },
};

export default function Page() {
  return <PartnerPage />;
}
