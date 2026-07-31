import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink, TrendingUp, Zap, Shield, Trophy, Star, ChevronRight, Plane, Clock, DollarSign, Users, CheckCircle, AlertCircle, Target } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Aviator Game Kenya — Best Aviator Platforms, Strategy & Tricks | Betcheza',
  description:
    'Play Aviator in Kenya on the best platforms. Betcheza Aviator offers the highest multipliers, instant M-Pesa cashouts and proven crash game strategies. Compare the top 6 Aviator sites in Kenya.',
  keywords: [
    // Aviator keywords
    'aviator game kenya',
    'aviator betting kenya',
    'aviator game tricks kenya',
    'aviator predictor kenya',
    'best aviator platform kenya',
    'aviator crash game kenya',
    'how to play aviator kenya',
    'aviator game strategy kenya',
    'aviator cash out strategy',
    'aviator multiplier tricks',
    'aviator game sportpesa',
    'aviator game betika',
    'aviator 1xbet kenya',
    'aviator betway kenya',
    'aviator odibets kenya',
    'betcheza aviator',
    'aviator.betcheza.co.ke',
    'aviator game how to win kenya',
    'aviator game tips and tricks',
    'aviator signal kenya',
    'spribe aviator kenya',
    'aviator game deposit mpesa',
    'aviator game withdrawal mpesa',
    'aviator game provably fair',
    'best aviator site kenya',
    'aviator 2x strategy',
    'aviator martingale kenya',
    // Crash game keywords
    'crash game kenya',
    'crash betting game kenya',
    'best crash game kenya',
    'crash game mpesa kenya',
    'crash betting site kenya',
    'crash multiplier game kenya',
    'online crash game kenya',
    'crash game cash out strategy',
    'crash game how to win kenya',
    'PantaneAX crash game',
    'PantaneAX betting',
    'crash game tips kenya',
    'crash game tricks kenya',
    'crash game predictor kenya',
    'crash game signal kenya',
    'crash gambling kenya',
    'crash game withdraw mpesa',
    'crash game 2x strategy kenya',
    'crash game provably fair kenya',
    'best crash betting platform kenya',
    'crash game for beginners kenya',
    'crash game bankroll management',
  ],
  openGraph: {
    title: 'Aviator Game Kenya — Best Platforms, Strategy & Tricks | Betcheza',
    description:
      'Kenya\'s top Aviator crash game hub. Play on Betcheza Aviator, compare platforms, and learn proven cash-out strategies.',
    url: 'https://betcheza.co.ke/aviator',
    siteName: 'Betcheza',
    locale: 'en_KE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aviator Game Kenya — Best Platforms & Strategy | Betcheza',
    description: 'Play Aviator in Kenya. Compare the best Aviator platforms and learn winning strategies.',
  },
  alternates: {
    canonical: 'https://betcheza.co.ke/aviator',
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

const gameAppJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Betcheza Aviator',
  url: 'https://aviator.betcheza.co.ke/',
  applicationCategory: 'GameApplication',
  operatingSystem: 'Any',
  description:
    'Betcheza Aviator is Kenya\'s premier crash game platform. Cash out before the plane flies away to multiply your stake.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'KES',
    availability: 'https://schema.org/InStock',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    reviewCount: '3241',
    bestRating: '5',
  },
  publisher: {
    '@type': 'Organization',
    name: 'Betcheza',
    url: 'https://betcheza.co.ke',
  },
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is the Aviator game in Kenya?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Aviator is a crash game by Spribe where a plane takes off and a multiplier grows from 1x upward. Players must cash out before the plane flies away — the longer you wait, the higher your potential winnings, but if the plane crashes before you cash out, you lose your stake.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which is the best Aviator platform in Kenya?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Betcheza Aviator (aviator.betcheza.co.ke) is rated the best Aviator platform in Kenya, offering instant M-Pesa deposits and withdrawals, provably fair gameplay, and fast payouts. Other top platforms include SportPesa, Betika, 1xBet, Betway, and Odibets.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the best Aviator strategy in Kenya?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The most popular Aviator strategies in Kenya are: (1) the 1.5x auto cash-out for low-risk consistent wins, (2) the 2x strategy that doubles your stake on a win, and (3) the martingale method where you double your bet after each loss. Always set a budget and stick to it.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I deposit with M-Pesa on Aviator?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Betcheza Aviator supports instant M-Pesa STK push deposits and withdrawals, with minimum deposit of KES 50. Other platforms like SportPesa and Betika also support M-Pesa.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is Aviator provably fair?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Aviator by Spribe uses provably fair technology — every round result is cryptographically verifiable by the player. No platform or operator can manipulate the outcome.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the highest Aviator multiplier ever recorded in Kenya?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Aviator multipliers can theoretically go infinite. Multipliers above 100x have been recorded on Kenyan platforms, though they are rare. Most rounds crash between 1x and 5x.',
      },
    },
  ],
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://betcheza.co.ke' },
    { '@type': 'ListItem', position: 2, name: 'Aviator Game Kenya', item: 'https://betcheza.co.ke/aviator' },
  ],
};

