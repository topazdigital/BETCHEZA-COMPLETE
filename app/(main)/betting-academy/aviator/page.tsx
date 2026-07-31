import type { Metadata } from 'next';
import Link from 'next/link';
import { Plane, TrendingUp, Shield, Target, Zap, AlertCircle, CheckCircle, ChevronRight, ExternalLink, BarChart2, Clock, DollarSign } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Aviator Game Strategy Guide Kenya — How to Win at Crash Games | Betcheza Academy',
  description:
    'Complete Aviator strategy guide for Kenyan players. Learn the 1.5x auto cash-out, two-bet split, martingale, and high-multiplier hunt strategies. Understand RTP, variance, and bankroll management for Aviator.',
  keywords: [
    'aviator game strategy kenya',
    'how to win aviator game',
    'aviator cash out strategy kenya',
    'aviator 1.5x strategy',
    'aviator 2x strategy kenya',
    'aviator martingale strategy',
    'aviator bankroll management',
    'aviator game tips kenya',
    'aviator probability explained',
    'aviator RTP kenya',
    'aviator game guide beginner',
    'how aviator multiplier works',
    'aviator two bet strategy',
    'aviator auto cashout strategy',
    'aviator spribe guide',
    'aviator game tricks',
    'best way to play aviator kenya',
    'aviator provably fair explained',
    // Crash game keywords
    'crash game strategy kenya',
    'crash betting strategy kenya',
    'crash game tips kenya',
    'crash game how to win kenya',
    'crash multiplier strategy kenya',
    'crash game bankroll management kenya',
    'crash game auto cashout strategy',
    'crash game 1.5x strategy',
    'crash game 2x strategy kenya',
    'crash game RTP explained',
    'crash game beginners guide kenya',
    'crash game tricks kenya',
    'how crash game works kenya',
    'PantaneAX strategy',
    'crash game cash out tips',
    'crash game probability kenya',
  ],
  openGraph: {
    title: 'Aviator Strategy Guide — How to Play Crash Games in Kenya | Betcheza',
    description: 'Master every Aviator cash-out strategy. Learn RTP, variance, and bankroll rules before you play.',
    url: 'https://betcheza.co.ke/betting-academy/aviator',
    siteName: 'Betcheza',
    locale: 'en_KE',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aviator Strategy Guide Kenya | Betcheza Academy',
    description: 'Complete crash game strategy guide for Kenyan players.',
  },
  alternates: {
    canonical: 'https://betcheza.co.ke/betting-academy/aviator',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large', 'max-video-preview': -1 },
  },
};

const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Aviator Game Strategy Guide Kenya — How to Win at Crash Games',
  description: 'Complete Aviator strategy guide for Kenyan players covering auto cash-out strategies, bankroll management, and RTP.',
  url: 'https://betcheza.co.ke/betting-academy/aviator',
  datePublished: '2025-07-01',
  dateModified: new Date().toISOString().split('T')[0],
  author: { '@type': 'Organization', name: 'Betcheza', url: 'https://betcheza.co.ke' },
  publisher: {
    '@type': 'Organization',
    name: 'Betcheza',
    url: 'https://betcheza.co.ke',
    logo: { '@type': 'ImageObject', url: 'https://betcheza.co.ke/logo.png' },
  },
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://betcheza.co.ke/betting-academy/aviator' },
};

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://betcheza.co.ke' },
    { '@type': 'ListItem', position: 2, name: 'Betting Academy', item: 'https://betcheza.co.ke/betting-academy' },
    { '@type': 'ListItem', position: 3, name: 'Aviator Strategy Guide', item: 'https://betcheza.co.ke/betting-academy/aviator' },
  ],
};

