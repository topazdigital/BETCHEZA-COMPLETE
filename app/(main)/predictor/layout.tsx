import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Football Predictor | Free Match Predictions Kenya | Betcheza',
  description: 'Free AI-powered football predictions for today\'s matches. Get accurate win probability, correct score predictions and betting tips for SportPesa, Betika and all Kenyan bookmakers.',
  keywords: [
    'AI football predictor Kenya', 'free football predictions today', 'football prediction AI',
    'match prediction tool Kenya', 'AI betting tips Kenya', 'football win probability',
    'correct score prediction AI', 'AI sports predictor Kenya', 'free match predictions Kenya',
    'AI SportPesa tips', 'machine learning football tips', 'best football predictor Kenya',
    'AI betting predictions Africa', 'football probability calculator Kenya',
  ],
  openGraph: {
    title: 'AI Football Predictor | Free Predictions | Betcheza Kenya',
    description: 'Get free AI-powered match predictions for any football game. Win probability, correct scores and expert tips.',
    url: 'https://betcheza.co.ke/predictor',
    type: 'website',
    siteName: 'Betcheza',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Football Predictor | Betcheza Kenya',
    description: 'Free AI predictions for today\'s matches. Win probability and expert tips updated continuously.',
  },
  alternates: { canonical: 'https://betcheza.co.ke/predictor' },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
