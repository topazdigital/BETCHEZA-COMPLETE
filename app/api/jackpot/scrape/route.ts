import { NextRequest, NextResponse } from 'next/server';
import { createJackpot, updateJackpot, getActiveJackpots, getJackpots, resetJackpots } from '@/lib/jackpot-store';
import type { JackpotGame } from '@/lib/jackpot-types';

export const dynamic = 'force-dynamic';

// Realistic mock jackpot data per bookmaker, auto-updated with upcoming match-like data
function generateGames(count: number, seed: number): JackpotGame[] {
  const teams = [
    ['Arsenal', 'Chelsea'],['Man City', 'Liverpool'],['Tottenham', 'Man Utd'],
    ['Barcelona', 'Real Madrid'],['Atletico Madrid', 'Sevilla'],['Juventus', 'Inter Milan'],
    ['AC Milan', 'Napoli'],['PSG', 'Lyon'],['Bayern Munich', 'Dortmund'],
    ['Ajax', 'PSV'],['Porto', 'Benfica'],['Celtic', 'Rangers'],
    ['Gor Mahia', 'AFC Leopards'],['Tusker FC', 'KCB FC'],['Sofapaka', 'Bandari'],
    ['Simba SC', 'Yanga SC'],['Kaizer Chiefs', 'Orlando Pirates'],['Sundowns', 'SuperSport'],
    ['TP Mazembe', 'Vita Club'],['Al Ahly', 'Zamalek'],
  ];
  const leagues = ['Premier League','La Liga','Serie A','Bundesliga','Ligue 1','KPL','SPL','Champions League','Europa League','CAF CL'];
  const games: JackpotGame[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const idx = (seed + i * 7) % teams.length;
    const pair = teams[idx];
    const kickoff = new Date(now + (2 + i) * 24 * 3600000 + (i % 3) * 7200000);
    games.push({
      id: `g${seed}-${i}`,
      home: pair[0],
      away: pair[1],
      league: leagues[(seed + i * 3) % leagues.length],
      kickoffTime: kickoff.toISOString(),
    });
  }
  return games;
}

function todayPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function formatAmount(n: number): string {
  return n.toLocaleString();
}

const MOCK_JACKPOTS = [
  {
    bookmakerSlug: 'sportpesa',
    bookmakerName: 'SportPesa',
    title: 'SportPesa Mega Jackpot',
    jackpotAmount: '100000000',
    currency: 'KES',
    deadline: todayPlusDays(5),
    games: generateGames(17, 1),
  },
  {
    bookmakerSlug: 'sportpesa',
    bookmakerName: 'SportPesa',
    title: 'SportPesa Midweek Jackpot',
    jackpotAmount: '15000000',
    currency: 'KES',
    deadline: todayPlusDays(2),
    games: generateGames(13, 11),
  },
  {
    bookmakerSlug: 'betika',
    bookmakerName: 'Betika',
    title: 'Betika Grand Jackpot',
    jackpotAmount: '30000000',
    currency: 'KES',
    deadline: todayPlusDays(4),
    games: generateGames(15, 3),
  },
  {
    bookmakerSlug: 'betika',
    bookmakerName: 'Betika',
    title: 'Betika Midweek Jackpot',
    jackpotAmount: '10000000',
    currency: 'KES',
    deadline: todayPlusDays(2),
    games: generateGames(13, 33),
  },
  {
    bookmakerSlug: 'odibets',
    bookmakerName: 'OdiBets',
    title: 'OdiBets Jackpot Bonanza',
    jackpotAmount: '5000000',
    currency: 'KES',
    deadline: todayPlusDays(3),
    games: generateGames(10, 5),
  },
  {
    bookmakerSlug: 'betin',
    bookmakerName: 'Betin Kenya',
    title: 'Betin Grand Jackpot',
    jackpotAmount: '20000000',
    currency: 'KES',
    deadline: todayPlusDays(4),
    games: generateGames(13, 7),
  },
  {
    bookmakerSlug: 'mozzartbet',
    bookmakerName: 'Mozzartbet',
    title: 'Mozzartbet Mega Jackpot',
    jackpotAmount: '25000000',
    currency: 'KES',
    deadline: todayPlusDays(5),
    games: generateGames(15, 9),
  },
];

export async function GET(req: NextRequest) {
  try {
    // Only allow internal cron or admin calls
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'betcheza-cron';
    if (authHeader !== `Bearer ${cronSecret}` && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Reset all active jackpots so each scrape produces fresh unique IDs
    resetJackpots();
    let created = 0;

    for (const mock of MOCK_JACKPOTS) {
      createJackpot({ ...mock, status: 'active' });
      created++;
    }

    const updated = 0;

    return NextResponse.json({
      success: true,
      message: `Scrape complete. Created: ${created}, Updated: ${updated}`,
      created,
      updated,
    });
  } catch (e) {
    console.error('[jackpot scrape] error:', e);
    return NextResponse.json({ error: 'Scrape failed' }, { status: 500 });
  }
}