export default function AviatorAcademyPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-card px-4 py-8">
          <div className="mx-auto max-w-3xl">
            {/* Breadcrumb */}
            <nav className="mb-4 flex items-center gap-1 text-xs text-muted-foreground">
              <Link href="/betting-academy" className="hover:text-foreground transition-colors">Betting Academy</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-medium">Aviator Strategy Guide</span>
            </nav>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 border border-orange-500/20">
                <Plane className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-orange-500">Betting Academy</span>
                <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
                  Aviator Game Strategy Guide Kenya
                </h1>
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Everything you need to understand how Aviator works, which strategies Kenyan players use, 
              and how to manage your bankroll to play responsibly and get the most from every session.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {['Beginner-friendly', '~12 min read', 'Updated July 2025'].map((tag) => (
                <span key={tag} className="rounded-full border px-2.5 py-1 bg-muted">{tag}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-3xl space-y-10 px-4 py-10">

          {/* Table of contents */}
          <nav className="rounded-2xl border bg-card p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">In This Guide</p>
            <ol className="space-y-1.5 text-sm">
              {[
                ['#how-it-works', 'How Aviator Works'],
                ['#rtp', 'RTP and House Edge Explained'],
                ['#strategies', 'The 4 Main Strategies'],
                ['#bankroll', 'Bankroll Management Rules'],
                ['#auto-cashout', 'Setting Up Auto Cash-Out'],
                ['#mistakes', 'Common Mistakes Kenyan Players Make'],
                ['#play', 'Where to Play Aviator in Kenya'],
              ].map(([href, label]) => (
                <li key={href as string}>
                  <a href={href as string} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronRight className="h-3.5 w-3.5 text-orange-400" />
                    {label as string}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* How it works */}
          <section id="how-it-works">
            <h2 className="mb-4 text-xl font-bold">How Aviator Works</h2>
            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground space-y-3">
              <p>
                Aviator is a <strong className="text-foreground">crash game</strong> — a type of instant game where a multiplier
                grows from 1.00x upward and can crash at any random point. Players must click <strong className="text-foreground">Cash Out</strong> before
                the crash to secure their winnings.
              </p>
              <div className="rounded-xl border bg-muted/30 p-4 text-sm">
                <strong className="text-foreground block mb-2">The round lifecycle:</strong>
                <ol className="space-y-1.5 list-decimal list-inside">
                  <li>Betting phase opens (~5 seconds before takeoff)</li>
                  <li>Plane takes off — multiplier starts at 1.00x</li>
                  <li>Multiplier climbs at variable speed</li>
                  <li>Plane crashes at a random multiplier (could be 1.01x or 1,000x)</li>
                  <li>Anyone who didn&apos;t cash out loses their stake; those who did keep their winnings</li>
                </ol>
              </div>
              <p>
                The crash point is determined <strong className="text-foreground">before the round starts</strong> using a provably fair
                algorithm. Neither the platform nor any player can predict or manipulate it — you can verify every round&apos;s fairness
                using the hash shown after each game.
              </p>
            </div>
          </section>

          {/* RTP */}
          <section id="rtp">
            <h2 className="mb-4 text-xl font-bold">RTP and House Edge Explained</h2>
            <div className="rounded-xl border bg-card p-5 mb-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                {[
                  { label: 'Official RTP', value: '97%', note: 'Spribe standard', color: 'text-green-500' },
                  { label: 'House Edge', value: '3%', note: 'Per round average', color: 'text-amber-500' },
                  { label: 'Min Crash', value: '1.00x', note: 'Instant crash possible', color: 'text-red-500' },
                ].map(({ label, value, note, color }) => (
                  <div key={label}>
                    <div className={`text-2xl font-extrabold ${color}`}>{value}</div>
                    <div className="text-xs font-semibold text-foreground">{label}</div>
                    <div className="text-xs text-muted-foreground">{note}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-sm text-muted-foreground space-y-3">
              <p>
                Aviator&apos;s <strong className="text-foreground">97% RTP</strong> (Return to Player) means that over millions of rounds,
                the game pays back 97 KES for every 100 KES wagered. This is one of the <strong className="text-foreground">highest RTPs</strong> among
                casino-style games — better than roulette (94.7%) or most slots (94–96%).
              </p>
              <p>
                However, RTP applies across the long run. In a short session of 20–50 rounds, variance dominates — you can win or lose
                much more than 3%. This is why bankroll management (covered below) is critical.
              </p>
              <div className="flex items-start gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-600 dark:text-blue-400">
                <BarChart2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <strong>Crash distribution fact:</strong> About 50% of Aviator rounds crash below 2x. Around 10% reach 10x or higher.
                  Rounds above 100x occur roughly 1% of the time.
                </span>
              </div>
            </div>
          </section>

          {/* Strategies */}
          <section id="strategies">
            <h2 className="mb-4 text-xl font-bold">The 4 Main Aviator Strategies</h2>
            <div className="space-y-4">
              {/* Strategy 1 */}
              <div className="rounded-2xl border bg-card overflow-hidden">
                <div className="flex items-center justify-between border-b px-5 py-3 bg-green-500/5">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-green-500" />
                    <span className="font-bold text-foreground">Strategy 1: Auto Cash-Out at 1.5x</span>
                  </div>
                  <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-green-600">Low Risk</span>
                </div>
                <div className="p-5 text-sm text-muted-foreground space-y-2">
                  <p><strong className="text-foreground">How it works:</strong> Set auto cash-out at 1.5x before every round. Every time the plane reaches 1.5x, you win 50% of your stake. The plane reaches 1.5x in roughly 60% of rounds.</p>
                  <p><strong className="text-foreground">Example:</strong> KES 100 stake → win KES 50 on 6 rounds out of 10 (+KES 300), lose KES 100 on 4 rounds (−KES 400). Expected loss ~KES 100 per 10 rounds (house edge) — but your bankroll survives many more rounds than reckless play.</p>
                  <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs">
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
                    <span>Best for beginners. Set the auto cash-out, sit back, and let the algorithm run. No emotion involved.</span>
                  </div>
                </div>
              </div>

              {/* Strategy 2 */}
              <div className="rounded-2xl border bg-card overflow-hidden">
                <div className="flex items-center justify-between border-b px-5 py-3 bg-amber-500/5">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-amber-500" />
                    <span className="font-bold text-foreground">Strategy 2: Fixed 2x Cash-Out</span>
                  </div>
                  <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600">Medium Risk</span>
                </div>
                <div className="p-5 text-sm text-muted-foreground space-y-2">
                  <p><strong className="text-foreground">How it works:</strong> Auto cash-out at exactly 2x, every round, same stake. You double up ~50% of rounds. Keep stakes flat — never increase after a loss.</p>
                  <p><strong className="text-foreground">Why flat stakes matter:</strong> Doubling your bet after a loss (martingale) can work short-term but requires a very large bankroll to survive losing streaks. A 6-round losing streak on a KES 100 stake with martingale requires KES 6,400 to continue.</p>
                  <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs">
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span>Easy to execute. Set 2x auto cash-out, pick a stake you&apos;re comfortable losing 10 times in a row, and play.</span>
                  </div>
                </div>
              </div>

              {/* Strategy 3 */}
              <div className="rounded-2xl border bg-card overflow-hidden">
                <div className="flex items-center justify-between border-b px-5 py-3 bg-blue-500/5">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-blue-500" />
                    <span className="font-bold text-foreground">Strategy 3: Two-Bet Split (Betcheza Exclusive)</span>
                  </div>
                  <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-600">Medium Risk</span>
                </div>
                <div className="p-5 text-sm text-muted-foreground space-y-2">
                  <p><strong className="text-foreground">How it works:</strong> Platforms like <a href="https://aviator.betcheza.co.ke/" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">Betcheza Aviator</a> let you place two bets simultaneously. Split your total stake: 70% on Bet 1 auto cash-out at 1.5x (safety), 30% on Bet 2 that you ride manually aiming for 5x–10x.</p>
                  <p><strong className="text-foreground">Example:</strong> KES 100 total — KES 70 auto at 1.5x (wins KES 35 if reached), KES 30 riding manually. If the plane hits 5x, Bet 2 returns KES 150. Your Bet 1 likely covered you if the plane crashed between 1.5x and 5x.</p>
                  <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs">
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                    <span>This strategy is available on Betcheza Aviator, SportPesa, Betika and most major Kenyan platforms.</span>
                  </div>
                </div>
              </div>

              {/* Strategy 4 */}
              <div className="rounded-2xl border bg-card overflow-hidden">
                <div className="flex items-center justify-between border-b px-5 py-3 bg-red-500/5">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-red-500" />
                    <span className="font-bold text-foreground">Strategy 4: High Multiplier Hunting</span>
                  </div>
                  <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600">High Risk</span>
                </div>
                <div className="p-5 text-sm text-muted-foreground space-y-2">
                  <p><strong className="text-foreground">How it works:</strong> Use minimum or very small bets and wait for big multipliers (10x, 50x, 100x+). Cash out at a pre-set target and don&apos;t get greedy once you hit it.</p>
                  <p><strong className="text-foreground">The math:</strong> A 10x multiplier appears roughly once every 10 rounds. A 50x appears about once every 50 rounds. A 100x appears around 1% of the time. You need enough bankroll to absorb long losing streaks.</p>
                  <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-400">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>This strategy only works with strict discipline. Set your target multiplier before the round — do NOT change it once the plane is flying.</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Bankroll */}
          <section id="bankroll">
            <h2 className="mb-4 text-xl font-bold">Bankroll Management Rules</h2>
            <div className="rounded-2xl border bg-card p-5 space-y-3 text-sm text-muted-foreground">
              {[
                { icon: DollarSign, color: 'text-green-500', rule: 'Never stake more than 2–5% of your session bankroll on one round', detail: 'For a KES 1,000 session, maximum stake is KES 20–50 per round. This gives you 20–50 rounds to play.' },
                { icon: Clock, color: 'text-blue-500', rule: 'Set a session time limit AND a loss limit before you start', detail: 'Decide: "I will stop after 30 minutes or after losing KES 500, whichever comes first." Write it down. Stick to it.' },
                { icon: Target, color: 'text-amber-500', rule: 'Set a win target and stop when you hit it', detail: 'Many players lose their winnings chasing even more. Set a target (e.g. +KES 300) and withdraw when you hit it.' },
                { icon: AlertCircle, color: 'text-red-500', rule: 'Never chase losses', detail: 'Increasing your stake after a losing streak is the fastest way to empty your wallet. Each round is independent — the game has no memory.' },
              ].map(({ icon: Icon, color, rule, detail }) => (
                <div key={rule} className="flex gap-3">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
                  <div>
                    <p className="font-semibold text-foreground">{rule}</p>
                    <p className="mt-0.5 text-xs">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Auto cashout setup */}
          <section id="auto-cashout">
            <h2 className="mb-4 text-xl font-bold">Setting Up Auto Cash-Out on Betcheza Aviator</h2>
            <div className="text-sm text-muted-foreground space-y-3">
              <p>Auto cash-out removes emotion from the equation — the most common cause of Aviator losses.</p>
              <ol className="space-y-3">
                {[
                  'Open <a href="https://aviator.betcheza.co.ke/" target="_blank" rel="noopener noreferrer" class="text-orange-500 hover:underline">Betcheza Aviator</a> and navigate to the game.',
                  'In the Bet panel, toggle the <strong>Auto</strong> switch to ON.',
                  'Enter your desired cash-out multiplier in the Auto Cash Out field (e.g. 1.5, 2.0, 10.0).',
                  'Enter your stake amount and click BET.',
                  'The game will automatically cash out every time the multiplier reaches your target — no manual input needed.',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-extrabold text-white">
                      {i + 1}
                    </span>
                    <span dangerouslySetInnerHTML={{ __html: step }} />
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* Mistakes */}
          <section id="mistakes">
            <h2 className="mb-4 text-xl font-bold">Common Mistakes Kenyan Aviator Players Make</h2>
            <div className="space-y-2">
              {[
                { mistake: 'Waiting for a "pattern" or "signal"', fix: 'Each round is independent. There are no patterns, signals, or hacks that predict the crash point. Anyone selling "Aviator predictors" is scamming you.' },
                { mistake: 'Not setting auto cash-out', fix: 'Manual cash-out requires split-second decisions. Greed kicks in at the last moment. Auto cash-out removes the human error.' },
                { mistake: 'Playing with money you cannot afford to lose', fix: 'Aviator is entertainment. Only play with your designated entertainment budget. Never use rent or bill money.' },
                { mistake: 'Depositing everything after a big win', fix: 'A big win is a great time to withdraw and enjoy your profit. Keeping it all in often leads to giving it back in the same session.' },
                { mistake: 'Ignoring the double-bet feature', fix: 'Using two simultaneous bets (one safety, one high-target) is a built-in feature most beginners miss. It is one of the most effective ways to reduce variance.' },
              ].map(({ mistake, fix }) => (
                <div key={mistake} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <div>
                      <p className="font-semibold text-foreground text-sm">{mistake}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{fix}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Where to play */}
          <section id="play">
            <h2 className="mb-4 text-xl font-bold">Where to Play Aviator in Kenya</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              For the best experience, we recommend <strong className="text-foreground">Betcheza Aviator</strong> — built specifically for
              the Kenyan market with instant M-Pesa and a minimum of KES 50.
            </p>
            <Link
              href="https://aviator.betcheza.co.ke/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white shadow transition hover:bg-orange-400 active:scale-95"
            >
              <Plane className="h-4 w-4" />
              Play on Betcheza Aviator
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              Or see the full{' '}
              <Link href="/aviator" className="text-orange-500 hover:underline">
                Aviator platform comparison →
              </Link>
            </p>
          </section>

          {/* Responsible gambling */}
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div className="text-sm">
                <p className="font-semibold text-foreground mb-1">Responsible Gambling Notice</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Aviator is a game of chance. No strategy can guarantee consistent profits. Only play with money you can afford to lose.
                  If you feel gambling is affecting your finances, relationships, or mental health, please{' '}
                  <Link href="/responsible-gambling" className="text-amber-600 dark:text-amber-400 underline">visit our responsible gambling page</Link>{' '}
                  or call the Kenya gambling helpline.
                </p>
              </div>
            </div>
          </div>

          {/* Related */}
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">More in Betting Academy</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { href: '/betting-academy', label: 'All Betting Markets Explained' },
                { href: '/aviator', label: 'Best Aviator Platforms in Kenya' },
                { href: '/strategy', label: '3 Daily Odds Strategy' },
                { href: '/tips', label: 'Today\'s Sports Betting Tips' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-medium text-foreground transition hover:border-orange-500/30 hover:bg-orange-500/5"
                >
                  <ChevronRight className="h-4 w-4 text-orange-400" />
                  {label}
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
