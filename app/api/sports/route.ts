import { NextResponse } from 'next/server';
import { ALL_SPORTS } from '@/lib/sports-data';

export const dynamic = 'force-static';

export async function GET() {
  try {
    // Sort sports by priority
    const SPORT_PRIORITY: Record<number, number> = {
      1: 0,   // Football - highest priority
      2: 1,   // Basketball
      3: 2,   // Tennis
      4: 3,   // Cricket
      5: 4,   // American Football
      6: 5,   // Baseball
      7: 6,   // Ice Hockey
      8: 7,   // Rugby
      27: 8,  // MMA
      26: 9,  // Boxing
      29: 10, // Formula 1
      33: 11, // Esports
    };

    const sortedSports = [...ALL_SPORTS].sort((a, b) => {
      const priorityA = SPORT_PRIORITY[a.id] ?? 99;
      const priorityB = SPORT_PRIORITY[b.id] ?? 99;
      return priorityA - priorityB;
    });

    return NextResponse.json({
      success: true,
      data: sortedSports,
    });
  } catch (error) {
    console.error('[API] Error fetching sports:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch sports' },
      { status: 500 }
    );
  }
}
