import { NextRequest, NextResponse } from 'next/server';
import { createPost, addComment, listPosts } from '@/lib/feed-store';
import { getAllMatches } from '@/lib/api/unified-sports-api';
import {
  getFakeTipsters,
  recordActivityTip,
  settleActivityTips,
} from '@/lib/fake-tipsters';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || 'betcheza-cron-2024';

// Generic post templates (no match reference)
const GENERIC_POSTS = [
  'Been studying form all week — my picks this weekend are looking very solid 🔥',
  'Remember: value beats favourites every time. Discipline is everything in this game.',
  'Three-fold accumulator going in tonight. Done the research, feeling confident.',
  'Anyone else fading the favourites this weekend? The odds on some underdogs are too good.',
  'Bankroll management separates the winners from the losers. Always stake responsibly.',
  'Hit 4/5 last weekend. That near miss hurts but the process was right. On to the next.',
  'Tip of the day: never bet with your emotions. Let the stats guide you.',
  'Over 2.5 goals in the evening kick-off looks very appealing based on recent form.',
  'Looking at the Asian handicap markets today — much better value than standard 1X2.',
  'Midweek results confirm my weekend selections. The research doesn\'t lie.',
  'Both teams to score tonight — head-to-head record heavily supports it.',
  'Three singles over an accumulator today. Risk management first.',
  'I\'ve been tracking this league for 3 months. The home bias here is real.',
  'Draw no bet is seriously underrated as a market. Cuts your risk in half.',
  'Great value on the -1 Asian line for the big game tonight. Don\'t sleep on it.',
];

// Match-specific post templates
const MATCH_POSTS = [
  (home: string, away: string, p: string, odds: number) =>
    `🔮 ${home} vs ${away} — going with ${p} @ ${odds.toFixed(2)}. Form, H2H and home advantage all pointing the same way.`,
  (home: string, away: string, p: string, odds: number) =>
    `My tip for ${home} vs ${away}: ${p} @ ${odds.toFixed(2)}. The stats back this one up strongly.`,
  (home: string, away: string, p: string, odds: number) =>
    `${home} vs ${away} prediction: ${p}. Odds at ${odds.toFixed(2)} represent solid value today.`,
  (home: string, away: string, p: string, _odds: number) =>
    `Watching ${home} vs ${away} closely today. Backing ${p} based on recent momentum.`,
  (home: string, away: string, p: string, odds: number) =>
    `${p} in the ${home} vs ${away} fixture feels like the right call. ${odds.toFixed(2)} is fair value.`,
];

// Comment templates
const COMMENTS = [
  'Agreed! I was thinking the same thing 💯',
  'Good analysis, thanks for sharing 👍',
  'I see your reasoning but I\'m going the other way on this one',
  'Solid tip, already added it to my slip',
  'The form table backs this up nicely',
  'Great insight as always 🙌',
  'Did you factor in the head-to-head though?',
  'Bold pick but I like the value there',
  'Following this one closely, thanks!',
  'Missed this yesterday but bookmarking for next time',
  'Clean analysis. What about injuries?',
  'Value looks right to me too',
  'This is why I follow you — solid research every time',
  'Added to my accumulator, let\'s go! 🚀',
  'Interesting angle, hadn\'t considered the away form',
  'That odds looks too good to pass up tbh',
  'I\'m on the same side, let\'s cash together 💪',
  'Not sure about this one but respect the process',
];

function randPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Global dedup: track which match IDs have already been posted about this session
const g = globalThis as {
  __fakeActivityPostedMatches?: Set<string>;
  __fakeActivityLastRun?: number;
};

