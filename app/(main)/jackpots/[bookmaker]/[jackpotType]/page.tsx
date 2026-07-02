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
  sportpesa: { 'mega-jackpot': 17, 'midweek-jackpot': 13 },
  betika: { 'grand-jackpot': 17, 'midweek-jackpot': 13, 'daily-jackpot': 5, 'laki-tatu': 3 },
  odibets: { 'jackpot-bonanza': 10 },
  betin: { 'grand-jackpot': 13, 'midweek-jackpot': 10 },
  mozzartbet: { 'mega-jackpot': 13, 'midweek-jackpot': 10 },
  bahatibet: { 'daily-jackpot': 10 },
  betlion: { 'super-jackpot': 13 },
  sportybet: { 'daily-jackpot': 10 },
  msport: { 'jackpot': 10 },
  bangbet: { 'jackpot': 10 },
  shabiki: { 'pool-jackpot': 13 },
};

const PRIZE_AMOUNTS: Record<string, Record<string, string>> = {
  sportpesa: { 'mega-jackpot': 'KES 100M+', 'midweek-jackpot': 'KES 15M+' },
  betika: { 'grand-jackpot': 'KES 12M+', 'midweek-jackpot': 'KES 5M+', 'daily-jackpot': 'KES 1M+', 'laki-tatu': 'KES 300K+' },
  odibets: { 'jackpot-bonanza': 'KES 10M+' },
  betin: { 'grand-jackpot': 'KES 8M+', 'midweek-jackpot': 'KES 3M+' },
  mozzartbet: { 'mega-jackpot': 'KES 10M+', 'midweek-jackpot': 'KES 3M+' },
  bahatibet: { 'daily-jackpot': 'KES 1M+' },
  betlion: { 'super-jackpot': 'KES 5M+' },
  sportybet: { 'daily-jackpot': 'KES 1M+' },
  msport: { 'jackpot': 'KES 2M+' },
  bangbet: { 'jackpot': 'KES 1M+' },
  shabiki: { 'pool-jackpot': 'KES 5M+' },
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

      {/* ── Server-rendered SEO block — visible to Google on first crawl ── */}
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-0 space-y-4">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap" aria-label="Breadcrumb">
          <a href="/" className="hover:text-foreground transition-colors">Home</a>
          <span>/</span>
          <a href="/jackpots" className="hover:text-foreground transition-colors">Jackpots</a>
          <span>/</span>
          <a href={`/jackpots/${bkSlug}`} className="hover:text-foreground transition-colors">{bk.name}</a>
          <span>/</span>
          <span className="text-foreground font-medium">{typeTitle}</span>
        </nav>

        {/* H1 + hero stats */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">
            {base} Prediction Today
            <span className="block text-sm font-normal text-muted-foreground mt-1">
              Free AI-powered {gameCount}-game jackpot tips — updated daily on Betcheza
            </span>
          </h1>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-lg bg-muted/50 border border-border px-4 py-2 text-center min-w-[90px]">
              <p className="text-xl font-extrabold text-foreground">{gameCount}</p>
              <p className="text-[11px] text-muted-foreground">Games</p>
            </div>
            <div className="rounded-lg bg-muted/50 border border-border px-4 py-2 text-center min-w-[90px]">
              <p className="text-xl font-extrabold text-green-600">{prize}</p>
              <p className="text-[11px] text-muted-foreground">Prize Pool</p>
            </div>
            <div className="rounded-lg bg-muted/50 border border-border px-4 py-2 text-center min-w-[90px]">
              <p className="text-xl font-extrabold text-primary">Free</p>
              <p className="text-[11px] text-muted-foreground">All Picks</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            Betcheza publishes <strong>free {base} predictions</strong> for every round. Our AI analyses team form,
            head-to-head records, home/away statistics, and current odds to generate picks with confidence ratings for
            all <strong>{gameCount} games</strong>. Use the <strong>banker picks</strong> (high-confidence selections)
            to anchor your {base} slip and the double-chance tips for trickier fixtures.
          </p>
        </div>

        {/* SEO FAQ — crawlable text answering common queries */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-base font-bold">{base} — Frequently Asked Questions</h2>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-semibold text-foreground">How many games are in the {base}?</p>
              <p className="text-muted-foreground mt-0.5">
                The {base} has <strong>{gameCount} games</strong>. You must correctly predict the outcome of all {gameCount} matches to win the jackpot.
                Betcheza provides free AI predictions with confidence percentages for every single game.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">What is the {base} prize this week?</p>
              <p className="text-muted-foreground mt-0.5">
                The {base} prize pool is <strong>{prize}</strong>. The exact amount grows each week the jackpot is not won.
                Visit <a href={canonical} className="text-primary hover:underline">betcheza.co.ke/jackpots/{bkSlug}/{typeSlug}</a> for the current prize displayed live on the jackpot card.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Are the {base} predictions free?</p>
              <p className="text-muted-foreground mt-0.5">
                Yes — 100% free. All {gameCount} game picks, confidence ratings, banker selections, and AI reasoning are visible
                on this page with no subscription or sign-up required.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">How do I win the {base}?</p>
              <p className="text-muted-foreground mt-0.5">
                Correctly predict all {gameCount} game outcomes on your {bk.name} slip. Focus your banker picks on the
                highest-confidence games shown above (80%+), and use double-chance options (1X, X2, 12) on the
                trickier fixtures. Betcheza&apos;s AI highlights which games are safest each round.
              </p>
            </div>
          </div>
        </div>

      </div>
      {/* ── End SEO block ── */}

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
