import { NextRequest, NextResponse } from 'next/server';
import { createPost, addComment, listPosts } from '@/lib/feed-store';
import { getAllMatches } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || 'betcheza-cron-2024';

// Fake tipster pool — realistic African + global names
const FAKE_TIPSTERS = [
  { id: 90001, name: 'Vincent_Dlamini',  avatar: null },
  { id: 90002, name: 'Linda_Young',       avatar: null },
  { id: 90003, name: 'Esther_Adedayo',   avatar: null },
  { id: 90004, name: 'Peter_Gomes',       avatar: null },
  { id: 90005, name: 'Kelvin_Ochieng',   avatar: null },
  { id: 90006, name: 'Amara_Diallo',     avatar: null },
  { id: 90007, name: 'John_Kamau',       avatar: null },
  { id: 90008, name: 'Sarah_Mensah',     avatar: null },
  { id: 90009, name: 'Tunde_Balogun',    avatar: null },
  { id: 90010, name: 'Grace_Wanjiru',    avatar: null },
  { id: 90011, name: 'David_Nkosi',      avatar: null },
  { id: 90012, name: 'Fatima_Hassan',    avatar: null },
  { id: 90013, name: 'Moses_Kipchoge',   avatar: null },
  { id: 90014, name: 'Angela_Owusu',     avatar: null },
  { id: 90015, name: 'Rashid_Omar',      avatar: null },
];

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
  (home: string, away: string, pick: string, odds: number) =>
    `🔮 ${home} vs ${away} — going with ${pick} @ ${odds.toFixed(2)}. Form, H2H and home advantage all pointing the same way.`,
  (home: string, away: string, pick: string, odds: number) =>
    `My tip for ${home} vs ${away}: ${pick} @ ${odds.toFixed(2)}. The stats back this one up strongly.`,
  (home: string, away: string, pick: string, odds: number) =>
    `${home} vs ${away} prediction: ${pick}. Odds at ${odds.toFixed(2)} represent solid value today.`,
  (home: string, away: string, pick: string, _odds: number) =>
    `Watching ${home} vs ${away} closely today. Backing ${pick} based on recent momentum.`,
  (home: string, away: string, pick: string, odds: number) =>
    `${pick} in the ${home} vs ${away} fixture feels like the right call. ${odds.toFixed(2)} is fair value.`,
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

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Global dedup: track which match IDs have already been posted about this session
const g = globalThis as { __fakeActivityPostedMatches?: Set<string>; __fakeActivityLastRun?: number };

// Auto-run once per process and then every 20 minutes
function autoRun() {
  const last = g.__fakeActivityLastRun || 0;
  if (Date.now() - last < 20 * 60 * 1000) return;
  g.__fakeActivityLastRun = Date.now();
  if (!g.__fakeActivityPostedMatches) g.__fakeActivityPostedMatches = new Set();

  import('@/lib/api/unified-sports-api').then(({ getAllMatches }) =>
    import('@/lib/feed-store').then(({ createPost, addComment, listPosts }) => {
      const now = Date.now();
      getAllMatches().then(async allMatches => {
        const relevant = allMatches.filter(m => {
          const t = new Date(m.kickoffTime).getTime();
          const isLive = ['live', 'halftime', 'extra_time', 'penalties'].includes(m.status);
          const isUpcoming = m.status === 'scheduled' && t > now && t < now + 12 * 60 * 60 * 1000;
          return (isLive || isUpcoming) && !g.__fakeActivityPostedMatches!.has(m.id);
        }).slice(0, 4);

        for (const match of relevant) {
          if (Math.random() > 0.4) continue;
          const tipster = pick(FAKE_TIPSTERS);
          const chosenPick = pick(['Home Win', 'Away Win', 'Both Teams to Score', 'Over 2.5 Goals']);
          const odds = 1.5 + Math.random() * 2.5;
          const content = pick(MATCH_POSTS)(match.homeTeam.name, match.awayTeam.name, chosenPick, odds);
          await createPost({ userId: tipster.id, authorName: tipster.name, authorAvatar: null,
            content, matchId: match.id, matchTitle: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
            pick: chosenPick, odds: parseFloat(odds.toFixed(2)), imageUrl: null }).catch(() => {});
          g.__fakeActivityPostedMatches!.add(match.id);
        }

        // Generic post
        const tipster = pick(FAKE_TIPSTERS);
        await createPost({ userId: tipster.id, authorName: tipster.name, authorAvatar: null,
          content: pick(GENERIC_POSTS), matchId: null, matchTitle: null, pick: null, odds: null, imageUrl: null }).catch(() => {});

        // Comments on recent posts
        const posts = await listPosts(15, null);
        for (const post of posts.filter(() => Math.random() > 0.6).slice(0, 3)) {
          const commenter = pick(FAKE_TIPSTERS.filter(t => t.id !== post.userId));
          await addComment({ postId: post.id, userId: commenter.id, authorName: commenter.name,
            authorAvatar: null, content: pick(COMMENTS) }).catch(() => {});
        }
      }).catch(() => {});
    })
  ).catch(() => {});
}

