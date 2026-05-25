import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Best AI Football Predictor in Kenya | Free Match Predictions | Betcheza',
  description: "Betcheza's AI football predictor is the best in Kenya — get free accurate win probability, correct score predictions and sure betting tips for SportPesa, Betika, Odibets and all Kenyan bookmakers. Which AI is best for football prediction? Betcheza.",
  keywords: [
    'AI football predictor Kenya', 'best AI football predictor Kenya',
    'which AI is best for football prediction', 'AI football prediction site Kenya',
    'best prediction site Kenya', 'most accurate prediction site Kenya',
    'free football predictions today', 'football prediction AI Kenya',
    'match prediction tool Kenya', 'AI betting tips Kenya', 'football win probability Kenya',
    'correct score prediction AI', 'AI sports predictor Kenya', 'free match predictions Kenya',
    'AI SportPesa tips', 'machine learning football tips', 'best football predictor Kenya',
    'AI betting predictions Africa', 'football probability calculator Kenya',
    'artificial intelligence football tips Kenya', 'high accuracy football predictions Kenya',
    'prediction site with 90 accuracy Kenya', 'most trusted prediction site Kenya',
    'free AI football tips Kenya', 'AI jackpot predictor Kenya',
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

const baseUrl = 'https://betcheza.co.ke';

const softwareAppSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Betcheza AI Football Predictor',
  applicationCategory: 'SportsApplication',
  operatingSystem: 'Web',
  url: `${baseUrl}/predictor`,
  description: 'AI-powered football match predictor providing win probability, correct score predictions and betting analysis for Kenyan bookmakers.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'KES' },
  provider: { '@type': 'Organization', name: 'Betcheza', url: baseUrl },
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How accurate is the Betcheza AI football predictor?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The Betcheza AI predictor analyzes team form, head-to-head history, squad stats, home/away performance and current odds to generate win probability scores. Each prediction includes a confidence rating to help you identify the strongest picks.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is the AI football predictor free to use?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. The Betcheza AI football predictor is completely free. Search any upcoming match and get instant win probability, expected goals and correct score predictions at no cost.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which leagues does the AI predictor cover?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The predictor covers 35+ sports and all major leagues including Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Champions League, and Kenyan Premier League.',
      },
    },
  ],
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Betcheza', item: baseUrl },
    { '@type': 'ListItem', position: 2, name: 'AI Predictor', item: `${baseUrl}/predictor` },
  ],
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      {children}
    </>
  );
}