async function runActivity() {
  if (!g.__fakeActivityPostedMatches) g.__fakeActivityPostedMatches = new Set();
  const now = Date.now();
  const tipsters = getFakeTipsters();
  const allMatches = await getAllMatches();

  // ── Settle finished matches first ──────────────────────────────────────────
  const finishedIds = new Set(
    allMatches.filter(m => m.status === 'finished').map(m => m.id)
  );
  settleActivityTips(finishedIds);

  // ── Upcoming / live matches to post tips on ────────────────────────────────
  const relevant = allMatches.filter(m => {
    const t = new Date(m.kickoffTime).getTime();
    const isLive = ['live', 'halftime', 'extra_time', 'penalties'].includes(m.status);
    const isUpcoming = m.status === 'scheduled' && t > now && t < now + 12 * 60 * 60 * 1000;
    return (isLive || isUpcoming) && !g.__fakeActivityPostedMatches!.has(m.id);
  }).slice(0, 4);

  for (const match of relevant) {
    if (Math.random() > 0.4) continue;
    const tipster = randPick(tipsters);
    const chosenPick = randPick(['Home Win', 'Away Win', 'Both Teams to Score', 'Over 2.5 Goals']);
    const odds = parseFloat((1.5 + Math.random() * 2.5).toFixed(2));
    const content = randPick(MATCH_POSTS)(match.homeTeam.name, match.awayTeam.name, chosenPick, odds);
    await createPost({
      userId: tipster.id, authorName: tipster.displayName, authorAvatar: tipster.avatar,
      content, matchId: match.id, matchTitle: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
      pick: chosenPick, odds, imageUrl: null,
    }).catch(() => {});
    // Record the tip so we can settle it later and update win rate
    recordActivityTip(tipster.id, match.id, chosenPick, odds);
    g.__fakeActivityPostedMatches!.add(match.id);
  }

  // ── Generic post ──────────────────────────────────────────────────────────
  const genericTipster = randPick(tipsters);
  await createPost({
    userId: genericTipster.id, authorName: genericTipster.displayName,
    authorAvatar: genericTipster.avatar, content: randPick(GENERIC_POSTS),
    matchId: null, matchTitle: null, pick: null, odds: null, imageUrl: null,
  }).catch(() => {});

  // ── Comments on recent posts ───────────────────────────────────────────────
  const posts = await listPosts(15, null);
  for (const post of posts.filter(() => Math.random() > 0.6).slice(0, 3)) {
    const commenter = randPick(tipsters.filter(t => t.id !== post.userId));
    await addComment({
      postId: post.id, userId: commenter.id, authorName: commenter.displayName,
      authorAvatar: commenter.avatar, content: randPick(COMMENTS),
    }).catch(() => {});
  }
}

// Auto-run on startup (after 5s) then every 20 minutes
if (typeof globalThis !== 'undefined') {
  setTimeout(() => {
    g.__fakeActivityLastRun = Date.now();
    runActivity().catch(() => {});
  }, 5000);
  setInterval(() => {
    g.__fakeActivityLastRun = Date.now();
    runActivity().catch(() => {});
  }, 20 * 60 * 1000);
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const before = { posts: 0, comments: 0 };
  try {
    const tipsters = getFakeTipsters();
    const allMatches = await getAllMatches();
    const now = Date.now();

    if (!g.__fakeActivityPostedMatches) g.__fakeActivityPostedMatches = new Set();

    // Settle finished matches
    const finishedIds = new Set(allMatches.filter(m => m.status === 'finished').map(m => m.id));
    const settled = settleActivityTips(finishedIds);

    // Match tips
    const relevant = allMatches.filter(m => {
      const t = new Date(m.kickoffTime).getTime();
      const isLive = ['live', 'halftime', 'extra_time', 'penalties'].includes(m.status);
      const isUpcoming = m.status === 'scheduled' && t > now && t < now + 12 * 60 * 60 * 1000;
      return (isLive || isUpcoming) && !g.__fakeActivityPostedMatches!.has(m.id);
    }).slice(0, 6);

    for (const match of relevant) {
      if (Math.random() > 0.4) continue;
      const tipster = randPick(tipsters);
      const chosenPick = randPick(['Home Win', 'Away Win', 'Both Teams to Score', 'Over 2.5 Goals', 'Draw No Bet']);
      const odds = parseFloat((1.5 + Math.random() * 2.5).toFixed(2));
      const content = randPick(MATCH_POSTS)(match.homeTeam.name, match.awayTeam.name, chosenPick, odds);
      await createPost({
        userId: tipster.id, authorName: tipster.displayName, authorAvatar: tipster.avatar,
        content, matchId: match.id, matchTitle: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
        pick: chosenPick, odds, imageUrl: null,
      }).catch(() => {});
      recordActivityTip(tipster.id, match.id, chosenPick, odds);
      g.__fakeActivityPostedMatches!.add(match.id);
      before.posts++;
    }

    // Generic posts
    for (let i = 0; i < randInt(1, 2); i++) {
      const tipster = randPick(tipsters);
      await createPost({
        userId: tipster.id, authorName: tipster.displayName, authorAvatar: tipster.avatar,
        content: randPick(GENERIC_POSTS), matchId: null, matchTitle: null, pick: null, odds: null, imageUrl: null,
      }).catch(() => {});
      before.posts++;
    }

    // Comments
    const recentPosts = await listPosts(20, null);
    for (const post of recentPosts.filter(() => Math.random() > 0.5).slice(0, randInt(2, 4))) {
      const commenter = randPick(tipsters.filter(t => t.id !== post.userId));
      await addComment({
        postId: post.id, userId: commenter.id, authorName: commenter.displayName,
        authorAvatar: commenter.avatar, content: randPick(COMMENTS),
      }).catch(() => {});
      before.comments++;
    }

    g.__fakeActivityLastRun = now;
    return NextResponse.json({ ok: true, postsCreated: before.posts, commentsCreated: before.comments, settled });
  } catch (error) {
    console.error('[fake-activity] Fatal error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
