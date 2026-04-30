// In-memory session store for the AI chat — tracks recent angles, opening
// phrases, and topic summary per browser session so the model never repeats
// itself even when the same question is asked multiple times.

interface SessionMemory {
  /** Indexes into the angle list that have already been used (most recent first). */
  recentAngles: number[];
  /** First 3 words of recent assistant replies — used to ban repeat openings. */
  recentOpenings: string[];
  /** Full text of the last few assistant replies. We feed these back into the
   *  prompt so the model is forced to write something genuinely different. */
  recentReplies: string[];
  /** Last user question (lower-cased) so we can detect "asked the same thing". */
  lastUserText?: string;
  /** Counter of how many times the user repeated essentially the same question in a row. */
  repeatCount: number;
  /** Last touched timestamp — used for eviction. */
  ts: number;
}

const g = globalThis as { __aiSessions?: Map<string, SessionMemory> };
const sessions: Map<string, SessionMemory> =
  g.__aiSessions ?? (g.__aiSessions = new Map());

const MAX_SESSIONS = 2000;
const TTL_MS = 60 * 60 * 1000; // 1 hour idle

function evictOld() {
  if (sessions.size < MAX_SESSIONS) return;
  const cutoff = Date.now() - TTL_MS;
  for (const [k, v] of sessions) if (v.ts < cutoff) sessions.delete(k);
  // Hard cap — drop oldest if still too big.
  if (sessions.size >= MAX_SESSIONS) {
    const sorted = [...sessions.entries()].sort((a, b) => a[1].ts - b[1].ts);
    for (let i = 0; i < sorted.length - MAX_SESSIONS + 100; i++) sessions.delete(sorted[i][0]);
  }
}

export function getSession(id: string): SessionMemory {
  let s = sessions.get(id);
  if (!s) {
    s = { recentAngles: [], recentOpenings: [], recentReplies: [], repeatCount: 0, ts: Date.now() };
    sessions.set(id, s);
    evictOld();
  }
  if (!s.recentReplies) s.recentReplies = [];
  s.ts = Date.now();
  return s;
}

/** Compare current and previous user message; return true if "essentially the same". */
function isSameQuestion(prev: string | undefined, curr: string): boolean {
  if (!prev) return false;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const a = norm(prev);
  const b = norm(curr);
  if (a === b) return true;
  // Token overlap heuristic — 70%+ overlap of meaningful tokens.
  const ta = new Set(a.split(' ').filter((w) => w.length >= 4));
  const tb = new Set(b.split(' ').filter((w) => w.length >= 4));
  if (ta.size === 0 || tb.size === 0) return false;
  let hit = 0;
  for (const t of tb) if (ta.has(t)) hit++;
  return hit / Math.max(ta.size, tb.size) >= 0.7;
}

export interface AnglePick {
  /** Human-readable angle description fed to the system prompt. */
  angle: string;
  /** Index of the chosen angle within the canonical angle list. */
  index: number;
  /** True when the user is asking the same thing again — push the angle harder. */
  repeated: boolean;
  /** How many turns in a row the user has repeated this question (0 = fresh). */
  repeatStreak: number;
  /** Banned openings the model must avoid this turn. */
  bannedOpenings: string[];
  /** Full prior assistant replies (most-recent first) we feed back to the model. */
  recentReplies: string[];
}

export const ANGLES = [
  'open with the in-form team and why their momentum matters',
  'open with the value side of the line — implied vs estimated probability',
  'open with a tactical or stylistic note (press, possession, transition)',
  'open with the goals trend (BTTS / Over/Under)',
  'open with venue / home advantage / travel',
  'open with discipline & stake-management advice',
  'open with the contrarian read against the public favourite',
  'open by reframing what the user actually needs',
  'open with the head-to-head pattern',
  'open with the injury / lineup / availability angle',
  'open with the referee / discipline / cards angle',
  'open with the schedule / rest-days congestion angle',
] as const;

/** Pick a fresh angle for the next reply, avoiding recently-used ones and rotating
 *  more aggressively when the user repeats themselves. */
export function pickAngle(sessionId: string, userText: string): AnglePick {
  const s = getSession(sessionId);
  const repeated = isSameQuestion(s.lastUserText, userText);
  s.repeatCount = repeated ? s.repeatCount + 1 : 0;

  // Build a candidate list, removing angles used in the last 4 turns.
  const recent = new Set(s.recentAngles.slice(0, 4));
  let candidates = ANGLES.map((_, i) => i).filter((i) => !recent.has(i));
  if (candidates.length === 0) candidates = ANGLES.map((_, i) => i);

  // When the question is repeated, deterministically push to the next-furthest angle.
  let chosenIndex: number;
  if (repeated && s.recentAngles.length > 0) {
    const last = s.recentAngles[0];
    const distant = candidates
      .map((i) => ({ i, d: Math.abs(i - last) }))
      .sort((a, b) => b.d - a.d);
    chosenIndex = distant[0]?.i ?? candidates[Math.floor(Math.random() * candidates.length)];
  } else {
    chosenIndex = candidates[Math.floor(Math.random() * candidates.length)];
  }

  s.recentAngles = [chosenIndex, ...s.recentAngles].slice(0, 8);
  s.lastUserText = userText;

  return {
    angle: ANGLES[chosenIndex],
    index: chosenIndex,
    repeated,
    repeatStreak: s.repeatCount,
    bannedOpenings: [...s.recentOpenings],
    recentReplies: [...s.recentReplies],
  };
}

/** Record the assistant's reply opening + full text so we can force the next
 *  turn to be genuinely different. */
export function rememberReply(sessionId: string, reply: string) {
  const s = getSession(sessionId);
  const cleaned = reply.trim();
  const opening = cleaned
    .replace(/[^A-Za-z0-9 .,!?'-]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(' ');
  if (opening) {
    s.recentOpenings = [opening, ...s.recentOpenings.filter((o) => o !== opening)].slice(0, 5);
  }
  if (cleaned) {
    s.recentReplies = [cleaned.slice(0, 600), ...s.recentReplies].slice(0, 3);
  }
}
