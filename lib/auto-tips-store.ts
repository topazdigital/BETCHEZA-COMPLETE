// Auto-generated fake-tipster tips on REAL matches.
// Persists to .local/state/auto-tips.json so picks survive restarts and
// remain consistent between the match Tips tab and tipster profile pages.

import fs from 'fs';
import path from 'path';
import { getFakeTipsterById, getFakeTipsters, pickTipstersForMatch, type FakeTipster } from './fake-tipsters';
import { seedTipEngagement } from './tip-engagement-store';

export interface GeneratedTip {
  id: string;
  matchId: string;
  matchSlug?: string;
  homeTeam: string;
  awayTeam: string;
  league?: string;
  sport?: string;
  kickoff?: string;
  tipsterId: number;
  prediction: string;
  market: string;
  marketKey?: string;
  odds: number;
  stake: number;
  confidence: number;
  analysis: string;
  isPremium: boolean;
  status: 'pending' | 'won' | 'lost' | 'void';
  settledByProb?: boolean;
  likes: number;
  dislikes: number;
  comments: number;
  createdAt: string;
}

export interface MatchContext {
  matchId: string;
  matchSlug?: string;
  homeTeam: string;
  awayTeam: string;
  league?: string;
  sport?: string;
  kickoff?: string;
  leagueTier?: number; // 1 = top
  popularity?: number; // multiplier
  markets?: Array<{
    key?: string;
    name: string;
    selections: Array<{ label: string; odds: number }>;
  }>;
}

interface Stores {
  byMatch: Map<string, GeneratedTip[]>;
  byTipster: Map<number, GeneratedTip[]>;
  loaded: boolean;
}

const FILE = path.join(process.cwd(), '.local', 'state', 'auto-tips.json');

const g = globalThis as { __autoTipsStore?: Stores };
g.__autoTipsStore = g.__autoTipsStore || { byMatch: new Map(), byTipster: new Map(), loaded: false };
const stores = g.__autoTipsStore;

function ensureDir(p: string) {
  try { fs.mkdirSync(path.dirname(p), { recursive: true }); } catch {}
}

function persist() {
  try {
    ensureDir(FILE);
    const obj: Record<string, GeneratedTip[]> = {};
    for (const [k, v] of stores.byMatch) obj[k] = v;
    fs.writeFileSync(FILE, JSON.stringify(obj));
  } catch (e) {
    console.warn('[auto-tips] persist failed', e);
  }
}

// ── Known real match results (used to override probabilistic settlements) ──────
// Add any match where we know the real score and want to correct settlement.
const KNOWN_RESULTS: Array<{ home: string; away: string; homeScore: number; awayScore: number }> = [
  { home: 'chapecoense', away: 'clube do remo', homeScore: 2, awayScore: 3 },
  { home: 'chapecoense af', away: 'clube do remo', homeScore: 2, awayScore: 3 },
];

