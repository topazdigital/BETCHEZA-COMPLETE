import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { SUPPORTED_BOOKMAKERS } from '@/lib/jackpot-types';
import BookmakerJackpotClient from './client';

interface Props { params: Promise<{ bookmaker: string }>; }

function titleToSlug(title: string): string {
  return title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

const GAME_COUNTS: Record<string, Record<string, number>> = {
  sportpesa: { 'Mega Jackpot': 17, 'Midweek Jackpot': 17 },
  betika: { 'Grand Jackpot': 17, 'Midweek Jackpot': 17, 'Daily Jackpot': 15 },
  odibets: { 'Jackpot Bonanza': 13 },
  betin: { 'Grand Jackpot': 13, 'Midweek Jackpot': 13 },
  mozzartbet: { 'Mega Jackpot': 15, 'Midweek Jackpot': 15 },
};

const EXTRA_KEYWORDS: Record<string, string[]> = {
  sportpesa: [
    'SportPesa Mega Jackpot predictions',
    'SportPesa Mega Jackpot tips today',
    'SportPesa Mega Jackpot this week',
    'SportPesa Mega Jackpot prediction 17 games',
    'SportPesa Mega Jackpot prediction today 17 games',
    'mega jackpot prediction 17 games',
    'mega jackpot 17 games prediction',
    'SportPesa Midweek Jackpot predictions',
    'SportPesa Midweek Jackpot tips',
    'SportPesa Midweek Jackpot prediction today',
    'SportPesa Midweek Jackpot 17 games',
    'SportPesa jackpot bonus',
    'SportPesa jackpot analysis',
    'SportPesa jackpot games today',
    'SportPesa jackpot games this week',
    'how to win SportPesa Mega Jackpot Kenya',
    'how to win SportPesa jackpot Kenya',
    'SportPesa jackpot predictions free',
    'SportPesa jackpot banker today',
    'SportPesa jackpot prediction weekend',
    'SportPesa jackpot tips this week',
    'mega jackpot prediction Kenya',
    'mega jackpot tips today',
    'mega jackpot banker Kenya',
    'SportPesa mega jackpot prediction today free',
    'sportpesa jackpot prediction today',
    'sportpesa jackpot today tips',
    'sportpesa jackpot today prediction free',
  ],
  betika: [
    'Betika Grand Jackpot predictions',
    'Betika Grand Jackpot tips today',
    'Betika Grand Jackpot prediction today',
    'Betika Grand Jackpot 17 games',
    'Betika Midweek Jackpot tips',
    'Betika Midweek Jackpot prediction today',
    'Betika Daily Jackpot predictions',
    'Betika jackpot bonus',
    'how to win Betika jackpot',
    'Betika jackpot analysis Kenya',
    'Betika jackpot banker today',
    'Betika jackpot games today',
    'Betika Grand Jackpot banker',
    'Betika jackpot prediction free',
    'Betika jackpot today tips Kenya',
  ],
  odibets: [
    'OdiBets Jackpot Bonanza predictions',
    'OdiBets jackpot tips today',
    'OdiBets jackpot analysis Kenya',
    'how to win OdiBets jackpot',
    'OdiBets jackpot prediction free',
    'OdiBets jackpot banker today',
    'OdiBets jackpot games today',
    'odibets jackpot prediction Kenya',
    'odibets predictions today',
    'odibets jackpot today',
  ],
  betin: [
    'Betin Grand Jackpot predictions Kenya',
    'Betin Midweek Jackpot tips',
    'Betin jackpot bonus',
    'Betin Kenya jackpot analysis',
    'Betin jackpot prediction today free',
    'Betin jackpot banker Kenya',
    'Betin jackpot prediction today',
  ],
  mozzartbet: [
    'Mozzartbet Mega Jackpot predictions',
    'Mozzartbet Midweek Jackpot tips Kenya',
    'Mozzartbet jackpot analysis',
    'how to win Mozzartbet jackpot',
    'Mozzartbet jackpot prediction free',
    'Mozzartbet jackpot today tips',
    'Mozzartbet jackpot banker Kenya',
    'mozzartbet jackpot prediction Kenya',
  ],
};

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export function generateStaticParams() { return []; }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { bookmaker: slug } = await params;
  const bk = SUPPORTED_BOOKMAKERS.find(b => b.slug === slug);
  if (!bk) return { title: 'Jackpots | Betcheza' };

  const types = bk.jackpotTypes.join(' & ');
  const gameCounts = bk.jackpotTypes.map(t => {
    const count = GAME_COUNTS[slug]?.[t];
    return count ? `${t} (${count} games)` : t;
  }).join(', ');
  const title = `${bk.name} Jackpot Predictions Today | ${types} Free AI Tips Kenya`;
  const description = `Free AI-powered ${bk.name} jackpot predictions for Kenya. Get expert ${gameCounts} tips with confidence ratings, banker picks and double-chance analysis — updated daily. Win big with Betcheza!`;
  const extraKw = EXTRA_KEYWORDS[slug] ?? [];

  return {
    title,
    description,
    keywords: [
      bk.name + ' jackpot',
      bk.name + ' jackpot predictions',
      bk.name + ' jackpot tips today',
      bk.name + ' jackpot predictions Kenya',
      bk.name + ' jackpot prediction today',
      bk.name + ' jackpot today',
      bk.name + ' jackpot today prediction free',
      bk.name + ' jackpot analysis',
      bk.name + ' jackpot banker',
      bk.name + ' jackpot free tips',
      ...bk.jackpotTypes.map(t => bk.name + ' ' + t),
      ...bk.jackpotTypes.map(t => bk.name + ' ' + t + ' prediction'),
      ...bk.jackpotTypes.map(t => bk.name + ' ' + t + ' predictions'),
      ...bk.jackpotTypes.map(t => bk.name + ' ' + t + ' tips today'),
      ...bk.jackpotTypes.map(t => bk.name + ' ' + t + ' prediction today'),
      ...bk.jackpotTypes.map(t => bk.name + ' ' + t + ' free tips'),
      ...bk.jackpotTypes.map(t => t + ' predictions'),
      ...bk.jackpotTypes.map(t => t + ' tips today'),
      ...bk.jackpotTypes.map(t => t + ' prediction today'),
      ...bk.jackpotTypes.map(t => t + ' Kenya'),
      ...extraKw,
      'Kenya jackpot predictions',
      'Kenya jackpot predictions today',
      'jackpot tips Kenya',
      'jackpot tips Kenya free',
      'free jackpot predictions Kenya',
      'sure jackpot prediction Kenya',
      'best jackpot predictions Kenya',
      'jackpot analysis Kenya',
      'jackpot banker Kenya',
      'AI jackpot tips Kenya',
      'Betcheza jackpot',
    ],
    openGraph: {
      title: `${bk.name} Jackpot Predictions Today | Betcheza Kenya`,
      description,
      url: 'https://betcheza.co.ke/jackpots/' + bk.slug,
      type: 'website',
      siteName: 'Betcheza',
    },
    twitter: { card: 'summary_large_image', title: `${bk.name} Jackpot Predictions | Betcheza Kenya`, description },
    alternates: { canonical: 'https://betcheza.co.ke/jackpots/' + bk.slug },
    robots: { index: true, follow: true },
  };
}

