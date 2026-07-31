import { NextResponse } from 'next/server';
import { getSharpApiOutrights } from '@/lib/api/sharpapi';
import { discoverAllSgoFutures } from '@/lib/api/sportsgameodds';
import { getApiKey } from '@/lib/api-keys';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export interface WorldCupOddsEntry {
  team: string;
  price: number;
  bookmaker: string;
}

const SHARP_WC_KEYS = [
  'soccer_fifa_world_cup',
  'soccer_fifa_world_cup_winner',
  'soccer_world_cup',
];

export async function GET() {
  try {
    const outcomes: WorldCupOddsEntry[] = [];

    // ── Source 1: SharpAPI outright odds ─────────────────────────────────────
    const sharpKey = await getApiKey('sharp_api_key');
    if (sharpKey) {
      for (const sportKey of SHARP_WC_KEYS) {
        const items = await getSharpApiOutrights(sportKey);
        if (items.length > 0) {
          for (const it of items) {
            outcomes.push({ team: it.team, price: it.price, bookmaker: it.bookmaker });
          }
          break;
        }
      }
    }

    // ── Source 2: SportsGameOdds futures ─────────────────────────────────────
    if (outcomes.length === 0) {
      const sgoKey = await getApiKey('sportsgameodds_api_key');
      if (sgoKey) {
        const allFutures = await discoverAllSgoFutures();
        const wc = allFutures.find(f =>
          f.sportKey.toLowerCase().includes('world_cup') ||
          f.sportKey.toLowerCase().includes('worldcup') ||
          f.sgoId === 'WORLDCUP' ||
          f.title.toLowerCase().includes('world cup'),
        );
        if (wc?.markets?.length) {
          const market = wc.markets[0];
          for (const o of market.outcomes) {
            outcomes.push({ team: o.name, price: o.price, bookmaker: 'Best Available' });
          }
        }
      }
    }

    // Sort by price ascending (favourites first) and cap at 16 teams
    outcomes.sort((a, b) => a.price - b.price);
    const top = outcomes.slice(0, 16);

    return NextResponse.json(
      { success: true, outcomes: top, total: top.length },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' } },
    );
  } catch (err) {
    console.error('[worldcup-odds]', err);
    return NextResponse.json({ success: false, outcomes: [], total: 0 });
  }
}
