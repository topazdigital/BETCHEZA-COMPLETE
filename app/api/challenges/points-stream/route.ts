import { NextRequest } from 'next/server';
import { getMatchById } from '@/lib/api/unified-sports-api';

export const dynamic = 'force-dynamic';

function isFinished(status: string): boolean {
  return ['finished', 'final', 'ft', 'full-time', 'complete', 'completed', 'ended'].includes(
    (status || '').toLowerCase()
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
// Runs in the background — does not block the SSE response.
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

          const allFinished = Object.values(data).length > 0 &&
            Object.values(data).every(d => isFinished(d.status));

          if (allFinished) {
            // Trigger real backend settlement the moment we detect all matches finished
            if (!settlementTriggered) {
              settlementTriggered = true;
              triggerSettlement();
            }

            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
            // Tell the client: matches finished + challenges need a refresh
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
