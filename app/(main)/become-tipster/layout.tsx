import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Become a Sports Betting Tipster | Betcheza — Apply Today',
  description:
    'Apply to become a verified sports betting tipster on Betcheza. Share your football, basketball and rugby picks with thousands of bettors across Kenya and Africa. Build a public profile, earn followers and unlock paid subscriptions.',
  keywords: [
    'become a tipster',
    'sports tipster Kenya',
    'betting tipster application',
    'football tipster Kenya',
    'sports betting tipster',
    'tipster platform Africa',
    'earn from betting tips',
    'verified tipster',
    'become a betting tipster',
    'tipster profile Kenya',
    'join tipster platform',
    'football predictions Kenya',
    'sports picks Africa',
    'tipster recruitment',
    'paid tipster subscription',
    'betcheza tipster',
    'how to become a tipster',
    'tipster sign up',
    'betting analyst Kenya',
    'sports betting expert Africa',
  ].join(', '),
  alternates: {
    canonical: 'https://betcheza.co.ke/become-tipster',
  },
  openGraph: {
    title: 'Become a Sports Betting Tipster on Betcheza',
    description:
      'Get your own public tipster profile with stats, ROI charts and followers. Apply in minutes — approved tipsters can charge a monthly subscription and start posting picks immediately.',
    url: 'https://betcheza.co.ke/become-tipster',
    siteName: 'Betcheza',
    type: 'website',
    locale: 'en_KE',
    images: [
      {
        url: 'https://betcheza.co.ke/og-tipster.png',
        width: 1200,
        height: 630,
        alt: 'Become a Tipster on Betcheza',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Become a Sports Betting Tipster | Betcheza',
    description:
      'Share your picks, build a following and earn from paid subscriptions. Apply to join the Betcheza tipster community today.',
    images: ['https://betcheza.co.ke/og-tipster.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
};

export default function BecomeTipsterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
