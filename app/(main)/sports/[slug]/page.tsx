import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ALL_SPORTS } from '@/lib/sports-data';

export const dynamic = 'force-dynamic';

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke').replace(/\/$/, '');

const SPORT_INFO: Record<string, {
  description: string;
  longDescription: string;
  topLeagues: Array<{ name: string; slug: string }>;
  tipTypes: string[];
}> = {
  football: {
    description: "Kenya's #1 source for football predictions and free betting tips.",
    longDescription: "Get expert AI-powered football predictions for every match across 500+ leagues worldwide. From the Premier League and Champions League to the Kenya Premier League and AFCON — our tipsters and AI engine analyse team form, head-to-head records, injuries and odds to give you the best free football tips in Kenya.",
    topLeagues: [
      { name: 'Premier League', slug: 'premier-league' },
      { name: 'Champions League', slug: 'champions-league' },
      { name: 'Kenya Premier League', slug: 'kpl' },
      { name: 'La Liga', slug: 'la-liga' },
      { name: 'Bundesliga', slug: 'bundesliga' },
      { name: 'Serie A', slug: 'serie-a' },
      { name: 'Ligue 1', slug: 'ligue-1' },
      { name: 'Europa League', slug: 'europa-league' },
    ],
    tipTypes: ['1X2 Match Result', 'Over/Under Goals', 'BTTS (Both Teams to Score)', 'Correct Score', 'Asian Handicap', 'Accumulator Tips'],
  },
  tennis: {
    description: 'Free ATP & WTA tennis tips and live scores for Grand Slams and Tour events.',
    longDescription: "Get expert tennis predictions for every ATP Tour, WTA Tour, Grand Slam and Challenger event. Our AI engine analyses player form, head-to-head stats, court surface and recent results to deliver the best free tennis betting tips. From Wimbledon to the US Open, follow live scores and betting tips on Betcheza.",
    topLeagues: [
      { name: 'ATP Tour', slug: 'atp' },
      { name: 'WTA Tour', slug: 'wta' },
      { name: 'Wimbledon', slug: 'wimbledon' },
      { name: 'US Open', slug: 'us-open' },
      { name: 'French Open', slug: 'french-open' },
      { name: 'Australian Open', slug: 'australian-open' },
    ],
    tipTypes: ['Match Winner', 'Set Betting', 'Over/Under Games', 'Total Sets', 'Outright Winner', 'First Set Winner'],
  },
  basketball: {
    description: 'Free NBA tips, live scores and basketball predictions for all major leagues.',
    longDescription: "Follow live NBA scores and get expert basketball predictions for every game. Our AI analyses team stats, player performance, home/away form and head-to-head records for NBA, EuroLeague, FIBA and NBL. Free daily basketball tips updated before every game on Betcheza Kenya.",
    topLeagues: [
      { name: 'NBA', slug: 'nba' },
      { name: 'EuroLeague', slug: 'euroleague' },
      { name: 'FIBA', slug: 'fiba' },
      { name: 'NBL', slug: 'nbl' },
    ],
    tipTypes: ['Money Line', 'Point Spread', 'Over/Under Points', 'Player Props', 'Quarter Betting', 'Outright Winner'],
  },
  cricket: {
    description: 'Free IPL, Test, ODI & T20 cricket tips and live scores on Betcheza Kenya.',
    longDescription: "Get expert cricket predictions for IPL, Test matches, ODIs and T20 tournaments. Our AI analyses pitch conditions, team line-ups, weather, head-to-head records and player form across all formats. Free daily cricket tips for ICC World Cup, IPL, Big Bash, The Hundred and all major tournaments.",
    topLeagues: [
      { name: 'IPL', slug: 'ipl' },
      { name: 'ICC Test', slug: 'icc-test' },
      { name: 'T20 World Cup', slug: 't20-world-cup' },
      { name: 'Big Bash League', slug: 'bbl' },
      { name: 'PSL', slug: 'psl' },
    ],
    tipTypes: ['Match Winner', 'Top Batsman', 'Top Bowler', 'Total Runs Over/Under', 'First Over Runs', 'Player of the Match'],
  },
  rugby: {
    description: 'Free Six Nations, Premiership & Super Rugby tips and live scores.',
    longDescription: "Get expert rugby union and league predictions for the Six Nations, Premiership, Super Rugby, URC and Rugby World Cup. Our AI analyses team form, home/away records, line-ups, injuries and historical head-to-heads for the most accurate rugby betting tips on Betcheza Kenya.",
    topLeagues: [
      { name: 'Six Nations', slug: 'six-nations' },
      { name: 'Premiership', slug: 'premiership-rugby' },
      { name: 'Super Rugby', slug: 'super-rugby' },
      { name: 'URC', slug: 'urc' },
      { name: 'Rugby World Cup', slug: 'rugby-world-cup' },
    ],
    tipTypes: ['Match Result', 'Handicap', 'Total Points Over/Under', 'First Try Scorer', 'Half-Time Result', 'Outright Winner'],
  },
  mma: {
    description: 'Free UFC tips, fight predictions and live results on Betcheza Kenya.',
    longDescription: "Get expert UFC and MMA fight predictions with method of victory, round betting and fight winner analysis. Our AI studies fighter records, fighting styles, recent form, camp changes and matchup dynamics to deliver the most accurate MMA betting tips for UFC, Bellator, ONE Championship and more.",
    topLeagues: [
      { name: 'UFC', slug: 'ufc' },
      { name: 'Bellator', slug: 'bellator' },
      { name: 'ONE Championship', slug: 'one-championship' },
      { name: 'PFL', slug: 'pfl' },
    ],
    tipTypes: ['Fight Winner', 'Method of Victory', 'Round Betting', 'Over/Under Rounds', 'Fighter Props', 'Outright Winner'],
  },
  boxing: {
    description: 'Free boxing tips, fight predictions and live results on Betcheza Kenya.',
    longDescription: "Get expert boxing fight predictions with fight winner picks, round betting and method of victory analysis. Our AI analyses fighter records, styles, recent form, trainer quality and matchup dynamics for world title fights and major bouts on Betcheza Kenya.",
    topLeagues: [
      { name: 'World Title Fights', slug: 'world-title' },
      { name: 'WBO', slug: 'wbo' },
      { name: 'WBC', slug: 'wbc' },
      { name: 'IBF', slug: 'ibf' },
    ],
    tipTypes: ['Fight Winner', 'Method of Victory', 'Round Betting', 'Total Rounds Over/Under', 'Fighter Props'],
  },
  golf: {
    description: 'Free PGA Tour tips, outright picks and Major golf predictions.',
    longDescription: "Get expert golf tournament predictions with outright winner picks, each-way bets and round-by-round analysis. Our AI analyses player form, course statistics, recent results and statistical tendencies for PGA Tour, European Tour, Major championships and Ryder Cup predictions on Betcheza Kenya.",
    topLeagues: [
      { name: 'PGA Tour', slug: 'pga-tour' },
      { name: 'DP World Tour', slug: 'dp-world-tour' },
      { name: 'The Masters', slug: 'masters' },
      { name: 'The Open Championship', slug: 'the-open' },
    ],
    tipTypes: ['Outright Winner', 'Each-Way', 'Round Leader', 'Top 5/10/20 Finish', 'Head-to-Head', 'Make/Miss Cut'],
  },
  'american-football': {
    description: 'Free NFL tips, spread picks and Super Bowl predictions on Betcheza.',
    longDescription: "Get expert NFL and American football predictions with spread picks, totals analysis and money line bets. Our AI analyses team stats, quarterback performance, injury reports and home/away trends for all NFL regular season, playoff and Super Bowl games on Betcheza Kenya.",
    topLeagues: [
      { name: 'NFL', slug: 'nfl' },
      { name: 'College Football', slug: 'ncaa-football' },
      { name: 'Super Bowl', slug: 'super-bowl' },
    ],
    tipTypes: ['Money Line', 'Point Spread', 'Over/Under', 'Player Props', 'Quarter Betting', 'Super Bowl Outright'],
  },
  'ice-hockey': {
    description: 'Free NHL tips, puck line picks and live hockey scores on Betcheza.',
    longDescription: "Get expert NHL and ice hockey predictions with puck line picks, totals analysis and money line bets. Our AI analyses team form, goaltender stats, power play percentages and home/away records for all NHL and international hockey games on Betcheza Kenya.",
    topLeagues: [
      { name: 'NHL', slug: 'nhl' },
      { name: 'KHL', slug: 'khl' },
      { name: 'AHL', slug: 'ahl' },
    ],
    tipTypes: ['Money Line', 'Puck Line', 'Over/Under Goals', 'Period Betting', 'Player Props', 'Stanley Cup Outright'],
  },
};