if (typeof globalThis !== 'undefined') {
  setTimeout(autoRun, 5000);
  setInterval(autoRun, 20 * 60 * 1000);
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!g.__fakeActivityPostedMatches) g.__fakeActivityPostedMatches = new Set();

  const now = Date.now();
  const results = { postsCreated: 0, commentsCreated: 0, errors: [] as string[] };

  try {
    // ── 1. Create match-linked posts for upcoming/live matches ────────────────
    const allMatches = await getAllMatches();
    const relevantMatches = allMatches.filter(m => {
      const t = new Date(m.kickoffTime).getTime();
      const isLive = ['live', 'halftime', 'extra_time', 'penalties'].includes(m.status);
      const isUpcoming = m.status === 'scheduled' && t > now && t < now + 12 * 60 * 60 * 1000;
      return (isLive || isUpcoming) && !g.__fakeActivityPostedMatches!.has(m.id);
    }).slice(0, 6);

    for (const match of relevantMatches) {
      // Only post about ~40% of eligible matches to keep it natural
      if (Math.random() > 0.4) continue;

      const tipster = pick(FAKE_TIPSTERS);
      const home = match.homeTeam.name;
      const away = match.awayTeam.name;
      const picks = ['Home Win', 'Away Win', 'Both Teams to Score', 'Over 2.5 Goals', 'Draw No Bet'];
      const chosenPick = pick(picks);
      const odds = 1.5 + Math.random() * 2.5;
      const template = pick(MATCH_POSTS);
      const content = template(home, away, chosenPick, odds);

      try {
        await createPost({
          userId: tipster.id,
          authorName: tipster.name,
          authorAvatar: tipster.avatar,
          content,
          matchId: match.id,
          matchTitle: `${home} vs ${away}`,
          pick: chosenPick,
          odds: parseFloat(odds.toFixed(2)),
          imageUrl: null,
        });
        g.__fakeActivityPostedMatches!.add(match.id);
        results.postsCreated++;
      } catch (e) {
        results.errors.push(`post for ${match.id}: ${e}`);
      }
    }

    // ── 2. Create generic posts (1–2 per run) ────────────────────────────────
    const genericCount = randInt(1, 2);
    for (let i = 0; i < genericCount; i++) {
      const tipster = pick(FAKE_TIPSTERS);
      try {
        await createPost({
          userId: tipster.id,
          authorName: tipster.name,
          authorAvatar: tipster.avatar,
          content: pick(GENERIC_POSTS),
          matchId: null,
          matchTitle: null,
          pick: null,
          odds: null,
          imageUrl: null,
        });
        results.postsCreated++;
      } catch (e) {
        results.errors.push(`generic post: ${e}`);
      }
    }

    // ── 3. Add comments to recent posts ──────────────────────────────────────
    const recentPosts = await listPosts(20, null);
    // Pick 2–4 random posts to comment on
    const toComment = recentPosts
      .filter(() => Math.random() > 0.5)
      .slice(0, randInt(2, 4));

    for (const post of toComment) {
      const commenter = pick(FAKE_TIPSTERS.filter(t => t.id !== post.userId));
      try {
        await addComment({
          postId: post.id,
          userId: commenter.id,
          authorName: commenter.name,
          authorAvatar: commenter.avatar,
          content: pick(COMMENTS),
        });
        results.commentsCreated++;
      } catch (e) {
        results.errors.push(`comment on ${post.id}: ${e}`);
      }
    }

    g.__fakeActivityLastRun = now;

    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    console.error('[fake-activity] Fatal error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
