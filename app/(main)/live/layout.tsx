import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';

export const metadata: Metadata = {
  title: 'Live Scores Today | Football, Tennis, Basketball & All Sports | Betcheza',
  description: "Real-time live scores for football, tennis, basketball, cricket, rugby, MMA and more. Follow in-play results, live betting tips and match commentary updated every minute. Kenya's #1 live scores site.",
  keywords: [
    // Football
    'live football scores today', 'live football scores Kenya', 'football live results today',
    'in-play football tips Kenya', 'live Premier League scores', 'live Champions League scores',
    'live Kenya Premier League scores', 'live match updates Kenya',
    // Tennis
    'live tennis scores today', 'ATP live scores', 'WTA live scores',
    'tennis live results', 'Wimbledon live scores', 'French Open live',
    'US Open live scores', 'Australian Open live scores',
    // Basketball
    'NBA live scores today', 'live basketball scores', 'NBL live scores',
    'basketball live results today', 'live NBA Kenya',
    // Cricket
    'live cricket scores today', 'IPL live scores', 'Test match live score',
    'cricket live commentary Kenya',
    // Rugby
    'live rugby scores', 'Six Nations live', 'rugby union live scores',
    'rugby league live scores',
    // MMA / Boxing
    'UFC live results', 'MMA live scores', 'boxing live results',
    // General
    'live sports scores Kenya', 'all sports live today', 'live score app Kenya',
    'in-play betting tips Kenya', 'live betting tips Kenya',
    'live scores SportPesa', 'live scores Betika', 'live match today',
    'real-time sports scores', 'live score today Kenya',
  ],
  openGraph: {
    title: 'Live Scores Today — All Sports | Betcheza Kenya',
    description: 'Real-time live scores for football, tennis, basketball, cricket, rugby and more. In-play tips updated every minute on Betcheza.',
    url: `${BASE_URL}/live`,
    type: 'website',
    siteName: 'Betcheza',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Live Scores — Football, Tennis, Basketball & More | Betcheza',
    description: 'Real-time live scores and in-play betting tips for all major sports. Updated every minute.',
  },
  alternates: { canonical: `${BASE_URL}/live` },
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

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
