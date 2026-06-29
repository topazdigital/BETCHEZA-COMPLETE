import type { Metadata } from 'next';
import AdvertisePage from './AdvertisePage';

export const metadata: Metadata = {
  title: 'Advertise on Betcheza — Reach 50,000+ Active Kenyan Bettors',
  description: 'Partner with Betcheza to place your bookmaker brand in front of Kenya\'s most engaged sports bettors. Real audience data, CPA & revenue share deals, banner placements and more. Contact partnerships@betcheza.co.ke',
  keywords: [
    'advertise on betcheza',
    'kenya sports betting advertising',
    'bookmaker affiliate kenya',
    'sports betting audience kenya',
    'betting site advertising',
    'kenya betting partnership',
    'CPA bookmaker deal kenya',
    'revenue share betting africa',
    'east africa sports betting ads',
    'betcheza media kit',
    'kenya sports betting platform',
    'bookmaker sponsorship kenya',
  ],
  openGraph: {
    title: 'Advertise on Betcheza — Reach 50,000+ Active Kenyan Bettors',
    description: 'Place your brand in front of Kenya\'s largest sports betting tips community. Real stats, flexible deals (CPA, Rev Share, Fixed), multiple ad placements.',
    url: 'https://betcheza.co.ke/advertise',
    siteName: 'Betcheza',
    locale: 'en_KE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Advertise on Betcheza — Kenya\'s #1 Sports Predictions Platform',
    description: '50K+ registered users, 320K monthly pageviews, 87% mobile. CPA, Revenue Share, and fixed-placement deals available for bookmakers.',
  },
  alternates: {
    canonical: 'https://betcheza.co.ke/advertise',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
    },
  },
};

export default function Page() {
  return <AdvertisePage />;
}
