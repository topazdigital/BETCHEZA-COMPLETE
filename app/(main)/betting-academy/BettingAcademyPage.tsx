'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  BookOpen, ChevronRight, Search, Hash, TrendingUp, Target,
  BarChart2, Percent, Layers, Repeat, ArrowLeftRight,
  AlertCircle, CheckCircle, Lightbulb, Star, Clock, Shield,
  Trophy, DollarSign, HelpCircle, Calculator, Globe, Zap,
  Menu, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SidebarBanners = dynamic(
  () => import('@/components/home/sidebar-banners').then(m => ({ default: m.SidebarBanners })),
  { ssr: false, loading: () => null },
);

// ── Types ─────────────────────────────────────────────────────────────────────
interface Market {
  id: string;
  title: string;
  shortTitle: string;
  category: string;
  icon: typeof BookOpen;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  content: React.ReactNode;
}

interface Category {
  id: string;
  label: string;
  icon: typeof BookOpen;
  color: string;
}

// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES: Category[] = [
  { id: 'basics',      label: 'Basics & Odds',      icon: BookOpen,      color: 'text-blue-500' },
  { id: 'result',      label: 'Match Result',        icon: Trophy,        color: 'text-green-500' },
  { id: 'goals',       label: 'Goals Markets',       icon: Target,        color: 'text-orange-500' },
  { id: 'handicap',    label: 'Handicap Betting',    icon: ArrowLeftRight, color: 'text-purple-500' },
  { id: 'specials',    label: 'Specials & Props',    icon: Star,          color: 'text-rose-500' },
  { id: 'strategy',    label: 'Betting Strategy',    icon: TrendingUp,    color: 'text-emerald-500' },
];

// ── Difficulty Badge ──────────────────────────────────────────────────────────
function DifficultyBadge({ level }: { level: Market['difficulty'] }) {
  const config = {
    Beginner:     { color: 'bg-green-500/10 text-green-600 border-green-500/20' },
    Intermediate: { color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    Advanced:     { color: 'bg-red-500/10 text-red-600 border-red-500/20' },
  }[level];
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', config.color)}>
      {level}
    </span>
  );
}