// ── Platform data ─────────────────────────────────────────────────────────────
const PLATFORMS = [
  {
    rank: 1,
    name: 'Betcheza Aviator',
    url: 'https://aviator.betcheza.co.ke/',
    badge: 'OUR #1 PICK',
    badgeColor: 'bg-orange-500',
    rating: 4.9,
    minDeposit: 'KES 50',
    maxMultiplier: '∞',
    mpesa: true,
    provablyFair: true,
    bonus: 'KES 100 signup bonus',
    highlight: true,
    pros: ['Instant M-Pesa in & out', 'Provably fair verified', 'Low KES 50 minimum', 'Fastest withdrawals in Kenya'],
    description: 'Built specifically for Kenyan players. Betcheza Aviator is the only platform with a dedicated crash game experience, instant M-Pesa cashouts, and a community of 50,000+ active players.',
  },
  {
    rank: 2,
    name: 'SportPesa Aviator',
    url: 'https://www.sportpesa.co.ke/',
    badge: '2nd',
    badgeColor: 'bg-slate-500',
    rating: 4.5,
    minDeposit: 'KES 100',
    maxMultiplier: '∞',
    mpesa: true,
    provablyFair: true,
    bonus: 'Welcome bonus available',
    highlight: false,
    pros: ['Trusted brand since 2014', 'High traffic game rounds', 'Good mobile experience'],
    description: 'Kenya\'s most established bookmaker now offers Aviator. Reliable platform with large player pools ensuring frequent round activity.',
  },
  {
    rank: 3,
    name: 'Betika Aviator',
    url: 'https://www.betika.com/',
    badge: '3rd',
    badgeColor: 'bg-slate-500',
    rating: 4.3,
    minDeposit: 'KES 49',
    maxMultiplier: '∞',
    mpesa: true,
    provablyFair: true,
    bonus: 'Up to 100% deposit bonus',
    highlight: false,
    pros: ['Low minimum deposit', 'Popular among Kenyans', 'Good odds platform'],
    description: 'Betika offers Aviator alongside their extensive sports betting. Popular with casual players due to the low KES 49 minimum bet.',
  },
  {
    rank: 4,
    name: '1xBet Aviator',
    url: 'https://1xbet.com/',
    badge: '4th',
    badgeColor: 'bg-slate-500',
    rating: 4.2,
    minDeposit: 'KES 100',
    maxMultiplier: '∞',
    mpesa: true,
    provablyFair: true,
    bonus: 'Up to KES 13,000 bonus',
    highlight: false,
    pros: ['Large international platform', 'High multipliers seen', 'Multiple payment methods'],
    description: '1xBet has one of the busiest Aviator rooms globally. International platform with high liquidity and frequent high-multiplier rounds.',
  },
  {
    rank: 5,
    name: 'Betway Aviator',
    url: 'https://betway.co.ke/',
    badge: '5th',
    badgeColor: 'bg-slate-500',
    rating: 4.1,
    minDeposit: 'KES 100',
    maxMultiplier: '∞',
    mpesa: true,
    provablyFair: true,
    bonus: 'Sports welcome bonus',
    highlight: false,
    pros: ['Reputable global brand', 'Smooth mobile app', 'Secure platform'],
    description: 'Betway Kenya\'s Aviator section is well-designed and accessible. Good for players who already use Betway for sports betting.',
  },
  {
    rank: 6,
    name: 'Odibets Aviator',
    url: 'https://www.odibets.com/',
    badge: '6th',
    badgeColor: 'bg-slate-500',
    rating: 3.9,
    minDeposit: 'KES 50',
    maxMultiplier: '∞',
    mpesa: true,
    provablyFair: true,
    bonus: 'Free bet on signup',
    highlight: false,
    pros: ['Very low minimum', 'Fast M-Pesa', 'Simple interface'],
    description: 'Odibets is a homegrown Kenyan platform with a straightforward Aviator game. Great for beginners with its simple interface.',
  },
];

