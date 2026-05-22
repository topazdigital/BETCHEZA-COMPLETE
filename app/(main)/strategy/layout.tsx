import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '3 Daily Sure Odds Strategy | Free Sure Odds Today | Daily Winning Tips | Betcheza',
  description: 'Get 3 sure odds daily with our proven 7-day compounding football betting strategy. Free sure odds today, daily football predictions, and AI-powered winning tips. Grow KES 1,000 to KES 108,000 in one week. Best free betting tips Kenya, SportPesa & Betika jackpot picks, and sure 3 odds accumulator — updated every day.',
  keywords: [
    '3 daily sure odds', '3 sure odds today', '3 odds today free', 'sure 3 odds daily',
    'sure 3 odds today free', 'free sure odds today', 'sure odds today', 'daily sure odds',
    '3 daily odds', '3 odds daily', 'sure odds', '3 odds strategy', 'daily 3 odds strategy',
    'compounding betting strategy', 'football betting strategy', 'bankroll management betting',
    'grow KES 1000 betting', 'betting bankroll growth Kenya', 'accumulator betting strategy',
    '7 day betting challenge', 'daily betting tips', 'daily football predictions',
    'football betting tips today', 'soccer predictions today', 'sure football predictions',
    'sure tips today', 'winning tips today', 'today football tips', 'best football predictions today',
    'free football tips today', 'free soccer predictions', 'correct score predictions',
    'over 2.5 goals tips', 'both teams to score tips', 'btts tips today',
    'daily football accumulator', 'accumulator tips today', 'multi bet tips', 'treble bet tips today',
    'sure bets today', 'daily sure bets', 'winning football tips', 'best daily football tips',
    'football predictions Kenya', 'sure odds Kenya', 'betting tips Kenya', 'sports betting Kenya',
    'SportPesa tips today', 'Betika tips today', 'mega jackpot predictions', 'jackpot tips today Kenya',
    'free betting tips Kenya', 'betcheza predictions', 'betcheza strategy', 'betcheza sure odds',
    '3 sure games today', '3 sure predictions today', 'AI football predictions today',
  ],
  openGraph: {
    title: '3 Daily Sure Odds Winning Strategy | Free Football Predictions | Betcheza',
    description: 'Proven 7-day compounding strategy with 3 daily sure odds. Grow KES 1,000 to KES 108,000 in one week. Free AI-powered football predictions and jackpot tips updated every day for Kenya, SportPesa, and Betika.',
    type: 'website',
    siteName: 'Betcheza',
    url: 'https://betcheza.co.ke/strategy',
  },
  twitter: {
    card: 'summary_large_image',
    title: '3 Daily Sure Odds Winning Strategy | Free Football Predictions | Betcheza',
    description: 'Proven 7-day compounding strategy with 3 daily sure odds. Free football tips updated daily — SportPesa, Betika, and jackpot predictions for Kenya.',
  },
  alternates: { canonical: 'https://betcheza.co.ke/strategy' },
  robots: { index: true, follow: true },
};

const baseUrl = 'https://betcheza.co.ke';

// HowTo schema — Google shows step-by-step cards in search results for strategy/tutorial pages
const howToSchema = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: '3 Daily Sure Odds — 7-Day Compounding Betting Strategy',
  description: 'A proven football betting strategy using 3 sure odds per day with compounding stakes. Grow KES 1,000 to over KES 100,000 in one week.',
  totalTime: 'P7D',
  supply: [{ '@type': 'HowToSupply', name: 'Starting bankroll: KES 1,000' }],
  tool: [{ '@type': 'HowToTool', name: 'Betcheza AI Predictor' }, { '@type': 'HowToTool', name: 'Any Kenyan bookmaker (SportPesa, Betika, Odibets)' }],
  step: [
    { '@type': 'HowToStep', position: 1, name: 'Day 1 — Stake KES 1,000', text: 'Pick 3 sure odds (combined ~3.0). Stake KES 1,000. Target win: KES 3,000. Use Betcheza daily picks for selection.' },
    { '@type': 'HowToStep', position: 2, name: 'Day 2 — Stake KES 1,500', text: 'Save KES 1,500 from Day 1 winnings. Stake KES 1,500 on 3 new sure odds. Target win: KES 4,500.' },
    { '@type': 'HowToStep', position: 3, name: 'Day 3 — Stake KES 2,500', text: 'Save KES 2,000. Stake KES 2,500. Target win: KES 7,500.' },
    { '@type': 'HowToStep', position: 4, name: 'Day 4 — Stake KES 5,000', text: 'Save KES 2,500. Stake KES 5,000. Target win: KES 15,000.' },
    { '@type': 'HowToStep', position: 5, name: 'Day 5 — Stake KES 10,000', text: 'Save KES 5,000. Stake KES 10,000. Target win: KES 30,000.' },
    { '@type': 'HowToStep', position: 6, name: 'Day 6 — Stake KES 20,000', text: 'Save KES 10,000. Stake KES 20,000. Target win: KES 60,000.' },
    { '@type': 'HowToStep', position: 7, name: 'Day 7 — Stake KES 36,000', text: 'Save KES 24,000. Stake KES 36,000. Target win: KES 108,000. Total savings for the week: KES 45,500+.' },
  ],
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What are the 3 sure odds today on Betcheza?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Betcheza publishes 3 AI-selected sure odds every day. These are low-risk picks with combined odds around 3.0, chosen from high-confidence matches across the day's fixtures. Visit betcheza.co.ke/strategy for today's free picks.",
      },
    },
    {
      '@type': 'Question',
      name: 'Can I really grow KES 1,000 to KES 108,000 in a week?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The 7-day compounding strategy is mathematically possible if all 3 daily picks win each day. The strategy includes a savings component each day so you never risk your full winnings. Past performance does not guarantee future results — always bet responsibly.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which bookmaker should I use for the 3 daily sure odds strategy?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The strategy works with any Kenyan bookmaker. SportPesa and Betika offer the best odds for accumulators in Kenya. Both accept M-Pesa and have mobile apps. Check the odds on both before placing your picks.',
      },
    },
  ],
};

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Betcheza', item: baseUrl },
    { '@type': 'ListItem', position: 2, name: '3 Daily Odds Strategy', item: `${baseUrl}/strategy` },
  ],
};

export default function StrategyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      {children}
    </>
  );
}