// ── Tip Box ───────────────────────────────────────────────────────────────────
function TipBox({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex gap-2">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          {title && <p className="mb-1 font-semibold text-sm">{title}</p>}
          <div className="text-sm text-muted-foreground">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ── Odds Table ────────────────────────────────────────────────────────────────
function OddsTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-4 overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {headers.map(h => (
              <th key={h} className="px-3 py-2 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={cn('border-b last:border-0', i % 2 === 0 ? 'bg-background' : 'bg-muted/20')}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Example Box ───────────────────────────────────────────────────────────────
function Example({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-lg bg-muted/40 p-4 border-l-4 border-primary">
      <p className="mb-1 text-xs font-bold text-primary uppercase tracking-wider">
        {title ?? 'Example'}
      </p>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

// ── Markets Data ──────────────────────────────────────────────────────────────
const MARKETS: Market[] = [
  // ── BASICS ──────────────────────────────────────────────────────────────────
  {
    id: 'odds-explained',
    title: 'Understanding Betting Odds',
    shortTitle: 'Betting Odds',
    category: 'basics',
    icon: Calculator,
    difficulty: 'Beginner',
    content: (
      <>
        <p>Betting odds tell you two things: <strong>how likely an outcome is</strong> and <strong>how much you can win</strong>.</p>
        <h4 className="mt-4 mb-2 font-semibold">Decimal Odds (most common)</h4>
        <p>Most East African bookmakers display <strong>decimal odds</strong>. To calculate your potential return:</p>
        <pre className="my-3 rounded bg-muted p-3 text-sm font-mono">Return = Stake × Decimal Odds</pre>
        <Example>
          Arsenal listed at <strong>2.10</strong>. You bet KES 1,000.<br/>
          Return = 1,000 × 2.10 = <strong>KES 2,100</strong> (profit of KES 1,100).
        </Example>
        <h4 className="mt-4 mb-2 font-semibold">Fractional Odds (UK style)</h4>
        <p>Written as <strong>11/10</strong> — means you win 11 units for every 10 staked.</p>
        <h4 className="mt-4 mb-2 font-semibold">American Odds</h4>
        <p>Positive (+110) = profit on KES 100 stake. Negative (-110) = stake needed to win KES 100.</p>
        <OddsTable
          headers={['Format', 'Example', 'KES 1,000 Returns']}
          rows={[
            ['Decimal', '2.10', 'KES 2,100'],
            ['Fractional', '11/10', 'KES 2,100'],
            ['American', '+110', 'KES 2,100'],
          ]}
        />
        <TipBox title="Quick tip">Decimal odds below 2.00 mean the bookmaker favours that outcome. Above 2.00 means it's considered unlikely.</TipBox>
      </>
    ),
  },
  {
    id: 'implied-probability',
    title: 'Implied Probability & Value Betting',
    shortTitle: 'Implied Probability',
    category: 'basics',
    icon: Percent,
    difficulty: 'Intermediate',
    content: (
      <>
        <p>Every odd carries an implied probability — the bookmaker's estimate of the chance of that outcome.</p>
        <pre className="my-3 rounded bg-muted p-3 text-sm font-mono">Implied Probability = 1 ÷ Decimal Odds × 100</pre>
        <Example>
          Manchester City at 1.80 odds → 1 ÷ 1.80 × 100 = <strong>55.6%</strong> implied probability.
        </Example>
        <p className="mt-3"><strong>Value</strong> exists when you believe the true probability is higher than implied.</p>
        <Example title="Value Bet Example">
          You believe Arsenal wins 60% of the time. Bookmaker implies 50% (odds 2.00).<br/>
          At 2.00 you're getting paid more than the true risk — that's <strong>value</strong>.
        </Example>
        <TipBox title="Key insight">Profitable bettors don't just pick winners — they find bets where the odds are better than the real probability.</TipBox>
      </>
    ),
  },

  // ── MATCH RESULT ────────────────────────────────────────────────────────────
  {
    id: '1x2',
    title: '1X2 — Match Result Betting',
    shortTitle: '1X2',
    category: 'result',
    icon: Trophy,
    difficulty: 'Beginner',
    content: (
      <>
        <p>The simplest football bet. You pick one of three outcomes for the 90 minutes of play (plus injury time):</p>
        <OddsTable
          headers={['Selection', 'Meaning', 'Example Odds']}
          rows={[
            ['1', 'Home team wins', '2.10'],
            ['X', 'Draw', '3.40'],
            ['2', 'Away team wins', '3.60'],
          ]}
        />
        <p>The three odds always imply roughly 100% total (plus the bookmaker's margin).</p>
        <Example>
          Arsenal (1) vs Chelsea (2). You pick Arsenal win (1) at 2.10.<br/>
          Arsenal win 2-1 → you collect KES 2,100 per KES 1,000 staked.
        </Example>
        <TipBox title="Important">1X2 is settled on 90 minutes only. Extra time and penalties in cup matches do NOT count unless stated.</TipBox>
        <h4 className="mt-4 mb-2 font-semibold">First Half 1X2 (HT Result)</h4>
        <p>Same principle but only for the first 45 minutes. Useful when one team starts strongly.</p>
      </>
    ),
  },
  {
    id: 'double-chance',
    title: 'Double Chance',
    shortTitle: 'Double Chance',
    category: 'result',
    icon: Shield,
    difficulty: 'Beginner',
    content: (
      <>
        <p>Double Chance covers <strong>two of the three possible match outcomes</strong> with a single bet — you sacrifice some odds for more security.</p>
        <OddsTable
          headers={['Selection', 'Covers', 'Example Odds']}
          rows={[
            ['1X', 'Home win or Draw', '1.40'],
            ['X2', 'Away win or Draw', '1.60'],
            ['12', 'Home win or Away win (no draw)', '1.25'],
          ]}
        />
        <Example>
          Liverpool vs Everton. You back "1X" (Liverpool win or draw) at 1.40.<br/>
          Liverpool win 2-0 → WIN. Match ends 1-1 draw → WIN. Everton win 1-0 → LOSE.
        </Example>
        <TipBox title="Best use case">Back the stronger team's "1X" when playing a tricky away fixture — you're protected if they settle for a draw.</TipBox>
      </>
    ),
  },
  {
    id: 'draw-no-bet',
    title: 'Draw No Bet (DNB)',
    shortTitle: 'Draw No Bet',
    category: 'result',
    icon: ArrowLeftRight,
    difficulty: 'Beginner',
    content: (
      <>
        <p>If the match is a draw, your stake is refunded. You only win or get your money back — you never lose on a draw.</p>
        <OddsTable
          headers={['Result', 'Outcome']}
          rows={[
            ['Your team wins', 'WIN — collect winnings'],
            ['Draw', 'REFUND — stake returned'],
            ['Your team loses', 'LOSE — stake lost'],
          ]}
        />
        <Example>
          You back Man City DNB at 1.60. Bet KES 1,000.<br/>
          City win 2-0 → KES 1,600 returned. City vs Chelsea ends 1-1 → KES 1,000 refunded.
        </Example>
        <TipBox>DNB odds are always lower than the straight win price because you're removing the draw risk.</TipBox>
      </>
    ),
  },

  // ── GOALS ───────────────────────────────────────────────────────────────────
  {
    id: 'over-under',
    title: 'Over / Under Goals',
    shortTitle: 'Over/Under',
    category: 'goals',
    icon: BarChart2,
    difficulty: 'Beginner',
    content: (
      <>
        <p>You bet on whether the <strong>total goals scored</strong> in the match will be over or under a set line, most commonly <strong>2.5</strong>.</p>
        <OddsTable
          headers={['Line', 'Over wins if…', 'Under wins if…']}
          rows={[
            ['Over/Under 1.5', '2 or more goals', '0 or 1 goal'],
            ['Over/Under 2.5', '3 or more goals', '0, 1 or 2 goals'],
            ['Over/Under 3.5', '4 or more goals', '3 or fewer goals'],
            ['Over/Under 4.5', '5 or more goals', '4 or fewer goals'],
          ]}
        />
        <Example>
          Arsenal vs Man City. You back Over 2.5 goals at 1.80. Final score: 3-1 (4 goals).<br/>
          4 &gt; 2.5 → <strong>WIN</strong>.
        </Example>
        <TipBox title="Half-goal lines remove the push">Because the line is set at .5, the bet always settles — there's no refund possibility (unlike Asian handicaps with whole-number lines).</TipBox>
        <h4 className="mt-4 mb-2 font-semibold">First Half Goals</h4>
        <p>Same principle applied only to first-half goals. HTFT and 1st half Over/Under are popular for in-play betting.</p>
      </>
    ),
  },
  {
    id: 'btts',
    title: 'Both Teams to Score (BTTS)',
    shortTitle: 'BTTS',
    category: 'goals',
    icon: Target,
    difficulty: 'Beginner',
    content: (
      <>
        <p><strong>BTTS Yes</strong> wins if both teams score at least one goal each. <strong>BTTS No</strong> wins if at least one team keeps a clean sheet.</p>
        <OddsTable
          headers={['Selection', 'Result', 'Example Odds']}
          rows={[
            ['BTTS Yes', 'Both teams score 1+ goals', '1.85'],
            ['BTTS No', 'At least one team scores 0', '1.95'],
          ]}
        />
        <Example>
          Liverpool 2-1 Tottenham → BTTS <strong>Yes</strong> wins (both scored).<br/>
          Chelsea 1-0 Arsenal → BTTS <strong>No</strong> wins (Arsenal kept clean sheet).
        </Example>
        <TipBox title="Combine with 1X2">BTTS + Team to win in the same bet is called a "Combined" or "Scoreline" market — higher odds, higher risk.</TipBox>
        <h4 className="mt-4 mb-2 font-semibold">BTTS in First Half</h4>
        <p>Both teams must score in the first 45 minutes. Much harder — odds typically 4.00+.</p>
      </>
    ),
  },
  {
    id: 'correct-score',
    title: 'Correct Score',
    shortTitle: 'Correct Score',
    category: 'goals',
    icon: Hash,
    difficulty: 'Intermediate',
    content: (
      <>
        <p>You predict the <strong>exact final score</strong> of the match. Very high odds, very difficult to hit.</p>
        <OddsTable
          headers={['Scoreline', 'Typical Odds']}
          rows={[
            ['1-0', '8.00'],
            ['1-1', '7.00'],
            ['2-1', '9.00'],
            ['2-0', '10.00'],
            ['0-0', '10.00'],
            ['3-1', '16.00'],
            ['Any other score', '30.00+'],
          ]}
        />
        <TipBox title="Risk vs Reward">Correct Score bets are extremely high risk. Professional bettors rarely use them for value — they are primarily entertainment bets.</TipBox>
        <h4 className="mt-4 mb-2 font-semibold">Scorecast</h4>
        <p>Combines a correct score with a first goalscorer — even higher odds (100.00+).</p>
      </>
    ),
  },
  {
    id: 'anytime-scorer',
    title: 'Goalscorer Markets',
    shortTitle: 'Goalscorer',
    category: 'goals',
    icon: Star,
    difficulty: 'Intermediate',
    content: (
      <>
        <p>Bet on which player will score, when, and how many times.</p>
        <OddsTable
          headers={['Market', 'Wins if…', 'Example Odds']}
          rows={[
            ['Anytime Goalscorer', 'Player scores at any point', '2.50'],
            ['First Goalscorer', 'Player scores the very first goal', '6.00'],
            ['Last Goalscorer', 'Player scores the last goal', '6.50'],
            ['2+ Goals (brace)', 'Player scores 2 or more goals', '8.00'],
            ['Hat-trick', 'Player scores 3+ goals', '25.00'],
          ]}
        />
        <Example>
          Erling Haaland "Anytime Scorer" at 1.80. City vs Villa, Haaland scores in 33rd minute → WIN (even if he scored after that too).
        </Example>
        <TipBox>Anytime Goalscorer is settled on 90 minutes. Own goals do NOT count towards a player's tally.</TipBox>
      </>
    ),
  },

  // ── HANDICAP ────────────────────────────────────────────────────────────────
  {
    id: 'asian-handicap',
    title: 'Asian Handicap',
    shortTitle: 'Asian Handicap',
    category: 'handicap',
    icon: ArrowLeftRight,
    difficulty: 'Intermediate',
    content: (
      <>
        <p>Asian Handicap eliminates the draw by giving one team a virtual head start or deficit. This creates a two-way market with better odds than standard 1X2.</p>
        <h4 className="mt-4 mb-2 font-semibold">Whole-number handicaps</h4>
        <OddsTable
          headers={['Handicap', 'Meaning', 'Push (Refund) if…']}
          rows={[
            ['-1', 'Favourite must win by 2+', 'Win by exactly 1'],
            ['+1', 'Underdog has 1-goal head start', 'Favourite wins by exactly 1'],
            ['-2', 'Favourite must win by 3+', 'Win by exactly 2'],
          ]}
        />
        <h4 className="mt-4 mb-2 font-semibold">Half-number handicaps (no refund)</h4>
        <OddsTable
          headers={['Handicap', 'Wins if…']}
          rows={[
            ['Arsenal -0.5', 'Arsenal win by any margin'],
            ['Arsenal -1.5', 'Arsenal win by 2+ goals'],
            ['Arsenal +1.5', 'Arsenal win, draw, or lose by 1'],
          ]}
        />
        <Example>
          Chelsea -1.5 vs Fulham. Chelsea win 2-0 (margin = 2, &gt; 1.5) → <strong>WIN</strong>.<br/>
          Chelsea win 1-0 (margin = 1, &lt; 1.5) → <strong>LOSE</strong>.
        </Example>
        <TipBox title="Quarter handicaps (splits)">-0.75 = half your stake on -0.5 and half on -1.00. If the favourite wins by exactly 1, you win half and refund half.</TipBox>
      </>
    ),
  },
  {
    id: 'european-handicap',
    title: 'European Handicap',
    shortTitle: 'European Handicap',
    category: 'handicap',
    icon: Globe,
    difficulty: 'Intermediate',
    content: (
      <>
        <p>Like Asian Handicap but retains a three-way market (Home / Draw / Away) after applying the virtual head start.</p>
        <Example>
          Manchester City -2 vs Burnley. After applying handicap:<br/>
          • Man City need to win by <strong>3+</strong> for your "City" bet to win.<br/>
          • Win by exactly <strong>2</strong> → Draw result after handicap.<br/>
          • Win by <strong>1 or less / Burnley win</strong> → Burnley wins after handicap.
        </Example>
        <TipBox>European Handicap is more popular in Continental Europe and Africa. Asian Handicap is dominant in Asia and UK.</TipBox>
      </>
    ),
  },
  {
    id: 'total-goals-ah',
    title: 'Asian Over/Under (Totals)',
    shortTitle: 'Asian Totals',
    category: 'handicap',
    icon: BarChart2,
    difficulty: 'Intermediate',
    content: (
      <>
        <p>Similar to Over/Under but uses Asian half-ball and quarter-ball lines to allow partial refunds.</p>
        <OddsTable
          headers={['Line', 'Over wins if…', 'Partial refund if…']}
          rows={[
            ['2.25 (2 & 2.5)', '3+ goals', '2 goals — half refunded'],
            ['2.75 (2.5 & 3)', '3+ goals', '3 goals — half refunded'],
            ['3.25 (3 & 3.5)', '4+ goals', '3 goals — half refunded'],
          ]}
        />
        <Example>
          Over 2.75 on Arsenal vs City. Final score: 2-1 (3 goals total).<br/>
          3 goals = exactly 3.0 line → half stake wins (on 2.5 line) + half refunded (on 3.0 line).
        </Example>
      </>
    ),
  },

  // ── SPECIALS ────────────────────────────────────────────────────────────────
  {
    id: 'accumulators',
    title: 'Accumulators (Multiples)',
    shortTitle: 'Accumulators',
    category: 'specials',
    icon: Layers,
    difficulty: 'Beginner',
    content: (
      <>
        <p>An accumulator (acca) combines multiple selections into a single bet. All selections must win for you to collect. The odds multiply together.</p>
        <OddsTable
          headers={['Legs', 'Name', 'Example Combined Odds']}
          rows={[
            ['2', 'Double', '3.00 × 2.00 = 6.00'],
            ['3', 'Treble', '2.00 × 2.50 × 3.00 = 15.00'],
            ['4', 'Fourfold', '4 selections combined'],
            ['5+', 'Fivefold / Acca', 'Very high odds'],
          ]}
        />
        <Example>
          4-fold acca: Arsenal (2.10) + Liverpool (1.90) + Real Madrid (1.70) + PSG (1.80).<br/>
          Combined odds = 2.10 × 1.90 × 1.70 × 1.80 = <strong>12.24</strong>.<br/>
          KES 500 stake → KES 6,120 if all four win.
        </Example>
        <TipBox title="The maths of accas">Each leg added multiplies the odds BUT also multiplies the probability of losing. A 5-game acca where each team has a 60% win chance has only a 7.8% chance of success.</TipBox>
      </>
    ),
  },
  {
    id: 'system-bets',
    title: 'System Bets (Trixie, Yankee, Patent)',
    shortTitle: 'System Bets',
    category: 'specials',
    icon: Layers,
    difficulty: 'Advanced',
    content: (
      <>
        <p>System bets cover multiple combinations from your selections so you can still win even if some legs lose.</p>
        <OddsTable
          headers={['Name', 'Selections', 'Bets', 'Min wins needed']}
          rows={[
            ['Patent', '3', '7 (3 singles + 3 doubles + 1 treble)', '1'],
            ['Trixie', '3', '4 (3 doubles + 1 treble)', '2'],
            ['Yankee', '4', '11 (6 doubles + 4 trebles + 1 fourfold)', '2'],
            ['Lucky 15', '4', '15 (all combos + singles)', '1'],
            ['Lucky 31', '5', '31', '1'],
            ['Heinz', '6', '57', '2'],
          ]}
        />
        <TipBox title="When to use system bets">If you have 4 confident selections but fear one surprise result, a Yankee gives you returns even if one leg fails — at the cost of a higher total stake.</TipBox>
      </>
    ),
  },
  {
    id: 'half-time-full-time',
    title: 'Half-Time / Full-Time (HT/FT)',
    shortTitle: 'HT/FT',
    category: 'specials',
    icon: Clock,
    difficulty: 'Intermediate',
    content: (
      <>
        <p>Predict the result at both <strong>half-time</strong> AND <strong>full-time</strong>. Nine possible outcomes.</p>
        <OddsTable
          headers={['Selection', 'Example Odds']}
          rows={[
            ['Home / Home (1/1)', '3.50'],
            ['Home / Draw (1/X)', '9.00'],
            ['Home / Away (1/2)', '17.00'],
            ['Draw / Home (X/1)', '4.00'],
            ['Draw / Draw (X/X)', '5.50'],
            ['Draw / Away (X/2)', '4.50'],
            ['Away / Home (2/1)', '17.00'],
            ['Away / Draw (2/X)', '11.00'],
            ['Away / Away (2/2)', '4.50'],
          ]}
        />
        <TipBox title="Best value picks">Draw / Home or Draw / Away offer great value when a big team is playing away and tends to start slow — high odds for a likely comeback pattern.</TipBox>
      </>
    ),
  },
  {
    id: 'clean-sheet',
    title: 'Clean Sheet / To Score',
    shortTitle: 'Clean Sheet',
    category: 'specials',
    icon: Shield,
    difficulty: 'Beginner',
    content: (
      <>
        <p><strong>Clean Sheet Yes</strong> = a specific team does not concede in 90 minutes. <strong>To Score Yes</strong> = a specific team scores at least one goal.</p>
        <OddsTable
          headers={['Market', 'Example', 'Odds']}
          rows={[
            ['Home Clean Sheet Yes', 'Arsenal keep clean sheet at home', '2.20'],
            ['Home Clean Sheet No', 'Arsenal concede at least one goal', '1.60'],
            ['Away Team To Score Yes', 'Visitors score 1+', '1.70'],
            ['Away Team To Score No', 'Visitors fail to score', '2.00'],
          ]}
        />
        <Example>
          Arsenal "Clean Sheet Yes" at 2.20. Arsenal win 2-0 → WIN. Arsenal draw 1-1 → LOSE (conceded).
        </Example>
      </>
    ),
  },
  {
    id: 'corners',
    title: 'Corners & Cards',
    shortTitle: 'Corners & Cards',
    category: 'specials',
    icon: AlertCircle,
    difficulty: 'Intermediate',
    content: (
      <>
        <p>Markets on match statistics rather than goals — useful when the result feels uncertain but patterns are clear.</p>
        <h4 className="mt-4 mb-2 font-semibold">Corner Markets</h4>
        <OddsTable
          headers={['Market', 'Example', 'Odds']}
          rows={[
            ['Total Corners Over/Under', 'Over 9.5 corners', '1.90'],
            ['Team Corners Over', 'Arsenal 5+ corners', '1.80'],
            ['Asian Corners', 'Home team -2.5 corners', '1.85'],
            ['First Corner', 'Home team wins first corner', '1.80'],
          ]}
        />
        <h4 className="mt-4 mb-2 font-semibold">Card Markets</h4>
        <OddsTable
          headers={['Market', 'Example', 'Odds']}
          rows={[
            ['Total Cards Over/Under', 'Over 3.5 cards', '1.85'],
            ['Player to be Booked', 'Specific player gets yellow', '3.50'],
            ['Team Cards', 'Away team 2+ cards', '1.90'],
          ]}
        />
        <TipBox>Yellow cards usually count as 1 point, red cards as 2 in card totals markets. Check the bookmaker's specific rules.</TipBox>
      </>
    ),
  },
  {
    id: 'outrights',
    title: 'Outright / Futures Betting',
    shortTitle: 'Outright Bets',
    category: 'specials',
    icon: Trophy,
    difficulty: 'Beginner',
    content: (
      <>
        <p>Bet on who will win a competition, league, or award before or during the season.</p>
        <OddsTable
          headers={['Market', 'Example', 'Odds']}
          rows={[
            ['League Winner', 'Man City to win Premier League', '3.50'],
            ['Top Scorer', 'Haaland top PL scorer', '2.80'],
            ['Relegation', 'Luton Town to be relegated', '1.50'],
            ['Top 4', 'Arsenal to finish top 4', '1.80'],
            ['Both Teams Top Half', 'Both finish top 10', '1.75'],
          ]}
        />
        <TipBox title="Stake only what you can forget">Outright bets can last a whole season. Tie up only a small portion of your bankroll in these long-term positions.</TipBox>
      </>
    ),
  },

  // ── STRATEGY ────────────────────────────────────────────────────────────────
  {
    id: 'bankroll',
    title: 'Bankroll Management',
    shortTitle: 'Bankroll Management',
    category: 'strategy',
    icon: DollarSign,
    difficulty: 'Beginner',
    content: (
      <>
        <p>How you manage your betting budget is more important than your tips. Even the best tipsters lose streaks — proper bankroll management keeps you in the game.</p>
        <h4 className="mt-4 mb-2 font-semibold">The Unit System</h4>
        <p>Define a "unit" as a fixed percentage of your total bankroll — typically <strong>1–5%</strong>.</p>
        <OddsTable
          headers={['Bankroll', '1 Unit (1%)', '2 Units', '5 Units']}
          rows={[
            ['KES 5,000', 'KES 50', 'KES 100', 'KES 250'],
            ['KES 10,000', 'KES 100', 'KES 200', 'KES 500'],
            ['KES 50,000', 'KES 500', 'KES 1,000', 'KES 2,500'],
          ]}
        />
        <Example title="Why it matters">
          With KES 5,000 bankroll at 1 unit (KES 50) per bet, you can survive 100 consecutive losses before going to zero. Betting 20% per bet, you go broke after just 5 losses.
        </Example>
        <TipBox title="Golden rule">Never chase losses by increasing your stake. Increase units only when your bankroll grows, not to recover losses.</TipBox>
      </>
    ),
  },
  {
    id: 'value-betting',
    title: 'Finding Value Bets',
    shortTitle: 'Value Betting',
    category: 'strategy',
    icon: TrendingUp,
    difficulty: 'Advanced',
    content: (
      <>
        <p>A value bet exists when the true probability of an outcome is <strong>higher</strong> than what the bookmaker's odds imply.</p>
        <pre className="my-3 rounded bg-muted p-3 text-sm font-mono">
          {`Expected Value (EV) = (Probability × Odds) - 1\n\nPositive EV → Value bet\nNegative EV → Avoid`}
        </pre>
        <Example>
          You assess Arsenal wins 55% of the time. Bookmaker offers 2.10.<br/>
          EV = (0.55 × 2.10) - 1 = 1.155 - 1 = <strong>+0.155</strong> → <strong>Value exists</strong>.
        </Example>
        <h4 className="mt-4 mb-2 font-semibold">How to find value</h4>
        <ul className="my-2 space-y-1 text-sm list-disc list-inside">
          <li>Compare odds across multiple bookmakers (line shopping)</li>
          <li>Follow team news — injuries and suspensions move odds late</li>
          <li>Track historical head-to-head stats and form</li>
          <li>Spot overreaction to recent results (recency bias in odds)</li>
        </ul>
        <TipBox title="Long-term mindset">Even with positive EV, you will lose individual bets. Profitability shows over 100+ bets, not 10.</TipBox>
      </>
    ),
  },
  {
    id: 'responsible-gambling',
    title: 'Responsible Betting',
    shortTitle: 'Responsible Betting',
    category: 'strategy',
    icon: CheckCircle,
    difficulty: 'Beginner',
    content: (
      <>
        <p>Betting should be entertainment, not income. Here are the core principles:</p>
        <ul className="my-3 space-y-2 text-sm">
          {[
            'Only bet money you can afford to lose entirely',
            'Set a daily/weekly/monthly deposit limit and stick to it',
            'Take regular breaks — at least one day off per week',
            'Never bet while drunk, tired, or emotionally upset',
            'Do not chase losses — accept them as a cost of entertainment',
            'If betting affects your sleep, work or relationships — seek help',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1">Need help?</p>
          <p className="text-muted-foreground">Contact the <strong>Kenya Gambling Commission</strong> helpline or <strong>BeGambleAware</strong> at begambleaware.org. You must be 18+ to bet.</p>
        </div>
      </>
    ),
  },
];

// ── Popular terms glossary ────────────────────────────────────────────────────
const GLOSSARY_TERMS: Array<{ term: string; definition: string }> = [
  { term: '1X2', definition: 'Three-way match result market: 1=Home win, X=Draw, 2=Away win.' },
  { term: 'Accumulator', definition: 'Multiple selections combined into one bet. All must win.' },
  { term: 'AH', definition: 'Asian Handicap — eliminates the draw by giving one team a virtual advantage.' },
  { term: 'BTTS', definition: 'Both Teams To Score — both sides must net at least one goal.' },
  { term: 'DNB', definition: 'Draw No Bet — stake refunded if match ends in a draw.' },
  { term: 'EV', definition: 'Expected Value — positive EV means the bet has long-term profitability.' },
  { term: 'HT/FT', definition: 'Half-Time / Full-Time — predict both the half-time and full-time result.' },
  { term: 'Line', definition: 'The handicap or totals number set by the bookmaker.' },
  { term: 'Margin', definition: "Bookmaker's profit built into the odds (also called 'vig' or 'juice')." },
  { term: 'O/U', definition: 'Over/Under — bet whether a stat (goals, corners) exceeds a number.' },
  { term: 'Push', definition: 'When a handicap results in a tie — stake is refunded.' },
  { term: 'SGM', definition: 'Same Game Multi — accumulator of different markets within one match.' },
  { term: 'Stake', definition: 'The amount of money you wager on a bet.' },
  { term: 'Unit', definition: 'Fixed bet size as a % of bankroll (typically 1–5%).' },
  { term: 'Value', definition: 'Odds that are higher than the true probability implies.' },
  { term: 'Vig', definition: "Bookmaker's margin/edge — also called 'juice' or 'overround'." },
];

// ── Main Component ────────────────────────────────────────────────────────────
export default function BettingAcademyPage() {
  const [activeMarket, setActiveMarket] = useState<string>(MARKETS[0].id);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [glossarySearch, setGlossarySearch] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  const currentMarket = MARKETS.find(m => m.id === activeMarket) ?? MARKETS[0];

  const filteredMarkets = MARKETS.filter(m => {
    const matchesCategory = activeCategory === 'all' || m.category === activeCategory;
    const matchesSearch = !searchQuery ||
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.shortTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredGlossary = GLOSSARY_TERMS.filter(t =>
    !glossarySearch || t.term.toLowerCase().includes(glossarySearch.toLowerCase()) ||
    t.definition.toLowerCase().includes(glossarySearch.toLowerCase())
  );

  function selectMarket(id: string) {
    setActiveMarket(id);
    setMobileSidebarOpen(false);
    if (contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const categoryLabel = CATEGORIES.find(c => c.id === currentMarket.category)?.label ?? '';

  return (
    <div className="min-h-screen bg-background">

      {/* Hero */}
      <div className="border-b bg-gradient-to-br from-primary/10 via-background to-background px-4 py-8 md:py-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <span>Betting Academy</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="hidden md:flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Betting Academy</h1>
              <p className="mt-1.5 max-w-2xl text-muted-foreground text-sm md:text-base">
                Free, comprehensive guides to every sports betting market — from 1X2 basics to advanced Asian Handicap strategies. No jargon, plain English, real examples.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {[`${MARKETS.length} Markets covered`, 'Real examples', 'KES-based', '18+ only'].map(b => (
                  <span key={b} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />{b}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sidebar toggle */}
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-sm font-medium truncate">{currentMarket.shortTitle}</span>
          <button
            onClick={() => setMobileSidebarOpen(v => !v)}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Menu className="h-3.5 w-3.5" />
            Markets
          </button>
        </div>
        {mobileSidebarOpen && (
          <div className="border-t bg-background px-4 py-3 max-h-72 overflow-y-auto">
            {CATEGORIES.map(cat => (
              <div key={cat.id} className="mb-2">
                <p className="mb-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{cat.label}</p>
                {MARKETS.filter(m => m.category === cat.id).map(m => (
                  <button
                    key={m.id}
                    onClick={() => selectMarket(m.id)}
                    className={cn(
                      'block w-full rounded px-2 py-1.5 text-left text-sm',
                      m.id === activeMarket ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                    )}
                  >
                    {m.shortTitle}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3-column layout */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex gap-6">

          {/* ── LEFT SIDEBAR ──────────────────────────────────────────────── */}
          <aside className="hidden md:block w-56 shrink-0">
            <div className="sticky top-4 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search markets…"
                  className="w-full rounded-lg border bg-background pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Nav by category */}
              <nav className="rounded-xl border bg-card p-3 space-y-4">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1">Contents</p>
                {CATEGORIES.map(cat => {
                  const items = filteredMarkets.filter(m => m.category === cat.id);
                  if (!items.length) return null;
                  return (
                    <div key={cat.id}>
                      <div className="mb-1 flex items-center gap-1.5 px-1">
                        <cat.icon className={cn('h-3 w-3 shrink-0', cat.color)} />
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{cat.label}</span>
                      </div>
                      <ul className="space-y-0.5">
                        {items.map(m => (
                          <li key={m.id}>
                            <button
                              onClick={() => selectMarket(m.id)}
                              className={cn(
                                'flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                                m.id === activeMarket
                                  ? 'bg-primary text-primary-foreground font-semibold'
                                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                              )}
                            >
                              {m.shortTitle}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </nav>

              {/* Glossary link */}
              <a href="#glossary" className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm hover:bg-muted transition-colors">
                <Hash className="h-4 w-4 text-primary" />
                <span className="font-medium">Glossary A–Z</span>
              </a>
            </div>
          </aside>

          {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
          <main className="min-w-0 flex-1" ref={contentRef}>
            {/* Market Article */}
            <article className="rounded-xl border bg-card p-5 md:p-7">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{categoryLabel}</span>
                    <ChevronRight className="h-3 w-3" />
                    <span>{currentMarket.shortTitle}</span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold">{currentMarket.title}</h2>
                </div>
                <DifficultyBadge level={currentMarket.difficulty} />
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert text-foreground [&_p]:text-muted-foreground [&_strong]:text-foreground [&_h4]:text-foreground">
                {currentMarket.content}
              </div>

              {/* Market navigation */}
              <div className="mt-8 flex items-center justify-between border-t pt-4">
                <button
                  onClick={() => {
                    const idx = MARKETS.findIndex(m => m.id === activeMarket);
                    if (idx > 0) selectMarket(MARKETS[idx - 1].id);
                  }}
                  disabled={MARKETS.findIndex(m => m.id === activeMarket) === 0}
                  className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4 rotate-180" />
                  Previous
                </button>
                <span className="text-xs text-muted-foreground">
                  {MARKETS.findIndex(m => m.id === activeMarket) + 1} / {MARKETS.length}
                </span>
                <button
                  onClick={() => {
                    const idx = MARKETS.findIndex(m => m.id === activeMarket);
                    if (idx < MARKETS.length - 1) selectMarket(MARKETS[idx + 1].id);
                  }}
                  disabled={MARKETS.findIndex(m => m.id === activeMarket) === MARKETS.length - 1}
                  className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </article>

            {/* Category Quick Nav */}
            <div className="mt-6 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              <button
                onClick={() => setActiveCategory('all')}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  activeCategory === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted',
                )}
              >
                All Markets
              </button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    activeCategory === cat.id ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted',
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Markets Grid */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredMarkets.map(m => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    onClick={() => selectMarket(m.id)}
                    className={cn(
                      'group flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-sm',
                      m.id === activeMarket && 'border-primary/60 bg-primary/5',
                    )}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted group-hover:bg-primary/10">
                      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm leading-tight">{m.shortTitle}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{m.title}</p>
                      <div className="mt-1.5"><DifficultyBadge level={m.difficulty} /></div>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </div>

            {/* Glossary */}
            <section id="glossary" className="mt-8 rounded-xl border bg-card p-5 md:p-7">
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Hash className="h-5 w-5 text-primary" />
                    Betting Glossary A–Z
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">Quick definitions for common betting terms.</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    value={glossarySearch}
                    onChange={e => setGlossarySearch(e.target.value)}
                    placeholder="Search terms…"
                    className="w-full sm:w-48 rounded-lg border bg-background pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredGlossary.map(t => (
                  <div key={t.term} className="rounded-lg border bg-background p-3">
                    <dt className="font-bold text-sm text-primary">{t.term}</dt>
                    <dd className="mt-0.5 text-xs text-muted-foreground">{t.definition}</dd>
                  </div>
                ))}
              </div>
            </section>

            {/* CTA */}
            <div className="mt-6 rounded-xl border bg-gradient-to-br from-primary/10 to-background p-6 text-center">
              <Trophy className="mx-auto h-8 w-8 text-primary mb-2" />
              <h3 className="font-bold text-lg">Ready to put your knowledge to use?</h3>
              <p className="mt-1 text-sm text-muted-foreground">Follow expert tipsters, compare odds, and track your bets — all free on Betcheza.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Link href="/matches" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                  Browse Matches
                </Link>
                <Link href="/tipsters" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">
                  Find Tipsters
                </Link>
              </div>
            </div>
          </main>

          {/* ── RIGHT SIDEBAR ─────────────────────────────────────────────── */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-4 space-y-4">
              {/* Most viewed */}
              <div className="rounded-xl border bg-card p-4">
                <p className="mb-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Most Popular</p>
                <ul className="space-y-1.5">
                  {['1x2', 'over-under', 'btts', 'accumulators', 'asian-handicap', 'double-chance', 'correct-score', 'bankroll'].map((id, i) => {
                    const m = MARKETS.find(x => x.id === id);
                    if (!m) return null;
                    return (
                      <li key={id}>
                        <button
                          onClick={() => selectMarket(id)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted transition-colors"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                            {i + 1}
                          </span>
                          <span className="line-clamp-1 font-medium">{m.shortTitle}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Quick reference */}
              <div className="rounded-xl border bg-card p-4">
                <p className="mb-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Quick Reference</p>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {[
                    { term: 'Over 2.5', def: '3+ goals needed' },
                    { term: 'BTTS Yes', def: 'Both teams score' },
                    { term: '-1.5 AH', def: 'Win by 2+ goals' },
                    { term: '1X', def: 'Home win or draw' },
                    { term: 'DNB', def: 'Draw = refund' },
                    { term: 'EV+', def: 'Value bet exists' },
                  ].map(({ term, def }) => (
                    <li key={term} className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground shrink-0">{term}</span>
                      <span className="text-right">{def}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Banners */}
              <SidebarBanners />

              {/* Responsible gambling */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs">
                <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1">⚠️ Bet responsibly</p>
                <p className="text-muted-foreground">18+ only. Gambling can be addictive. Only bet what you can afford to lose.</p>
                <Link href="/responsible-gambling" className="mt-1.5 block text-primary hover:underline">
                  Responsible Gambling →
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
