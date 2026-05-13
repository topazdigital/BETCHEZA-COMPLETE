import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Football Results Today | Yesterday\'s Scores & Tips | Betcheza Kenya',
  description: 'Today and yesterday\'s football results with final scores, match stats and tipster outcomes. Check Premier League, Champions League, Kenya Premier League and all major league results.',
  keywords: [
    'football results today Kenya', 'yesterday football results', 'football scores today',
    'Premier League results today', 'Champions League results', 'Kenya Premier League results',
    'football final scores Kenya', 'SportPesa results today', 'Betika tips results',
    'football match results today', 'La Liga results', 'Bundesliga results today',
    'football tips results today', 'betting tips results Kenya',
  ],
  openGraph: {
    title: 'Football Results Today & Yesterday | Betcheza Kenya',
    description: 'Full-time results and scores from all major football leagues. Check how tips performed today.',
    url: 'https://betcheza.co.ke/results',
    type: 'website',
    siteName: 'Betcheza',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Football Results Today | Betcheza Kenya',
    description: 'Today\'s and yesterday\'s football results from all major leagues.',
  },
  alternates: { canonical: 'https://betcheza.co.ke/results' },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
