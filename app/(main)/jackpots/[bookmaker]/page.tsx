import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SUPPORTED_BOOKMAKERS } from '@/lib/jackpot-types';
import BookmakerJackpotClient from './client';
interface Props { params: Promise<{ bookmaker: string }>; }
const EXTRA_KEYWORDS: Record<string, string[]> = {
  sportpesa: ['SportPesa Mega Jackpot predictions','SportPesa Mega Jackpot tips today','SportPesa Mega Jackpot this week','SportPesa Midweek Jackpot predictions','SportPesa Midweek Jackpot tips','SportPesa jackpot bonus','SportPesa jackpot analysis','SportPesa jackpot games today','how to win SportPesa jackpot Kenya','SportPesa jackpot predictions free'],
  betika: ['Betika Grand Jackpot predictions','Betika Grand Jackpot tips today','Betika Midweek Jackpot tips','Betika Daily Jackpot predictions','Betika jackpot bonus','how to win Betika jackpot','Betika jackpot analysis Kenya'],
  odibets: ['OdiBets Jackpot Bonanza predictions','OdiBets jackpot tips today','OdiBets jackpot analysis Kenya','how to win OdiBets jackpot'],
  betin: ['Betin Grand Jackpot predictions Kenya','Betin Midweek Jackpot tips','Betin jackpot bonus','Betin Kenya jackpot analysis'],
  mozzartbet: ['Mozzartbet Mega Jackpot predictions','Mozzartbet Midweek Jackpot tips Kenya','Mozzartbet jackpot analysis','how to win Mozzartbet jackpot'],
};
export function generateStaticParams() { return SUPPORTED_BOOKMAKERS.map(b => ({ bookmaker: b.slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { bookmaker: slug } = await params;
  const bk = SUPPORTED_BOOKMAKERS.find(b => b.slug === slug);
  if (!bk) return { title: 'Jackpots | Betcheza' };
  const types = bk.jackpotTypes.join(' & ');
  const title = bk.name + ' Jackpot Predictions Today | Free AI Tips — Betcheza Kenya';
  const description = 'Free AI-powered ' + bk.name + ' jackpot predictions for Kenya. Get expert ' + types + ' tips with confidence ratings, updated daily. Win big with Betcheza.co.ke!';
  const extraKw = EXTRA_KEYWORDS[slug] ?? [];
  return { title, description,
    keywords: [bk.name+' jackpot',bk.name+' jackpot predictions',bk.name+' jackpot tips today',bk.name+' jackpot predictions Kenya',...bk.jackpotTypes.map(t=>bk.name+' '+t),...bk.jackpotTypes.map(t=>t+' predictions'),...bk.jackpotTypes.map(t=>t+' tips today'),...extraKw,'Kenya jackpot predictions','jackpot tips Kenya','free jackpot predictions','Betcheza jackpot'],
    openGraph: { title: bk.name+' Jackpot Predictions Today | Betcheza', description, url: 'https://betcheza.co.ke/jackpots/'+bk.slug, type: 'website', siteName: 'Betcheza' },
    twitter: { card: 'summary_large_image', title: bk.name+' Jackpot Predictions | Betcheza Kenya', description },
    alternates: { canonical: 'https://betcheza.co.ke/jackpots/'+bk.slug },
    robots: { index: true, follow: true },
  };
}
export default async function BookmakerJackpotPage({ params }: Props) {
  const { bookmaker: slug } = await params;
  const bk = SUPPORTED_BOOKMAKERS.find(b => b.slug === slug);
  if (!bk) notFound();

  const baseUrl = 'https://betcheza.co.ke';
  const canonical = `${baseUrl}/jackpots/${bk.slug}`;

  // WebPage + BreadcrumbList (top-level — not nested inside each other)
  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': canonical,
    name: `${bk.name} Jackpot Predictions`,
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

  // FAQPage must be top-level (not nested) for Google to show FAQ rich results
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      ...bk.jackpotTypes.map(type => ({
        '@type': 'Question',
        name: `When are ${bk.name} ${type} predictions published?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Betcheza publishes AI-powered ${bk.name} ${type} predictions as soon as the games are released by the bookmaker. Check betcheza.co.ke/jackpots/${bk.slug} for the latest tips.`,
        },
      })),
      {
        '@type': 'Question',
        name: `How accurate are the ${bk.name} jackpot predictions?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Betcheza's AI analyzes form, head-to-head records, team statistics and odds to generate predictions with confidence ratings. Each game shows a confidence score so you can identify the banker picks.`,
        },
      },
      {
        '@type': 'Question',
        name: `Is the ${bk.name} jackpot prediction service free?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Yes. All ${bk.name} jackpot predictions on Betcheza are 100% free. Create a free account to save your picks and track your prediction history.`,
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <BookmakerJackpotClient bookmaker={bk} />
    </>
  );
}
