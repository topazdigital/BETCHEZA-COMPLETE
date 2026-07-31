import { NextRequest } from 'next/server';
import { getMatchById } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

function isFinished(status: string): boolean {
  return ['finished', 'final', 'ft', 'full-time', 'complete', 'completed', 'ended'].includes(
    (status || '').toLowerCase()
  );
}

function isLiveStatus(status: string): boolean {
  const s = (status || '').toLowerCase();
  return (
    s === 'in-progress' ||
    s === 'in_progress' ||
    s === 'live' ||
    s === '1h' || s === '2h' || s === 'ht' ||
    s === 'halftime' || s === 'half-time' ||
    s.includes('progress') || s.includes('live')
  );
}

async function fetchScores(matchIds: string[]): Promise<Record<string, {
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  minute: number | null;
}>> {
  const results: Record<string, { homeScore: number | null; awayScore: number | null; status: string; minute: number | null }> = {};
  await Promise.allSettled(matchIds.map(async (id) => {
    try {
      const m = await getMatchById(id);
      if (!m) return;
      results[id] = {
        homeScore: m.homeScore ?? null,
        awayScore: m.awayScore ?? null,
        status: m.status || 'scheduled',
        minute: typeof (m as Record<string, unknown>).minute === 'number'
          ? (m as Record<string, unknown>).minute as number
          : null,
      };
    } catch { /* ignore individual failures */ }
  }));
  return results;
}

// Trigger settlement for challenges whose matches have finished.
function triggerSettlement() {
  (async () => {
    try {
      const { settlePendingChallenges } = await import('@/lib/challenges-store');
      const result = await settlePendingChallenges();
      if (result.settled > 0) {
        console.log(`[points-stream] Auto-settled ${result.settled} challenge(s) after match finished`);
      }
    } catch { /* non-fatal */ }
  })();
}

// ─── Lead-change push notifications ──────────────────────────────────────────

type LeaderState = 'challenger' | 'challenged' | 'tied';

interface ChallengeSnapshot {
  id: number;
  matchId: string;
  challengerId: number;
  challengedId: number | null;
  challengerName: string;
  challengedName: string;
  challengerPick: import('@/lib/challenge-picks').PickSelection[];
  challengedPick: import('@/lib/challenge-picks').PickSelection[];
  homeTeam: string;
  awayTeam: string;
}

async function loadChallengesForMatches(matchIds: string[]): Promise<ChallengeSnapshot[]> {
  try {
    const { getChallenges, isFakeUserId } = await import('@/lib/challenges-store');
    const all = await getChallenges('active');
    return all
      .filter(c => matchIds.includes(c.matchId) && c.challengedPick && c.challengedPick.length > 0)
      .filter(c => !isFakeUserId(c.challengerId))
      .map(c => ({
        id: c.id,
        matchId: c.matchId,
        challengerId: c.challengerId,
        challengedId: c.challengedId,
        challengerName: c.challenger?.displayName || c.challenger?.username || 'Challenger',
        challengedName: c.challenged?.displayName || c.challenged?.username || 'Opponent',
        challengerPick: c.challengerPick,
        challengedPick: c.challengedPick ?? [],
        homeTeam: c.matchHomeTeam,
        awayTeam: c.matchAwayTeam,
      }));
  } catch {
    return [];
  }
}

