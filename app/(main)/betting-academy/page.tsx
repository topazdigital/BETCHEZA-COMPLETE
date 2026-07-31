import type { Metadata } from 'next';
import BettingAcademyPage from './BettingAcademyPage';

export const metadata: Metadata = {
  title: 'Betting Academy — Learn All Betting Markets & Odds | Betcheza',
  description:
    'Master sports betting with Betcheza\'s free Betting Academy. Learn every betting market — 1X2, Over/Under, BTTS, Asian Handicap, Correct Score, Accumulators, Double Chance and more. Plain-English guides for all skill levels.',
  keywords: [
    'betting academy',
    'how to bet on sports',
    'sports betting guide kenya',
    'betting markets explained',
    'what is 1X2 betting',
    'over under betting explained',
    'BTTS meaning',
    'asian handicap explained',
    'correct score betting',
    'accumulator bet guide',
    'double chance betting',
    'both teams to score',
    'betting odds explained',
    'how to read odds',
    'sports betting tutorial',
    'football betting guide',
    'value betting explained',
    'handicap betting kenya',
    'betting tips for beginners',
    'betcheza academy',
  ],
  openGraph: {
    title: 'Betting Academy — Learn Every Betting Market | Betcheza',
    description:
      'Free comprehensive guide to sports betting markets. From 1X2 basics to advanced handicap markets — everything explained in plain English.',
    url: 'https://betcheza.co.ke/betting-academy',
    siteName: 'Betcheza',
    locale: 'en_KE',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Betting Academy — Learn Every Betting Market | Betcheza',
    description:
      'Free sports betting guide covering all markets: 1X2, BTTS, Over/Under, Handicap, Correct Score, Accumulators and more.',
  },
  alternates: {
    canonical: 'https://betcheza.co.ke/betting-academy',
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

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'What is 1X2 betting?', acceptedAnswer: { '@type': 'Answer', text: '1X2 is a three-way match result market where 1=Home win, X=Draw, 2=Away win, settled on 90 minutes.' } },
    { '@type': 'Question', name: 'What does BTTS mean in betting?', acceptedAnswer: { '@type': 'Answer', text: 'BTTS stands for Both Teams To Score. BTTS Yes means both teams score at least one goal each; BTTS No means at least one team fails to score.' } },
    { '@type': 'Question', name: 'What is Over/Under 2.5 goals?', acceptedAnswer: { '@type': 'Answer', text: 'Over 2.5 goals means the match must have 3 or more total goals. Under 2.5 means 2 or fewer goals.' } },
    { '@type': 'Question', name: 'What is Asian Handicap?', acceptedAnswer: { '@type': 'Answer', text: 'Asian Handicap eliminates the draw by giving one team a virtual head start or deficit, creating a two-way market with better odds.' } },
    { '@type': 'Question', name: 'What is Double Chance betting?', acceptedAnswer: { '@type': 'Answer', text: 'Double Chance covers two of three possible match outcomes: 1X (Home or Draw), X2 (Away or Draw), or 12 (Home or Away win).' } },
    { '@type': 'Question', name: 'What is an accumulator bet?', acceptedAnswer: { '@type': 'Answer', text: 'An accumulator combines multiple selections where all must win. The odds multiply together — higher reward but all legs must be correct.' } },
    { '@type': 'Question', name: 'What is Draw No Bet?', acceptedAnswer: { '@type': 'Answer', text: 'Draw No Bet (DNB) refunds your stake if the match ends in a draw. You only lose if your chosen team loses.' } },
    { '@type': 'Question', name: 'How do I calculate implied probability from odds?', acceptedAnswer: { '@type': 'Answer', text: 'Implied probability = 1 ÷ decimal odds × 100. E.g. odds of 2.00 imply a 50% probability.' } },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BettingAcademyPage />
    </>
  );
}