export default async function BookmakerJackpotPage({ params }: Props) {
  const { bookmaker: slug } = await params;
  const bk = SUPPORTED_BOOKMAKERS.find(b => b.slug === slug);
  if (!bk) notFound();

  const baseUrl = 'https://betcheza.co.ke';
  const canonical = `${baseUrl}/jackpots/${bk.slug}`;

  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': canonical,
    name: `${bk.name} Jackpot Predictions Today`,
    description: `Free AI predictions for ${bk.name} jackpots in Kenya — ${bk.jackpotTypes.join(', ')}.`,
    url: canonical,
    publisher: { '@type': 'Organization', name: 'Betcheza', url: baseUrl },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
        { '@type': 'ListItem', position: 2, name: 'Jackpots', item: `${baseUrl}/jackpots` },
        { '@type': 'ListItem', position: 3, name: `${bk.name} Jackpot`, item: canonical },
      ],
    },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      ...bk.jackpotTypes.map(type => {
        const count = GAME_COUNTS[slug]?.[type];
        return {
          '@type': 'Question',
          name: `When are ${bk.name} ${type} predictions published?`,
          acceptedAnswer: {
            '@type': 'Answer',
            text: `Betcheza publishes AI-powered ${bk.name} ${type} predictions as soon as the ${count ? count + ' games are' : 'games are'} released by the bookmaker. Check betcheza.co.ke/jackpots/${bk.slug} for the latest tips.`,
          },
        };
      }),
      ...bk.jackpotTypes.map(type => {
        const count = GAME_COUNTS[slug]?.[type];
        return {
          '@type': 'Question',
          name: `How many games are in the ${bk.name} ${type}?`,
          acceptedAnswer: {
            '@type': 'Answer',
            text: count
              ? `The ${bk.name} ${type} has ${count} games. You must correctly predict all ${count} outcomes to win the jackpot. Betcheza provides free AI predictions for all ${count} games with confidence ratings.`
              : `The ${bk.name} ${type} game count varies each round. Betcheza covers all games with free AI predictions and confidence ratings.`,
          },
        };
      }),
      {
        '@type': 'Question',
        name: `How accurate are ${bk.name} jackpot predictions on Betcheza?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Betcheza's AI analyses team form, head-to-head records, home/away statistics, goals scored and conceded, and current odds to generate predictions with confidence ratings. Each game shows a confidence score so you can identify banker picks.`,
        },
      },
      {
        '@type': 'Question',
        name: `Is the ${bk.name} jackpot prediction service free?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Yes. All ${bk.name} jackpot predictions on Betcheza are 100% free. No subscription required — all game picks, confidence ratings, and AI reasoning are visible to everyone.`,
        },
      },
      {
        '@type': 'Question',
        name: `How do I win the ${bk.name} jackpot?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `To win the ${bk.name} jackpot, correctly predict the outcome of all games in the jackpot slip. Use Betcheza's free AI predictions to identify high-confidence banker picks and consider double-chance options (1X, X2, 12) for uncertain matches.`,
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <BookmakerJackpotClient bookmaker={bk} />
      {/* SEO: individual jackpot type links rendered server-side for crawlers */}
      <div className="sr-only" aria-hidden="true">
        {bk.jackpotTypes.map(type => {
          const typeSlug = titleToSlug(type);
          return (
            <Link key={type} href={`/jackpots/${bk.slug}/${typeSlug}`}>
              {bk.name} {type} Prediction Today — Free AI Tips Kenya
            </Link>
          );
        })}
      </div>
    </>
  );
}