function getSportConfig(slug: string) {
  return ALL_SPORTS.find(s => s.slug === slug) ?? null;
}

export default async function SportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const config = getSportConfig(slug);

  if (!config) notFound();

  const info = SPORT_INFO[slug] ?? {
    description: `Free ${config.name} betting tips, live scores and AI predictions on Betcheza Kenya.`,
    longDescription: `Get expert ${config.name} predictions and free betting tips on Betcheza Kenya. AI-powered analysis updated in real time.`,
    topLeagues: [],
    tipTypes: ['Match Winner', 'Over/Under', 'Handicap'],
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Hero */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-5xl">{config.icon}</span>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{config.name} Tips & Predictions</h1>
              <p className="text-muted-foreground">{info.description}</p>
            </div>
          </div>
          <p className="text-foreground/80 leading-relaxed max-w-3xl">{info.longDescription}</p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-wrap gap-3 mb-10">
          <Link
            href={`/matches?sport=${slug}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            {config.icon} View {config.name} Matches
          </Link>
          <Link
            href={`/live?sport=${slug}`}
            className="inline-flex items-center gap-2 px-6 py-3 border border-border rounded-lg font-medium hover:bg-accent transition-colors"
          >
            🔴 Live Scores
          </Link>
          <Link
            href={`/results?sport=${slug}`}
            className="inline-flex items-center gap-2 px-6 py-3 border border-border rounded-lg font-medium hover:bg-accent transition-colors"
          >
            📊 Recent Results
          </Link>
        </div>

        {/* Top Leagues */}
        {info.topLeagues.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-4">Top {config.name} Leagues & Competitions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {info.topLeagues.map(league => (
                <Link
                  key={league.slug}
                  href={`/leagues/${league.slug}`}
                  className="flex items-center gap-2 p-3 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors text-sm font-medium"
                >
                  <span>{config.icon}</span>
                  {league.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Tip Types */}
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">Available {config.name} Bet Types</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {info.tipTypes.map(type => (
              <div key={type} className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 text-sm">
                <span className="text-primary">✓</span>
                <span>{type}</span>
              </div>
            ))}
          </div>
        </section>

        {/* All Sports Nav */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4">Browse Other Sports</h2>
          <div className="flex flex-wrap gap-2">
            {ALL_SPORTS.filter(s => s.slug !== slug).slice(0, 12).map(s => (
              <Link
                key={s.slug}
                href={`/sports/${s.slug}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-sm hover:border-primary hover:bg-accent transition-colors"
              >
                <span>{s.icon}</span>
                {s.name}
              </Link>
            ))}
          </div>
        </section>

        {/* SEO Footer */}
        <div className="text-xs text-muted-foreground border-t border-border pt-6 space-y-1">
          <p>Free {config.name} betting tips updated daily. All predictions are for informational purposes only. Please bet responsibly.</p>
          <p>
            <Link href="/responsible-gambling" className="underline hover:text-foreground">Responsible Gambling</Link>
            {' · '}
            <Link href="/matches" className="underline hover:text-foreground">All Matches</Link>
            {' · '}
            <Link href="/tipsters" className="underline hover:text-foreground">Top Tipsters</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