const STRATEGIES = [
  {
    name: 'Auto Cash-Out at 1.5x',
    risk: 'Low',
    riskColor: 'text-green-500 bg-green-500/10 border-green-500/20',
    icon: Shield,
    iconColor: 'text-green-500',
    description: 'Set auto cash-out at 1.5x and keep bet size consistent. You win about 60% of rounds — slow and steady bankroll growth.',
    tip: 'Best for: beginners and players protecting a bankroll',
  },
  {
    name: '2x Auto Cash-Out',
    risk: 'Medium',
    riskColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    icon: Target,
    iconColor: 'text-amber-500',
    description: 'Cash out at exactly 2x every round. You double up roughly 50% of the time. Use fixed stakes — do not increase after a loss.',
    tip: 'Best for: steady players who want simple rules',
  },
  {
    name: 'Two-Bet Split',
    risk: 'Medium',
    riskColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    icon: Zap,
    iconColor: 'text-amber-500',
    description: 'Split your stake across two bets: one auto-cashes at 1.5x (safety), one you ride manually aiming for 5x+. One always covers the other.',
    tip: 'Best for: experienced players on platforms like Betcheza Aviator',
  },
  {
    name: 'High Multiplier Hunt',
    risk: 'High',
    riskColor: 'text-red-500 bg-red-500/10 border-red-500/20',
    icon: TrendingUp,
    iconColor: 'text-red-500',
    description: 'Small bets, wait for 10x+ rounds. Statistically a 10x multiplier appears roughly every 15–20 rounds. Requires patience and discipline.',
    tip: 'Best for: experienced players with larger bankrolls',
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${s <= Math.floor(rating) ? 'fill-amber-400 text-amber-400' : s - 0.5 <= rating ? 'fill-amber-400/50 text-amber-400' : 'text-muted-foreground/30'}`}
        />
      ))}
      <span className="ml-1 text-xs font-semibold text-muted-foreground">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function AviatorPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(gameAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <div className="min-h-screen bg-background">
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-orange-950 via-orange-900 to-slate-900 px-4 py-14 text-white">
          {/* Decorative grid */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(251,146,60,0.15),_transparent_60%)]" />
          <div className="relative mx-auto max-w-4xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-sm font-medium text-orange-300">
              <Plane className="h-4 w-4" />
              Aviator Game Kenya
            </div>
            <h1 className="mb-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              Best Aviator Platforms in Kenya —<br />
              <span className="text-orange-400">Play, Win & Cash Out Fast</span>
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-base text-orange-100/80 sm:text-lg">
              Kenya&apos;s most complete Aviator guide. Compare the top 6 platforms, learn proven cash-out strategies,
              and play directly on <strong className="text-white">Betcheza Aviator</strong> — rated #1 for instant M-Pesa payouts.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="https://aviator.betcheza.co.ke/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-7 py-3.5 text-base font-bold text-white shadow-lg transition hover:bg-orange-400 active:scale-95"
              >
                <Plane className="h-5 w-5" />
                Play Betcheza Aviator
                <ExternalLink className="h-4 w-4 opacity-70" />
              </Link>
              <a
                href="#platforms"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-7 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
              >
                Compare All Platforms
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>

            {/* Stats bar */}
            <div className="mt-10 grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
              {[
                { icon: Users, label: 'Active Players', value: '50K+' },
                { icon: Clock, label: 'Avg Withdrawal', value: '< 30s' },
                { icon: DollarSign, label: 'Min Deposit', value: 'KES 50' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex flex-col items-center py-4 px-2">
                  <Icon className="mb-1 h-5 w-5 text-orange-400" />
                  <span className="text-xl font-extrabold">{value}</span>
                  <span className="text-xs text-orange-100/60">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-4xl space-y-12 px-4 py-10">

          {/* ── What is Aviator ───────────────────────────────────────────────── */}
          <section>
            <h2 className="mb-4 text-2xl font-bold tracking-tight">What is the Aviator Game?</h2>
            <div className="rounded-2xl border bg-card p-6 text-sm leading-relaxed text-muted-foreground space-y-3">
              <p>
                <strong className="text-foreground">Aviator</strong> is a crash game developed by{' '}
                <strong className="text-foreground">Spribe</strong> and available on most major Kenyan betting platforms.
                A plane takes off and a multiplier starts at <strong className="text-foreground">1.00x</strong> and climbs rapidly.
                You must press <strong className="text-orange-500">Cash Out</strong> before the plane flies away — if you do, your stake is
                multiplied by whatever the current multiplier shows. If the plane crashes before you cash out, you lose your stake.
              </p>
              <p>
                Every round is <strong className="text-foreground">provably fair</strong> — the outcome is determined by a cryptographic
                hash before the round begins, so neither the platform nor any player can manipulate when the plane crashes. This makes
                Aviator one of the most transparent betting games available in Kenya.
              </p>
              <p>
                The game appeals to Kenyan bettors because it is <strong className="text-foreground">fast-paced</strong> (each round takes 10–30 seconds),
                supports <strong className="text-foreground">instant M-Pesa deposits and withdrawals</strong>, and has no minimum knowledge requirement —
                anyone can play from the first round.
              </p>
            </div>
          </section>

          {/* ── Platform Comparison ───────────────────────────────────────────── */}
          <section id="platforms">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Best Aviator Platforms in Kenya (2025)</h2>
              <span className="rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-500 border border-orange-500/20">Ranked by our experts</span>
            </div>
            <div className="space-y-4">
              {PLATFORMS.map((p) => (
                <div
                  key={p.name}
                  className={`relative overflow-hidden rounded-2xl border transition-shadow ${
                    p.highlight
                      ? 'border-orange-500/50 bg-gradient-to-r from-orange-950/40 via-card to-card shadow-lg shadow-orange-500/10'
                      : 'border-border bg-card'
                  }`}
                >
                  {p.highlight && (
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />
                  )}
                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {/* Rank badge */}
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black text-white ${p.rank === 1 ? 'bg-orange-500' : 'bg-muted-foreground/30'}`}>
                          #{p.rank}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-foreground">{p.name}</h3>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${p.badgeColor}`}>
                              {p.badge}
                            </span>
                          </div>
                          <StarRating rating={p.rating} />
                        </div>
                      </div>
                      <Link
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition active:scale-95 ${
                          p.highlight ? 'bg-orange-500 hover:bg-orange-400 shadow-md' : 'bg-slate-600 hover:bg-slate-500'
                        }`}
                      >
                        Play Now <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>

                    <p className="mt-3 text-sm text-muted-foreground">{p.description}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {[
                        { label: `Min ${p.minDeposit}`, ok: true },
                        { label: 'M-Pesa', ok: p.mpesa },
                        { label: 'Provably Fair', ok: p.provablyFair },
                        { label: p.bonus, ok: true },
                      ].map(({ label, ok }) => (
                        <span
                          key={label}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
                            ok
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'border-red-500/20 bg-red-500/10 text-red-500'
                          }`}
                        >
                          {ok ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                          {label}
                        </span>
                      ))}
                    </div>

                    {p.highlight && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {p.pros.map((pro) => (
                          <span key={pro} className="inline-flex items-center gap-1 text-xs text-orange-400">
                            <ChevronRight className="h-3 w-3" /> {pro}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── CTA Banner ────────────────────────────────────────────────────── */}
          <section className="rounded-2xl border border-orange-500/30 bg-gradient-to-r from-orange-950/50 via-orange-900/30 to-slate-900/50 p-7 text-center">
            <Plane className="mx-auto mb-3 h-10 w-10 text-orange-400" />
            <h2 className="mb-2 text-xl font-extrabold">Ready to Play Aviator?</h2>
            <p className="mb-5 text-sm text-muted-foreground">
              Betcheza Aviator is Kenya&apos;s #1 crash game. Instant M-Pesa, KES 50 minimum, provably fair.
            </p>
            <Link
              href="https://aviator.betcheza.co.ke/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-8 py-3.5 text-base font-bold text-white shadow-lg transition hover:bg-orange-400 active:scale-95"
            >
              <Plane className="h-5 w-5" />
              Go to Betcheza Aviator
              <ExternalLink className="h-4 w-4 opacity-70" />
            </Link>
          </section>

          {/* ── Strategies ───────────────────────────────────────────────────── */}
          <section id="strategy">
            <h2 className="mb-2 text-2xl font-bold tracking-tight">Aviator Strategies That Work in Kenya</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              No strategy guarantees wins — Aviator is a game of probability. These approaches help manage your bankroll and maximise entertainment value.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {STRATEGIES.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.name} className="rounded-2xl border bg-card p-5">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-muted`}>
                          <Icon className={`h-4 w-4 ${s.iconColor}`} />
                        </div>
                        <span className="font-bold text-foreground">{s.name}</span>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${s.riskColor}`}>
                        {s.risk} Risk
                      </span>
                    </div>
                    <p className="mb-2 text-sm text-muted-foreground">{s.description}</p>
                    <p className="text-xs text-muted-foreground/70 italic">{s.tip}</p>
                  </div>
                );
              })}
            </div>

            {/* Responsible gambling notice */}
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-700 dark:text-amber-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>Responsible Gambling:</strong> Aviator is entertainment, not a reliable income source. Always set a strict daily budget.
                Never chase losses. If gambling stops being fun,{' '}
                <Link href="/responsible-gambling" className="underline">visit our responsible gambling page</Link>.
              </span>
            </div>
          </section>

          {/* ── How to Play ───────────────────────────────────────────────────── */}
          <section id="how-to-play">
            <h2 className="mb-6 text-2xl font-bold tracking-tight">How to Play Aviator in Kenya — Step by Step</h2>
            <div className="space-y-3">
              {[
                { step: '1', title: 'Create your Betcheza account', desc: 'Sign up at aviator.betcheza.co.ke — takes under 2 minutes. Use your phone number and M-Pesa.' },
                { step: '2', title: 'Deposit via M-Pesa', desc: 'Click Deposit, enter your amount (minimum KES 50), and complete the M-Pesa STK push on your phone. Funds reflect instantly.' },
                { step: '3', title: 'Open the Aviator game', desc: 'Navigate to Aviator on the homepage. You\'ll see the runway, the multiplier counter, and your bet panels.' },
                { step: '4', title: 'Place your bet', desc: 'Enter your stake before the round starts. You can place two bets simultaneously (Bet 1 + Bet 2) with different strategies on each.' },
                { step: '5', title: 'Watch the multiplier and cash out', desc: 'Once the plane takes off, the multiplier climbs. Hit Cash Out at any time before the plane flies away to secure your winnings.' },
                { step: '6', title: 'Withdraw to M-Pesa', desc: 'Winnings land in your Betcheza wallet instantly. Click Withdraw and receive your M-Pesa within 30 seconds.' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex gap-4 rounded-xl border bg-card p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-extrabold text-white">
                    {step}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── FAQ ───────────────────────────────────────────────────────────── */}
          <section id="faq">
            <h2 className="mb-6 text-2xl font-bold tracking-tight">Aviator Kenya — Frequently Asked Questions</h2>
            <div className="space-y-3">
              {faqJsonLd.mainEntity.map((q) => (
                <details key={q.name} className="group rounded-xl border bg-card">
                  <summary className="flex cursor-pointer list-none items-center justify-between p-4 font-semibold text-foreground">
                    {q.name}
                    <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90 text-muted-foreground" />
                  </summary>
                  <div className="border-t px-4 pb-4 pt-3 text-sm text-muted-foreground leading-relaxed">
                    {q.acceptedAnswer.text}
                  </div>
                </details>
              ))}
            </div>
          </section>

          {/* ── More from Betcheza ────────────────────────────────────────────── */}
          <section>
            <h2 className="mb-4 text-lg font-bold">More from Betcheza</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { href: '/betting-academy/aviator', label: 'Aviator Strategy Guide', icon: Trophy, desc: 'Deep-dive on every strategy' },
                { href: '/tips', label: 'Sports Betting Tips', icon: TrendingUp, desc: 'Daily football predictions' },
                { href: '/predictor', label: 'AI Match Predictor', icon: Zap, desc: 'AI-powered match analysis' },
              ].map(({ href, label, icon: Icon, desc }) => (
                <Link key={href} href={href} className="rounded-xl border bg-card p-4 transition hover:border-orange-500/40 hover:bg-orange-500/5">
                  <Icon className="mb-2 h-5 w-5 text-orange-400" />
                  <p className="font-semibold text-foreground text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </Link>
              ))}
            </div>
          </section>

        </div>
      </div>
    </>
  );
}