function sendLeadChangePush(
  ch: ChallengeSnapshot,
  newLeader: LeaderState,
  cPts: number,
  oPts: number,
) {
  (async () => {
    try {
      const { sendPushToTopic } = await import('@/lib/push-sender');
      const { sendPushToUser } = await import('@/lib/notification-dispatcher');
      const { isFakeUserId } = await import('@/lib/challenges-store');

      const matchLabel = `${ch.homeTeam} vs ${ch.awayTeam}`;
      const tag = `challenge-lead-${ch.id}`;

      let title: string;
      let body: string;

      if (newLeader === 'tied') {
        title = `⚔️ It's level! ${matchLabel}`;
        body = `${ch.challengerName} and ${ch.challengedName} are tied on points!`;
      } else {
        const leaderName = newLeader === 'challenger' ? ch.challengerName : ch.challengedName;
        const leaderPts  = newLeader === 'challenger' ? cPts : oPts;
        const trailerPts = newLeader === 'challenger' ? oPts : cPts;
        title = `⚔️ Lead change! ${matchLabel}`;
        body  = `${leaderName} takes the lead! ${leaderPts.toFixed(2)} vs ${trailerPts.toFixed(2)} pts`;
      }

      const payload = { title, body, url: '/challenges', tag };

      // Notify all watchers subscribed to this challenge topic
      await sendPushToTopic(`challenge_${ch.id}`, payload);

      // Notify the two players directly (they care most even if not watching)
      if (!isFakeUserId(ch.challengerId)) {
        await sendPushToUser(ch.challengerId, title, body, '/challenges');
      }
      if (ch.challengedId && !isFakeUserId(ch.challengedId)) {
        await sendPushToUser(ch.challengedId, title, body, '/challenges');
      }
    } catch { /* non-fatal */ }
  })();
}

// ─── SSE handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const matchIds = (req.nextUrl.searchParams.get('matchIds') || '')
    .split(',')
    .filter(Boolean)
    .slice(0, 20);

  if (!matchIds.length) {
    return new Response('data: {"error":"no matchIds"}\n\n', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let intervalId: ReturnType<typeof setInterval> | null = null;
      let settlementTriggered = false;

      // Lead-change tracking
      const prevLeader: Record<number, LeaderState> = {};
      let challenges: ChallengeSnapshot[] = [];
      let challengesLoaded = false;

      const send = (payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch { closed = true; }
      };

      const poll = async () => {
        if (closed) return;
        try {
          const data = await fetchScores(matchIds);
          send({ data });

          // Lazy-load challenge data on first real score update
          if (!challengesLoaded) {
            challengesLoaded = true;
            challenges = await loadChallengesForMatches(matchIds);
          }

          // ── Lead-change detection (background, non-blocking) ──
          if (challenges.length > 0) {
            (async () => {
              try {
                const { calcPoints } = await import('@/lib/challenge-picks');
                for (const ch of challenges) {
                  const score = data[ch.matchId];
                  if (!score) continue;
                  if (!isLiveStatus(score.status)) continue;
                  if (score.homeScore === null || score.awayScore === null) continue;
                  if (!ch.challengerPick.length || !ch.challengedPick.length) continue;

                  const cPts = calcPoints(ch.challengerPick, score.homeScore, score.awayScore);
                  const oPts = calcPoints(ch.challengedPick, score.homeScore, score.awayScore);
                  const newLeader: LeaderState =
                    cPts > oPts ? 'challenger' : oPts > cPts ? 'challenged' : 'tied';

                  const oldLeader = prevLeader[ch.id];
                  prevLeader[ch.id] = newLeader;

                  // Only fire when leader actually CHANGES (skip the first poll to avoid spam on connect)
                  if (oldLeader !== undefined && oldLeader !== newLeader) {
                    sendLeadChangePush(ch, newLeader, cPts, oPts);
                  }
                }
              } catch { /* non-fatal */ }
            })();
          }

          const allFinished = Object.values(data).length > 0 &&
            Object.values(data).every(d => isFinished(d.status));

          if (allFinished) {
            if (!settlementTriggered) {
              settlementTriggered = true;
              triggerSettlement();
            }
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
            send({ finished: true, needsRefresh: true });
            try { controller.close(); } catch { /* already closed */ }
          }
        } catch { /* ignore */ }
      };

      req.signal.addEventListener('abort', () => {
        closed = true;
        if (intervalId) { clearInterval(intervalId); intervalId = null; }
        try { controller.close(); } catch { /* already closed */ }
      });

      send({ connected: true });
      await poll();

      if (!closed) {
        intervalId = setInterval(poll, 20_000);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection': 'keep-alive',
    },
  });
}