function normTeam(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function applyKnownResults(tips: GeneratedTip[]): boolean {
  let changed = false;
  for (const tip of tips) {
    const th = normTeam(tip.homeTeam || '');
    const ta = normTeam(tip.awayTeam || '');
    for (const kr of KNOWN_RESULTS) {
      const kh = normTeam(kr.home);
      const ka = normTeam(kr.away);
      const homeMatch = th === kh || kh.includes(th) || th.includes(kh);
      const awayMatch = ta === ka || ka.includes(ta) || ta.includes(ka);
      if (homeMatch && awayMatch) {
        const outcome = determineTipOutcome(tip.prediction, kr.homeScore, kr.awayScore, tip.market);
        if (outcome && outcome !== tip.status) {
          tip.status = outcome;
          tip.settledByProb = false;
          changed = true;
        }
      }
    }
  }
  return changed;
}

function load() {
  if (stores.loaded) return;
  stores.loaded = true;
  try {
    if (!fs.existsSync(FILE)) return;
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Record<string, GeneratedTip[]>;
    const allTipsters = getFakeTipsters();
    let needsPersist = false;
    for (const [k, v] of Object.entries(raw)) {
      // Apply known results to fix any probabilistically settled tips on load
      if (applyKnownResults(v)) needsPersist = true;
      stores.byMatch.set(k, v);
      for (const tip of v) {
        const list = stores.byTipster.get(tip.tipsterId) || [];
        list.push(tip);
        stores.byTipster.set(tip.tipsterId, list);
        // Re-seed engagement on cold start so counts/comments survive a restart.
        const others = allTipsters
          .filter(x => x.id !== tip.tipsterId)
          .map(x => ({ id: x.id, username: x.username, displayName: x.displayName, avatar: x.avatar }));
        seedTipEngagement(tip.id, {
          likes: tip.likes,
          comments: tip.comments,
          tipsters: others,
          homeTeam: tip.homeTeam,
          awayTeam: tip.awayTeam,
          venue: 'home',
          confidence: tip.confidence,
          createdAt: tip.createdAt,
          league: tip.league,
          market: tip.market,
          odds: tip.odds,
        });
      }
    }
    // Persist corrected results back to file
    if (needsPersist) persist();
  } catch (e) {
    console.warn('[auto-tips] load failed', e);
  }
}
load();

/**
 * Re-settle all probabilistically-settled tips using the KNOWN_RESULTS list.
 * Call this from admin to fix incorrect WON/LOST badges without restarting.
 */
export function settleByKnownResults(): number {
  let fixed = 0;
  for (const list of stores.byMatch.values()) {
    if (applyKnownResults(list)) fixed++;
  }
  if (fixed > 0) persist();
  return fixed;
}

/**
 * Add a known result and immediately re-settle ALL matching tips (pending,
 * probabilistically settled, or previously settled with wrong real scores).
 * Used from admin to correct specific match outcomes.
 */
export function addKnownResult(
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number,
  matchData?: TipMatchData,
): number {
  let fixed = 0;
  const norm = normTeam;
  const kh = norm(homeTeam);
  const ka = norm(awayTeam);
  for (const list of stores.byMatch.values()) {
    for (const tip of list) {
      const th = norm(tip.homeTeam || '');
      const ta = norm(tip.awayTeam || '');
      const homeMatch = th === kh || kh.includes(th) || th.includes(kh);
      const awayMatch = ta === ka || ka.includes(ta) || ta.includes(ka);
      if (homeMatch && awayMatch) {
        const outcome = determineTipOutcome(tip.prediction, homeScore, awayScore, tip.market, matchData);
        if (outcome && outcome !== tip.status) {
          tip.status = outcome;
          tip.settledByProb = false;
          fixed++;
        } else if (!outcome && tip.status !== 'pending' && tip.settledByProb) {
          // Can't determine outcome (needs special data) — reset to pending so real data can settle it
          tip.status = 'pending';
          tip.settledByProb = false;
          fixed++;
        }
      }
    }
  }
  if (fixed > 0) persist();
  return fixed;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

const FALLBACK_PREDICTIONS = [
  { prediction: 'Home Win', market: 'Match Result (1X2)', marketKey: 'h2h' },
  { prediction: 'Away Win', market: 'Match Result (1X2)', marketKey: 'h2h' },
  { prediction: 'Draw', market: 'Match Result (1X2)', marketKey: 'h2h' },
  { prediction: 'Both Teams to Score - Yes', market: 'BTTS', marketKey: 'btts' },
  { prediction: 'Both Teams to Score - No', market: 'BTTS', marketKey: 'btts' },
  { prediction: 'Over 2.5 Goals', market: 'Over/Under 2.5', marketKey: 'totals' },
  { prediction: 'Under 2.5 Goals', market: 'Over/Under 2.5', marketKey: 'totals' },
  { prediction: 'Home or Draw (1X)', market: 'Double Chance', marketKey: 'dc' },
  { prediction: 'Away or Draw (X2)', market: 'Double Chance', marketKey: 'dc' },
];

// Big diverse analysis pool, grouped by "lens" so the same tipster posting on
// the same match never reads like the previous one. We mix in tipster-name,
// league, sport, and specialty tokens so two tipsters with the same selection
// still produce different copy.
function buildAnalysis(rand: () => number, t: FakeTipster, ctx: MatchContext, sel: string): string {
  const home = ctx.homeTeam;
  const away = ctx.awayTeam;
  const league = ctx.league || 'this fixture';
  const sport = ctx.sport || 'football';
  const spec = t.specialties[0] || sport;
  const stakePct = (1 + Math.floor(rand() * 4) * 0.5).toFixed(1);
  const last5W = 2 + Math.floor(rand() * 3); // 2-4
  const cleanSheets = 1 + Math.floor(rand() * 4);
  const xgFor = (1.1 + rand() * 1.4).toFixed(2);
  const xgAg = (0.9 + rand() * 1.1).toFixed(2);
  const ppg = (1.0 + rand() * 1.4).toFixed(2);

  const lines = [
    // xG / data lens
    `xG model lean: ${sel}. ${away}'s away xGA is trending up (${xgAg}/g) and ${home} are creating ${xgFor} xG/match — fade is alive and inside the ${spec} comfort zone.`,
    `Underlying numbers: ${home} carry ${xgFor} xG/${ppg} PPG into this. ${sel} sits where the data and the price disagree — that's where edge lives.`,
    `Pure data play. ${home} convert at 1.4× league average vs sides ranked outside the top 6. ${sel} is the line that reflects it best.`,
    `Heat-map says ${home} dominate the half-spaces; ${away}'s full-backs leak there. ${sel} is the natural correlation play.`,
    // Form lens
    `${home} have leaked goals in 4 of last 5 — ${sel} keeps us on the right side of the line. ${stakePct}% bankroll only.`,
    `${home} won ${last5W}/5 at home this run-in. ${sel} is the cleanest expression of that form.`,
    `${away} keep ${cleanSheets} clean sheets on the bounce away from home — ${sel} respects that defensive shape.`,
    `Three losses on the trot for ${away} — ${sel} is the obvious read but the price still has juice.`,
    // Tactical lens
    `${home}'s recent form against organised mid-blocks favours value here. ${sel} is the tactical answer to ${away}'s setup.`,
    `${away} press high but their full-backs jump — ${home} have the runners to exploit that. ${sel} fits the tactical mismatch.`,
    `Low-block expected from ${away}; ${home} need set-piece quality to break through. ${sel} respects that pattern.`,
    `Fast restart counters from ${away} could matter — ${sel} gives you exposure either way.`,
    // Market / sharp lens
    `Sharp move overnight on ${sel}; consensus closing line value supports the pick. ${t.specialties.join(' / ')}.`,
    `Public is heavy on the other side of ${sel}; price reflects fade opportunity in ${league}.`,
    `Steam already moved 5p on this market — ${sel} is the side the syndicates have hit.`,
    `Bookmakers shading the favourite, but the underlying probability says ${sel} is closer to a coin-flip than the odds suggest.`,
    // H2H / context lens
    `H2H pattern + tempo data point to ${sel}. ${away}'s key creator is doubtful — adjust your stake accordingly.`,
    `Last four meetings between these two have all hit the ${sel} marker. Trends matter when the line-ups stay similar.`,
    `${home} unbeaten in the last 5 H2H at this venue. ${sel} respects the home advantage angle.`,
    `Reverse fixture finished 1-1 with both sides creating high-value chances. ${sel} expresses that variance.`,
    // News / context lens
    `${home}'s top scorer is back from suspension — ${sel} captures the upgrade in the front line.`,
    `Manager rotation likely with European fixture midweek — ${sel} reads the squad-rest cue correctly.`,
    `${away} travel without their first-choice keeper. ${sel} prices in that drop-off.`,
    `Weather forecast: rain at kickoff, slower surface. That historically nudges ${league} games toward ${sel}.`,
    // Tipster signature lens
    `${t.displayName} reads this one as ${sel}. ${home}'s home record vs organised mid-blocks is the tell.`,
    `${t.displayName}'s ${spec} model has flagged this all week — ${sel} is the highest-value selection on the slate.`,
    `Long-running pattern in ${t.displayName}'s ${spec} workflow: when the public lines up like this, ${sel} pays out.`,
    // Bankroll / discipline lens
    `${stakePct}% bankroll on ${sel}, no parlay. Variance is the only story tonight.`,
    `Single only — accumulators kill ROI on picks like ${sel} priced this fairly.`,
    `Cap exposure at ${stakePct}%. The price is right but the variance is real.`,
  ];
  return lines[Math.floor(rand() * lines.length)];
}

export function seedTipsForMatch(ctx: MatchContext): GeneratedTip[] {
  const existing = stores.byMatch.get(ctx.matchId);
  if (existing && existing.length > 0) return existing;

  const tier = ctx.leagueTier ?? 3;
  const pickers = pickTipstersForMatch(ctx.matchId, tier, ctx.popularity ?? 1);
  if (pickers.length === 0) return [];

  const tips: GeneratedTip[] = [];
  for (let i = 0; i < pickers.length; i++) {
    const t = pickers[i];
    const r = rng(hashStr(`${ctx.matchId}:${t.id}`));

    let prediction: string;
    let market: string;
    let marketKey: string | undefined;
    let odds: number;

    if (ctx.markets && ctx.markets.length > 0) {
      const m = ctx.markets[Math.floor(r() * ctx.markets.length)];
      const sel = m.selections[Math.floor(r() * m.selections.length)];
      prediction = sel.label;
      market = m.name;
      marketKey = m.key;
      odds = sel.odds;
    } else {
      const fp = FALLBACK_PREDICTIONS[Math.floor(r() * FALLBACK_PREDICTIONS.length)];
      prediction = fp.prediction;
      market = fp.market;
      marketKey = fp.marketKey;
      odds = Math.round((1.5 + r() * 2.6) * 100) / 100;
    }

    const confidence = Math.max(50, Math.min(95, Math.round(60 + (t.winRate - 50) + r() * 20)));
    const stake = 1 + Math.floor(r() * 4);
    const isPremium = t.isPro && r() > 0.5;
    const hoursAgo = Math.floor(r() * 36);
    const createdAt = new Date(Date.now() - hoursAgo * 3600_000).toISOString();
    const likes = Math.floor(r() * 80) + 5;
    const dislikes = Math.floor(r() * 12);
    const comments = Math.floor(r() * 18);

    tips.push({
      id: `auto-${ctx.matchId}-${t.id}`,
      matchId: ctx.matchId,
      matchSlug: ctx.matchSlug,
      homeTeam: ctx.homeTeam,
      awayTeam: ctx.awayTeam,
      league: ctx.league,
      sport: ctx.sport,
      kickoff: ctx.kickoff,
      tipsterId: t.id,
      prediction,
      market,
      marketKey,
      odds,
      stake,
      confidence,
      analysis: buildAnalysis(r, t, ctx, prediction),
      isPremium,
      status: 'pending',
      likes,
      dislikes,
      comments,
      createdAt,
    });
  }

  stores.byMatch.set(ctx.matchId, tips);
  // Seed deterministic likes baseline + cross-engagement comments by
  // OTHER fake tipsters (everybody except the tip's author).
  const allTipsters = getFakeTipsters();
  for (const tip of tips) {
    const list = stores.byTipster.get(tip.tipsterId) || [];
    list.push(tip);
    stores.byTipster.set(tip.tipsterId, list);

    const otherTipsters = allTipsters
      .filter(x => x.id !== tip.tipsterId)
      .map(x => ({ id: x.id, username: x.username, displayName: x.displayName, avatar: x.avatar }));
    seedTipEngagement(tip.id, {
      likes: tip.likes,
      comments: tip.comments,
      tipsters: otherTipsters,
      homeTeam: tip.homeTeam,
      awayTeam: tip.awayTeam,
      venue: 'home',
      confidence: tip.confidence,
      createdAt: tip.createdAt,
      league: tip.league,
      market: tip.market,
      odds: tip.odds,
    });
  }
  persist();
  return tips;
}

export function listTipsForMatch(matchId: string): GeneratedTip[] {
  return stores.byMatch.get(matchId) || [];
}

export function listTipsForTipster(tipsterId: number, limit = 25): GeneratedTip[] {
  const list = stores.byTipster.get(tipsterId) || [];
  return list
    .slice()
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .slice(0, limit);
}

export function listAllAutoTips(limit = 50): GeneratedTip[] {
  const all: GeneratedTip[] = [];
  for (const v of stores.byMatch.values()) all.push(...v);
  return all
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .slice(0, limit);
}

export function getAutoTipsStats() {
  let total = 0;
  let won = 0;
  let lost = 0;
  let voided = 0;
  let pending = 0;
  for (const v of stores.byMatch.values()) {
    for (const t of v) {
      total++;
      if (t.status === 'won') won++;
      else if (t.status === 'lost') lost++;
      else if (t.status === 'void') voided++;
      else pending++;
    }
  }
  return { total, won, lost, void: voided, pending, matches: stores.byMatch.size, tipsters: stores.byTipster.size };
}

/**
 * Compute REAL per-tipster settled stats from the auto-tip ledger so the
 * profile page can show actual won/lost/void counts (not just the deterministic
 * fake catalogue numbers). Win rate here = won / (won + lost), void excluded.
 */
export function computeRealTipsterStats(tipsterId: number): {
  totalSettled: number;
  won: number;
  lost: number;
  void: number;
  pending: number;
  winRate: number;
} {
  const list = stores.byTipster.get(tipsterId) || [];
  let won = 0, lost = 0, voided = 0, pending = 0;
  for (const t of list) {
    if (t.status === 'won') won++;
    else if (t.status === 'lost') lost++;
    else if (t.status === 'void') voided++;
    else pending++;
  }
  const decisive = won + lost;
  return {
    totalSettled: won + lost + voided,
    won,
    lost,
    void: voided,
    pending,
    winRate: decisive > 0 ? Math.round((won / decisive) * 1000) / 10 : 0,
  };
}

/**
 * Determine if a tip won or lost based on actual match score.
 * Returns null if the prediction type is unrecognised.
 * Covers: 1X2, Double Chance, Draw No Bet, Over/Under, BTTS,
 * Half-Time Result, Half-Time / Full-Time (X/X format), Odd/Even,
 * Correct Score, Asian Handicap (approximate).
 */
type TipMatchData = {
  htHomeScore?: number | null;
  htAwayScore?: number | null;
  corners?: { home: number; away: number };
  yellowCards?: { home: number; away: number };
  redCards?: { home: number; away: number };
};

function determineTipOutcome(
  prediction: string,
  homeScore: number,
  awayScore: number,
  market?: string,
  matchData?: TipMatchData,
): 'won' | 'lost' | null {
  const total = homeScore + awayScore;
  // Normalise: lowercase, collapse multiple spaces, strip leading/trailing whitespace
  const pred = prediction.toLowerCase().replace(/\s+/g, ' ').trim();
  const mkt = (market || '').toLowerCase().replace(/\s+/g, ' ').trim();

  // ── Half-Time Result ─────────────────────────────────────────────────────
  // Must come FIRST — before 1X2 — because HT markets may use "draw", "home win" etc.
  // Market "Half-Time Result" or "HT Result" — uses HT scores from linescores
  const isHtMarket =
    mkt.includes('half-time result') || mkt.includes('half time result') ||
    mkt === 'ht result' || mkt === 'ht' ||
    mkt.includes('first half result') || mkt.includes('1st half') ||
    pred.includes('half-time') || pred.includes('half time') ||
    pred.startsWith('ht ') || pred === 'ht draw' || pred === 'ht home' || pred === 'ht away';
  if (isHtMarket) {
    const htH = matchData?.htHomeScore;
    const htA = matchData?.htAwayScore;
    if (htH == null || htA == null) return null; // no HT data — keep pending
    // Strip market prefix to get raw selection ("draw", "home win", "away win", etc.)
    const htPred = pred
      .replace(/half[- ]time\s*/gi, '')
      .replace(/^ht\s*/i, '')
      .replace(/result\s*/gi, '')
      .trim();
    // Draw / X
    if (htPred === 'draw' || htPred === 'x' || htPred === 'the draw') return htH === htA ? 'won' : 'lost';
    // Home win
    if (htPred === 'home win' || htPred === '1' || htPred === 'home') return htH > htA ? 'won' : 'lost';
    // Away win
    if (htPred === 'away win' || htPred === '2' || htPred === 'away') return htA > htH ? 'won' : 'lost';
    // Double chance variants in HT market
    if (htPred === '1x' || htPred === 'home or draw') return htH >= htA ? 'won' : 'lost';
    if (htPred === 'x2' || htPred === 'away or draw') return htA >= htH ? 'won' : 'lost';
    if (htPred === '12' || htPred === 'home or away') return htH !== htA ? 'won' : 'lost';
    return null;
  }

  // ── Half-Time / Full-Time (e.g. "1/1", "X/2", "2/1") ───────────────────
  // Also must be before 1X2 checks
  const htFtM = pred.match(/^([12x])\/([12x])$/);
  if (htFtM) {
    const htH = matchData?.htHomeScore;
    const htA = matchData?.htAwayScore;
    if (htH == null || htA == null) return null; // need HT score — keep pending
    const htSide = htH > htA ? '1' : htA > htH ? '2' : 'x';
    const ftSide = homeScore > awayScore ? '1' : awayScore > homeScore ? '2' : 'x';
    return htFtM[1] === htSide && htFtM[2] === ftSide ? 'won' : 'lost';
  }

  // ── Draw No Bet ──────────────────────────────────────────────────────────
  // Check before 1X2 so "draw no bet - home" doesn't match the 1X2 draw branch
  if (pred.includes('draw no bet') || pred.startsWith('dnb') || mkt.includes('draw no bet')) {
    if (homeScore === awayScore) return null; // push/void on a draw
    const homeWin = homeScore > awayScore;
    const isHome = pred.includes('home') || pred.endsWith('- home') || pred === 'dnb home';
    const isAway = pred.includes('away') || pred.endsWith('- away') || pred === 'dnb away';
    if (isHome) return homeWin ? 'won' : 'lost';
    if (isAway) return !homeWin ? 'won' : 'lost';
    return null;
  }

  // ── Double Chance ────────────────────────────────────────────────────────
  // Check before 1X2 so "home or draw" doesn't fall through to draw check
  // 1X = Home or Draw: home wins OR draw → wins when home score >= away score
  if (
    pred === '1x' || pred === 'home or draw' || pred === 'home/draw' ||
    pred.includes('1x (home or draw)') || pred.includes('home or draw (1x)') ||
    pred.startsWith('1x -') || pred.startsWith('home or draw -') ||
    // "Home or Draw (1X)" style labels
    (pred.includes('home') && pred.includes('or') && pred.includes('draw') && !pred.includes('away')) ||
    mkt.includes('double chance') && (pred.includes('1x') || (pred.includes('home') && pred.includes('draw')))
  ) {
    return homeScore >= awayScore ? 'won' : 'lost';
  }
  // X2 = Away or Draw: away wins OR draw → wins when away score >= home score
  if (
    pred === 'x2' || pred === 'away or draw' || pred === 'away/draw' ||
    pred.includes('x2 (away or draw)') || pred.includes('away or draw (x2)') ||
    pred.startsWith('x2 -') || pred.startsWith('away or draw -') ||
    // "Away or Draw (X2)" style labels — away can appear before home in text
    (pred.includes('away') && pred.includes('or') && pred.includes('draw') && !pred.includes('home')) ||
    // Also catch "Away or Draw" when home is not mentioned but draw is
    (pred.includes('x2') && !pred.includes('home')) ||
    mkt.includes('double chance') && (pred.includes('x2') || (pred.includes('away') && pred.includes('draw')))
  ) {
    return awayScore >= homeScore ? 'won' : 'lost';
  }
  // 12 = Home or Away: either team wins (no draw allowed)
  if (
    pred === '12' || pred === 'home or away' || pred === 'home/away' ||
    pred.includes('home or away') || pred.includes('12 (home or away)') ||
    mkt.includes('double chance') && pred.includes('12')
  ) {
    return homeScore !== awayScore ? 'won' : 'lost';
  }

  // ── 1X2 / Match Result ───────────────────────────────────────────────────
  // Home win
  if (
    pred === 'home win' || pred === '1' || pred === 'home' ||
    pred === 'home team to win' || pred === 'home team win' ||
    pred.endsWith(' home win') || pred.endsWith('- home win') ||
    (pred.endsWith(' win') && pred.startsWith('home')) ||
    (mkt.includes('1x2') || mkt.includes('match result') || mkt.includes('match winner')) && pred === '1'
  ) {
    return homeScore > awayScore ? 'won' : 'lost';
  }
  // Away win
  if (
    pred === 'away win' || pred === '2' || pred === 'away' ||
    pred === 'away team to win' || pred === 'away team win' ||
    pred.endsWith(' away win') || pred.endsWith('- away win') ||
    (pred.endsWith(' win') && pred.startsWith('away')) ||
    (mkt.includes('1x2') || mkt.includes('match result') || mkt.includes('match winner')) && pred === '2'
  ) {
    return awayScore > homeScore ? 'won' : 'lost';
  }
  // Draw
  if (
    pred === 'draw' || pred === 'x' || pred === 'the draw' || pred === 'draw (x)' ||
    pred === 'match draw' || pred === 'full time draw' ||
    (pred.endsWith(' draw') && !pred.includes('no bet') && !pred.includes('or') && !pred.includes('away') && !pred.includes('home')) ||
    (mkt.includes('1x2') || mkt.includes('match result')) && (pred === 'draw' || pred === 'x')
  ) {
    return homeScore === awayScore ? 'won' : 'lost';
  }

  // ── BTTS (Both Teams to Score) ────────────────────────────────────────────
  if (
    pred.includes('both teams to score') || pred.includes('both teams score') ||
    pred.startsWith('btts') || mkt.includes('btts') || mkt.includes('both teams to score')
  ) {
    const isNo = pred.includes('- no') || pred.endsWith(' no') || pred === 'btts - no' || pred === 'btts no';
    const isYes = pred.includes('- yes') || pred.endsWith(' yes') || pred === 'btts - yes' || pred === 'btts yes';
    const both = homeScore > 0 && awayScore > 0;
    if (isNo) return !both ? 'won' : 'lost';
    if (isYes || pred.includes('both teams to score')) return both ? 'won' : 'lost';
    // Plain "yes" / "no" under BTTS market
    if (pred === 'yes') return both ? 'won' : 'lost';
    if (pred === 'no') return !both ? 'won' : 'lost';
    return both ? 'won' : 'lost'; // default to "yes" interpretation
  }
  // Standalone yes/no (only if not already caught above)
  if (pred === 'yes') return homeScore > 0 && awayScore > 0 ? 'won' : 'lost';
  if (pred === 'no')  return !(homeScore > 0 && awayScore > 0) ? 'won' : 'lost';

  // ── Over / Under (goals / total) ──────────────────────────────────────────
  // Must come after BTTS and 1X2 checks
  const overM = pred.match(/over\s+([\d.]+)/);
  if (overM) return total > parseFloat(overM[1]) ? 'won' : 'lost';
  const underM = pred.match(/under\s+([\d.]+)/);
  if (underM) return total < parseFloat(underM[1]) ? 'won' : 'lost';
  // "O2.5" / "U2.5" shorthand
  const overShort = pred.match(/^o\s*([\d.]+)$/);
  if (overShort) return total > parseFloat(overShort[1]) ? 'won' : 'lost';
  const underShort = pred.match(/^u\s*([\d.]+)$/);
  if (underShort) return total < parseFloat(underShort[1]) ? 'won' : 'lost';

  // ── Total Corners ──────────────────────────────────────────────────────────
  if (mkt.includes('corner') || pred.includes('corner')) {
    const cd = matchData?.corners;
    if (!cd) return null; // no corner data — keep pending
    const totalCorners = cd.home + cd.away;
    const overC = pred.match(/over\s*([\d.]+)/);
    const underC = pred.match(/under\s*([\d.]+)/);
    if (overC) return totalCorners > parseFloat(overC[1]) ? 'won' : 'lost';
    if (underC) return totalCorners < parseFloat(underC[1]) ? 'won' : 'lost';
    return null;
  }

  // ── Total Cards / Yellow Cards / Red Cards ────────────────────────────────
  if (mkt.includes('card') || pred.includes('yellow card') || pred.includes('red card')) {
    if (mkt.includes('yellow') || pred.includes('yellow')) {
      const yd = matchData?.yellowCards;
      if (!yd) return null;
      const tot = yd.home + yd.away;
      const overY = pred.match(/over\s*([\d.]+)/);
      const underY = pred.match(/under\s*([\d.]+)/);
      if (overY) return tot > parseFloat(overY[1]) ? 'won' : 'lost';
      if (underY) return tot < parseFloat(underY[1]) ? 'won' : 'lost';
    }
    if (mkt.includes('red') || pred.includes('red card')) {
      const rd = matchData?.redCards;
      if (!rd) return null;
      const tot = rd.home + rd.away;
      const overR = pred.match(/over\s*([\d.]+)/);
      if (overR) return tot > parseFloat(overR[1]) ? 'won' : 'lost';
      if (pred.includes('yes')) return tot > 0 ? 'won' : 'lost';
      if (pred.includes('no'))  return tot === 0 ? 'won' : 'lost';
    }
    return null;
  }

  // ── Odd / Even Goals ──────────────────────────────────────────────────────
  if (pred === 'odd' || pred === 'odd goals' || pred === 'total goals odd')  return total % 2 !== 0 ? 'won' : 'lost';
  if (pred === 'even' || pred === 'even goals' || pred === 'total goals even') return total % 2 === 0 ? 'won' : 'lost';

  // ── Correct Score ─────────────────────────────────────────────────────────
  const csM = pred.match(/^(\d+)\s*[:\-]\s*(\d+)$/);
  if (csM) return parseInt(csM[1]) === homeScore && parseInt(csM[2]) === awayScore ? 'won' : 'lost';

  // ── Asian Handicap (approximate — treat as 1X2 direction) ────────────────
  const ahM = pred.match(/asian handicap[:\s]*([-+]?[\d.]+)/);
  if (ahM) {
    const line = parseFloat(ahM[1]);
    const adjHome = homeScore + line;
    if (adjHome > awayScore) return 'won';
    if (adjHome < awayScore) return 'lost';
    return null; // push/void
  }

  // ── Match winner (team-name based — cannot resolve without team names) ────
  if (pred.includes('match winner')) return null;

  return null;
}

// For the admin dashboard: deterministically resolve win/loss for older auto
// tips (kickoff is in the past) so KPIs aren't 100% pending.
// Accepts optional real match result data: Map<matchId, {homeScore, awayScore, ...TipMatchData}>
export function settleStaleAutoTips(
  now = Date.now(),
  realResults?: Map<string, { homeScore: number; awayScore: number } & TipMatchData>,
) {
  let changed = false;
  // Always re-apply known results to fix any probabilistic settlements
  for (const list of stores.byMatch.values()) {
    if (applyKnownResults(list)) changed = true;
  }
  for (const list of stores.byMatch.values()) {
    for (const tip of list) {
      if (tip.status !== 'pending') continue;
      if (!tip.kickoff) continue;
      const t = new Date(tip.kickoff).getTime();
      if (!Number.isFinite(t)) continue;
      // Settle 2h after kickoff
      if (now - t < 2 * 3600_000) continue;

      const r = rng(hashStr(tip.id))();
      // ~3% void rate
      if (r > 0.97) { tip.status = 'void'; changed = true; continue; }

      // Use real match result if available
      const real = realResults?.get(tip.matchId);
      if (real) {
        const outcome = determineTipOutcome(tip.prediction, real.homeScore, real.awayScore, tip.market, real);
        if (outcome) { tip.status = outcome; changed = true; continue; }
      }

      // Don't probabilistically settle markets that require specific stats
      // (HT result, corners, cards, HT/FT) — they need real data, not guesses
      const mktLow = (tip.market || '').toLowerCase();
      const predLow = tip.prediction.toLowerCase();
      const needsSpecialData =
        mktLow.includes('corner') || predLow.includes('corner') ||
        mktLow.includes('card') || predLow.includes('yellow card') || predLow.includes('red card') ||
        mktLow.includes('half-time result') || mktLow.includes('half time result') ||
        mktLow.includes('ht result') || mktLow.includes('first half result') ||
        predLow.includes('half-time') || predLow.includes('half time') || predLow.startsWith('ht ') ||
        /^[12x]\/[12x]$/.test(predLow); // HT/FT double-result format
      if (needsSpecialData) continue; // leave pending — don't guess on these markets

      // Fallback: probabilistic using tipster win rate — mark so real scores can override later
      // Only use probabilistic if the match is MORE than 4 hours old (give APIs time to update)
      const matchAge = now - new Date(tip.kickoff).getTime();
      if (matchAge < 4 * 3600_000) continue; // too soon — keep pending, wait for real data
      const tipster = getFakeTipsterById(tip.tipsterId);
      const winChance = tipster ? tipster.winRate / 100 : 0.55;
      tip.status = r < winChance ? 'won' : 'lost';
      tip.settledByProb = true;
      changed = true;
    }
  }
  if (changed) persist();
}

/**
 * Settle a specific tip immediately using the real match score.
 * Called from the match tips route once the API reports the final score.
 * Re-settles ALL tips for this match — including pending, probabilistic, and
 * any previously incorrectly settled tips — so bad outcomes are always corrected.
 */
export function settleTipWithResult(matchId: string, homeScore: number, awayScore: number, matchData?: TipMatchData) {
  const list = stores.byMatch.get(matchId);
  if (!list) return;
  let changed = false;
  for (const tip of list) {
    // Skip void tips — those are intentional and shouldn't be overridden
    if (tip.status === 'void' && !tip.settledByProb) continue;
    // Allow ~3% void rate for pending tips only (don't re-void already-settled tips)
    const r = rng(hashStr(tip.id))();
    if (r > 0.97 && tip.status === 'pending') {
      tip.status = 'void';
      tip.settledByProb = false;
      changed = true;
      continue;
    }
    const outcome = determineTipOutcome(tip.prediction, homeScore, awayScore, tip.market, matchData);
    if (outcome && outcome !== tip.status) {
      tip.status = outcome;
      tip.settledByProb = false;
      changed = true;
    } else if (outcome && tip.settledByProb) {
      // Confirm the outcome with real data even if status value happens to match
      tip.settledByProb = false;
      changed = true;
    }
  }
  if (changed) persist();
}

/**
 * Settle tips by team name match (fallback when matchId lookup misses).
 * Re-settles ALL matching tips — pending, probabilistic, and incorrectly settled —
 * so every tip gets the correct outcome as soon as real score data is available.
 */
export function settleTipsByTeamNames(homeTeam: string, awayTeam: string, homeScore: number, awayScore: number, matchData?: TipMatchData) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hn = norm(homeTeam);
  const an = norm(awayTeam);
  let changed = false;
  for (const list of stores.byMatch.values()) {
    for (const tip of list) {
      // Skip intentionally voided tips
      if (tip.status === 'void' && !tip.settledByProb) continue;
      const th = norm(tip.homeTeam);
      const ta = norm(tip.awayTeam);
      const matches = (th === hn || hn.includes(th) || th.includes(hn)) &&
                      (ta === an || an.includes(ta) || ta.includes(an));
      if (!matches) continue;
      const r = rng(hashStr(tip.id))();
      if (r > 0.97 && tip.status === 'pending') {
        tip.status = 'void';
        tip.settledByProb = false;
        changed = true;
        continue;
      }
      const outcome = determineTipOutcome(tip.prediction, homeScore, awayScore, tip.market, matchData);
      if (outcome && outcome !== tip.status) {
        tip.status = outcome;
        tip.settledByProb = false;
        changed = true;
      } else if (outcome && tip.settledByProb) {
        tip.settledByProb = false;
        changed = true;
      }
    }
  }
  if (changed) persist();
}

export function getKnownFakeTipsters(): FakeTipster[] {
  return getFakeTipsters();
}
