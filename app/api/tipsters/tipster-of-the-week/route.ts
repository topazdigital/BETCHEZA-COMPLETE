import { NextResponse } from 'next/server';
import { getTopTipsterThisWeek, computeRealTipsterStats, computeRealRoi, computeRealStreak } from '@/lib/auto-tips-store';
import { getFakeTipsterById, getFakeTipsters } from '@/lib/fake-tipsters';
import { tipsterHref } from '@/lib/utils/slug';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const best = getTopTipsterThisWeek();

  // No real settled tips at all — return the highest win-rate fake tipster as a placeholder
  if (!best) {
    const fakes = getFakeTipsters().sort((a, b) => b.winRate - a.winRate);
    if (fakes.length === 0) return NextResponse.json({ tipster: null });
    const top = fakes[0];
    return NextResponse.json({
      tipster: {
        id: top.id,
        username: top.username,
        displayName: top.displayName,
        avatar: top.avatar ?? null,
        bio: top.bio,
        winRate: top.winRate,
        roi: top.roi,
        streak: top.streak,
        wonTips: top.wonTips,
        lostTips: top.lostTips,
        totalTips: top.totalTips,
        isPro: top.isPro,
        verified: top.isVerified,
        countryCode: top.countryCode,
        href: tipsterHref(top.username, top.username),
      },
      weeklyWon: top.wonTips,
      weeklyLost: top.lostTips,
      weeklyTotal: top.totalTips,
      weeklyWinRate: top.winRate,
      isWeekly: false,
      performanceVerified: false,
    });
  }

  const fake = getFakeTipsterById(best.tipsterId);
  if (!fake) return NextResponse.json({ tipster: null });

  const allTime = computeRealTipsterStats(best.tipsterId);
  const performanceVerified = allTime.won + allTime.lost >= 10;
  const allTimeRoi = computeRealRoi(best.tipsterId);
  const allTimeStreak = computeRealStreak(best.tipsterId);

  return NextResponse.json({
    tipster: {
      id: fake.id,
      username: fake.username,
      displayName: fake.displayName,
      avatar: fake.avatar ?? null,
      bio: fake.bio,
      // Tipster card shows THIS WEEK's numbers so the "Tipster of the Week"
      // title is accurate. All-time numbers live on the profile page.
      winRate: best.winRate,
      roi: best.roi,
      streak: allTimeStreak,
      wonTips: best.won,
      lostTips: best.lost,
      totalTips: best.total,
      // All-time stats for the profile link subtitle
      allTimeWinRate: allTime.winRate,
      allTimeRoi,
      allTimeWon: allTime.won,
      allTimeLost: allTime.lost,
      isPro: fake.isPro,
      verified: fake.isVerified,
      countryCode: fake.countryCode,
      href: tipsterHref(fake.username, fake.username),
    },
    weeklyWon: best.won,
    weeklyLost: best.lost,
    weeklyTotal: best.total,
    weeklyWinRate: best.winRate,
    isWeekly: best.isWeekly,
    performanceVerified,
  });
}
