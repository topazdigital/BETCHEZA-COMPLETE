import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SUPPORTED_BOOKMAKERS } from '@/lib/jackpot-types';
import JackpotTypeClient from './client';

interface Props { params: Promise<{ bookmaker: string; jackpotType: string }>; }

function slugToTitle(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function titleToSlug(title: string): string {
  return title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

const GAME_COUNTS: Record<string, Record<string, number>> = {
  sportpesa: { 'mega-jackpot': 17, 'midweek-jackpot': 17 },
  betika: { 'grand-jackpot': 17, 'midweek-jackpot': 17, 'daily-jackpot': 15 },
  odibets: { 'jackpot-bonanza': 13 },
  betin: { 'grand-jackpot': 13, 'midweek-jackpot': 13 },
  mozzartbet: { 'mega-jackpot': 15, 'midweek-jackpot': 15 },
};

const PRIZE_AMOUNTS: Record<string, Record<string, string>> = {
  sportpesa: { 'mega-jackpot': 'KES 100M+', 'midweek-jackpot': 'KES 15M+' },
  betika: { 'grand-jackpot': 'KES 12M+', 'midweek-jackpot': 'KES 5M+', 'daily-jackpot': 'KES 1M+' },
  odibets: { 'jackpot-bonanza': 'KES 10M+' },
  betin: { 'grand-jackpot': 'KES 8M+', 'midweek-jackpot': 'KES 3M+' },
  mozzartbet: { 'mega-jackpot': 'KES 10M+', 'midweek-jackpot': 'KES 3M+' },
};

function buildKeywords(bkName: string, typeTitle: string, typeSlug: string, bkSlug: string, gameCount: number): string[] {
  const base = `${bkName} ${typeTitle}`;
  const kw: string[] = [
    base,
    `${base} prediction`,
    `${base} predictions`,
    `${base} predictions today`,
    `${base} tips`,
    `${base} tips today`,
    `${base} prediction today`,
    `${base} free tips`,
    `${base} free prediction`,
    `${base} analysis`,
    `${base} banker`,
    `${base} jackpot prediction`,
    `${base} prediction ${gameCount} games`,
    `${typeTitle} prediction ${gameCount} games`,
    `${typeTitle} predictions today`,
    `${typeTitle} tips today`,
    `${typeTitle} prediction today Kenya`,
    `${typeTitle} free prediction Kenya`,
    `${typeTitle} prediction Kenya`,
    `${base} results`,
    `${base} winning combination`,
    `${base} prediction this week`,
    `${base} prediction weekend`,
    `${base} games today`,
    `${base} games this week`,
    `${base} prediction ${gameCount} games Kenya`,
    `how to win ${base}`,
    `how to win ${bkName} jackpot Kenya`,
    `${bkName} jackpot prediction free`,
    `${bkName} jackpot tips free Kenya`,
    `${bkName} jackpot analysis Kenya`,
    `${bkName} jackpot banker today`,
    `${bkName} jackpot games today`,
    `${bkName} jackpot prediction today`,
    `${bkName} jackpot this week prediction`,
    `${bkName} jackpot ${gameCount} games prediction`,
    `Kenya jackpot predictions today`,
    `jackpot predictions today Kenya`,
    `free jackpot tips Kenya`,
    `jackpot tips Kenya free`,
    `AI jackpot tips Kenya`,
    `sure jackpot prediction Kenya`,
    `best jackpot predictions Kenya`,
    `jackpot analysis Kenya`,
    `jackpot free picks Kenya`,
    `winning jackpot tips Kenya`,
    `Betcheza ${bkName} jackpot`,
    `Betcheza jackpot prediction`,
  ];
  return kw;
}

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export function generateStaticParams() { return []; }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { bookmaker: bkSlug, jackpotType: typeSlug } = await params;
  const bk = SUPPORTED_BOOKMAKERS.find(b => b.slug === bkSlug);
  if (!bk) return { title: 'Jackpot Predictions | Betcheza' };

  const typeTitle = slugToTitle(typeSlug);
  const matchedType = bk.jackpotTypes.find(t => titleToSlug(t) === typeSlug);
  if (!matchedType) return { title: `${bk.name} Jackpot Predictions | Betcheza` };

  const gameCount = GAME_COUNTS[bkSlug]?.[typeSlug] ?? 17;
  const prize = PRIZE_AMOUNTS[bkSlug]?.[typeSlug] ?? 'KES 10M+';
  const base = `${bk.name} ${typeTitle}`;

  const title = `${base} Prediction Today - ${gameCount} Games | Free AI Tips Kenya`;
  const description = `Free AI-powered ${base} predictions for Kenya. Get expert ${gameCount}-game jackpot tips with confidence ratings updated daily. Win ${prize} — free picks for ${base} this week on Betcheza.co.ke!`;

  return {
    title,
    description,
    keywords: buildKeywords(bk.name, typeTitle, typeSlug, bkSlug, gameCount),
    openGraph: {
      title: `${base} Prediction Today | Betcheza Kenya`,
      description,
      url: `https://betcheza.co.ke/jackpots/${bkSlug}/${typeSlug}`,
      type: 'website',
      siteName: 'Betcheza',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${base} Prediction Today | Betcheza`,
      description,
    },
    alternates: { canonical: `https://betcheza.co.ke/jackpots/${bkSlug}/${typeSlug}` },
    robots: { index: true, follow: true },
  };
}

export default async function JackpotTypePage({ params }: Props) {
  const { bookmaker: bkSlug, jackpotType: typeSlug } = await params;
  const bk = SUPPORTED_BOOKMAKERS.find(b => b.slug === bkSlug);
  if (!bk) notFound();

  const typeTitle = slugToTitle(typeSlug);
  const matchedType = bk.jackpotTypes.find(t => titleToSlug(t) === typeSlug);
  if (!matchedType) notFound();

  const gameCount = GAME_COUNTS[bkSlug]?.[typeSlug] ?? 17;
  const prize = PRIZE_AMOUNTS[bkSlug]?.[typeSlug] ?? 'KES 10M+';
  const base = `${bk.name} ${typeTitle}`;
  const canonical = `https://betcheza.co.ke/jackpots/${bkSlug}/${typeSlug}`;
  const baseUrl = 'https://betcheza.co.ke';

  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': canonical,
    name: `${base} Prediction Today`,
    description: `Free AI predictions for the ${base} in Kenya. ${gameCount}-game jackpot tips with confidence ratings updated daily.`,
    url: canonical,
    publisher: { '@type': 'Organization', name: 'Betcheza', url: baseUrl },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
        { '@type': 'ListItem', position: 2, name: 'Jackpots', item: `${baseUrl}/jackpots` },
        { '@type': 'ListItem', position: 3, name: `${bk.name} Jackpot`, item: `${baseUrl}/jackpots/${bkSlug}` },
        { '@type': 'ListItem', position: 4, name: `${typeTitle}`, item: canonical },
      ],
    },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `How many games are in the ${base}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `The ${base} has ${gameCount} games. You need to correctly predict the outcome of all ${gameCount} matches to win the jackpot prize. Betcheza provides AI predictions for all ${gameCount} games.`,
        },
      },
      {
        '@type': 'Question',
        name: `What is the ${base} prize this week?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `The ${base} prize pool is ${prize}. Check betcheza.co.ke/jackpots/${bkSlug}/${typeSlug} for the current jackpot amount and our AI predictions for all ${gameCount} games.`,
        },
      },
      {
        '@type': 'Question',
        name: `When are ${base} predictions published?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Betcheza publishes ${base} AI predictions as soon as the jackpot games are released by ${bk.name}. All ${gameCount} games are covered with confidence ratings and double-chance tips.`,
        },
      },
      {
        '@type': 'Question',
        name: `Are the ${base} predictions free?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Yes. All ${base} predictions on Betcheza are 100% free. You can view all ${gameCount} game picks, confidence ratings, and AI reasoning without any subscription.`,
        },
      },
      {
        '@type': 'Question',
        name: `How accurate are Betcheza's ${base} predictions?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Betcheza's AI analyzes team form, head-to-head records, home/away stats, goals scored and conceded, and current odds to generate predictions. Each of the ${gameCount} games shows a confidence percentage so you can identify the banker picks.`,
        },
      },
      {
        '@type': 'Question',
        name: `What is the ${base} deadline?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `The ${base} deadline is shown on Betcheza's jackpot page with a live countdown. You must submit your picks before the first game kicks off. Visit betcheza.co.ke/jackpots/${bkSlug}/${typeSlug} for the current deadline.`,
        },
      },
    ],
  };

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${base} Prediction Today — ${gameCount} Games Free AI Tips`,
    description: `Free AI-powered ${base} predictions for Kenya. Get expert ${gameCount}-game jackpot tips with confidence ratings, banker picks, and double-chance suggestions updated daily.`,
    url: canonical,
    datePublished: new Date().toISOString().split('T')[0],
    dateModified: new Date().toISOString(),
    author: { '@type': 'Organization', name: 'Betcheza', url: baseUrl },
    publisher: {
      '@type': 'Organization',
      name: 'Betcheza',
      url: baseUrl,
      logo: { '@type': 'ImageObject', url: `${baseUrl}/logo.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <JackpotTypeClient
        bookmaker={bk}
        jackpotTypeSlug={typeSlug}
        jackpotTypeTitle={matchedType}
        gameCount={gameCount}
        prize={prize}
      />
    </>
  );
}
