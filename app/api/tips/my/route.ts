import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { matchIdToSlug } from '@/lib/utils/match-url';

export const dynamic = 'force-dynamic';

interface SubmittedTip {
  id: string;
  matchId: string;
  prediction: string;
  market: string;
  odds: number;
  stake: number;
  confidence: number;
  analysis: string;
  status: string;
  createdAt: string;
  tipster: { id: string; displayName: string };
}

type TipsStore = Map<string, SubmittedTip[]>;

function getGlobalStore(): TipsStore {
  return (globalThis as { __tipsStore?: TipsStore }).__tipsStore ?? new Map();
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ tips: [], authenticated: false });
  }

  const store = getGlobalStore();
  const myTips: (SubmittedTip & { matchSlug: string })[] = [];

  for (const [, tips] of store) {
    for (const tip of tips) {
      if (tip.tipster?.id === String(user.userId)) {
        myTips.push({ ...tip, matchSlug: matchIdToSlug(tip.matchId) });
      }
    }
  }

  myTips.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ tips: myTips.slice(0, 10), authenticated: true });
}
