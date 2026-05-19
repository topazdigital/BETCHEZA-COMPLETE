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
    if (!tip.settledByProb) continue;
    const th = normTeam(tip.homeTeam || '');
    const ta = normTeam(tip.awayTeam || '');
    for (const kr of KNOWN_RESULTS) {
      const kh = normTeam(kr.home);
      const ka = normTeam(kr.away);
      const homeMatch = th === kh || kh.includes(th) || th.includes(kh);
      const awayMatch = ta === ka || ka.includes(ta) || ta.includes(ka);
      if (homeMatch && awayMatch) {
        const outcome = determineTipOutcome(tip.prediction, kr.homeScore, kr.awayScore);
        if (outcome) {
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
 * Add a known result and immediately re-settle any matching tips.
 * Used from admin to correct specific match outcomes.
 */
export function addKnownResult(homeTeam: string, awayTeam: string, homeScore: number, awayScore: number): number {
  let fixed = 0;
  const norm = normTeam;
  const kh = norm(homeTeam);
  const ka = norm(awayTeam);
  for (const list of stores.byMatch.values()) {
    for (const tip of list) {
      if (!tip.settledByProb) continue;
      const th = norm(tip.homeTeam || '');
      const ta = norm(tip.awayTeam || '');
      const homeMatch = th === kh || kh.includes(th) || th.includes(kh);
      const awayMatch = ta === ka || ka.includes(ta) || ta.includes(ka);
      if (homeMatch && awayMatch) {
        const outcome = determineTipOutcome(tip.prediction, homeScore, awayScore);
        if (outcome) {
          tip.status = outcome;
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
function determineTipOutcome(prediction: string, homeScore: number, awayScore: number): 'won' | 'lost' | null {
  const total = homeScore + awayScore;
  const pred = prediction.toLowerCase().trim();

  // ── 1X2 ─────────────────────────────────────────────────────────────────
  if (pred === 'home win' || pred === '1' || pred.endsWith('home win')) {
    return homeScore > awayScore ? 'won' : 'lost';
  }
  if (pred === 'away win' || pred === '2' || pred.endsWith('away win')) {
    return awayScore > homeScore ? 'won' : 'lost';
  }
  if (pred === 'draw' || pred === 'x' || pred.endsWith(' draw') || pred === 'the draw') {
    return homeScore === awayScore ? 'won' : 'lost';
  }

  // ── Double Chance ────────────────────────────────────────────────────────
  if (pred === '1x' || pred.includes('home or draw') || pred.includes('1x (home or draw)')) {
    return homeScore >= awayScore ? 'won' : 'lost';
  }
  if (pred === 'x2' || pred.includes('away or draw') || pred.includes('x2 (away or draw)')) {
    return awayScore >= homeScore ? 'won' : 'lost';
  }
  if (pred === '12' || pred.includes('home or away') || pred.includes('12 (home or away)')) {
    return homeScore !== awayScore ? 'won' : 'lost';
  }

  // ── Over / Under ─────────────────────────────────────────────────────────
  const overM = pred.match(/over\s+([\d.]+)/);
  if (overM) return total > parseFloat(overM[1]) ? 'won' : 'lost';
  const underM = pred.match(/under\s+([\d.]+)/);
  if (underM) return total < parseFloat(underM[1]) ? 'won' : 'lost';

  // ── BTTS ─────────────────────────────────────────────────────────────────
  if (pred.includes('both teams to score') || pred.startsWith('btts')) {
    const no = pred.includes('no') || pred.includes('- no');
    const both = homeScore > 0 && awayScore > 0;
    return (no ? !both : both) ? 'won' : 'lost';
  }
  if (pred === 'yes' && !pred.includes('btts')) return homeScore > 0 && awayScore > 0 ? 'won' : 'lost';
  if (pred === 'no'  && !pred.includes('btts')) return !(homeScore > 0 && awayScore > 0) ? 'won' : 'lost';

  // ── Half-Time / Full-Time (e.g. "1/1", "X/2", "2/1") ───────────────────
  const htFtM = pred.match(/^([12x])\/([12x])$/);
  if (htFtM) {
    // We don't have HT score in the store, so we can only verify FT part.
    // If FT matches, consider it a GUESS — return null to keep pending.
    // This avoids incorrectly settling HT/FT tips.
    return null;
  }

  // ── Odd / Even Goals ────────────────────────────────────────────────────
  if (pred === 'odd')  return total % 2 !== 0 ? 'won' : 'lost';
  if (pred === 'even') return total % 2 === 0 ? 'won' : 'lost';

  // ── Correct Score ────────────────────────────────────────────────────────
  const csM = pred.match(/^(\d+)[:\-](\d+)$/);
  if (csM) return parseInt(csM[1]) === homeScore && parseInt(csM[2]) === awayScore ? 'won' : 'lost';

  // ── Draw No Bet ──────────────────────────────────────────────────────────
  if (pred.includes('draw no bet') || pred.startsWith('dnb')) {
    if (homeScore === awayScore) return null; // push/void
    const homeWin = homeScore > awayScore;
    const isHome = pred.includes('home') || pred.endsWith('- home');
    const isAway = pred.includes('away') || pred.endsWith('- away');
    if (isHome) return homeWin ? 'won' : 'lost';
    if (isAway) return !homeWin ? 'won' : 'lost';
  }

  // ── Asian Handicap (approximate — treat as 1X2 direction) ──────────────
  const ahM = pred.match(/asian handicap[:\s]*([-+]?[\d.]+)/);
  if (ahM) {
    const line = parseFloat(ahM[1]);
    const adjHome = homeScore + line;
    if (adjHome > awayScore) return 'won';
    if (adjHome < awayScore) return 'lost';
    return null; // push
  }

  // ── Half-Time Result (text-based) ────────────────────────────────────────
  // We can't verify without HT score — leave pending
  if (pred.includes('half-time') || pred.includes('half time') || pred.includes('ht ')) {
    return null;
  }

  // ── Match winner (team-name based) ───────────────────────────────────────
  if (pred.includes('match winner')) return null;

  return null;
}

// For the admin dashboard: deterministically resolve win/loss for older auto
// tips (kickoff is in the past) so KPIs aren't 100% pending.
// Accepts optional real match result data: Map<matchId, {homeScore, awayScore}>
export function settleStaleAutoTips(
  now = Date.now(),
  realResults?: Map<string, { homeScore: number; awayScore: number }>,
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
        const outcome = determineTipOutcome(tip.prediction, real.homeScore, real.awayScore);
        if (outcome) { tip.status = outcome; changed = true; continue; }
      }

      // Fallback: probabilistic using tipster win rate — mark so real scores can override later
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
 * Called from the match tips route once ESPN reports the final score.
 */
export function settleTipWithResult(matchId: string, homeScore: number, awayScore: number) {
  const list = stores.byMatch.get(matchId);
  if (!list) return;
  let changed = false;
  for (const tip of list) {
    // Settle pending tips AND override any probabilistic settlements with real scores
    if (tip.status !== 'pending' && !tip.settledByProb) continue;
    const r = rng(hashStr(tip.id))();
    if (r > 0.97 && tip.status === 'pending') { tip.status = 'void'; tip.settledByProb = false; changed = true; continue; }
    const outcome = determineTipOutcome(tip.prediction, homeScore, awayScore);
    if (outcome) { tip.status = outcome; tip.settledByProb = false; changed = true; }
  }
  if (changed) persist();
}

/**
 * Settle tips by team name match (fallback when matchId lookup misses).
 * Also re-settles probabilistically-settled tips with the real score.
 */
export function settleTipsByTeamNames(homeTeam: string, awayTeam: string, homeScore: number, awayScore: number) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hn = norm(homeTeam);
  const an = norm(awayTeam);
  let changed = false;
  for (const list of stores.byMatch.values()) {
    for (const tip of list) {
      if (tip.status !== 'pending' && !tip.settledByProb) continue;
      const th = norm(tip.homeTeam);
      const ta = norm(tip.awayTeam);
      const matches = (th === hn || hn.includes(th) || th.includes(hn)) &&
                      (ta === an || an.includes(ta) || ta.includes(an));
      if (!matches) continue;
      const r = rng(hashStr(tip.id))();
      if (r > 0.97 && tip.status === 'pending') { tip.status = 'void'; tip.settledByProb = false; changed = true; continue; }
      const outcome = determineTipOutcome(tip.prediction, homeScore, awayScore);
      if (outcome) { tip.status = outcome; tip.settledByProb = false; changed = true; }
    }
  }
  if (changed) persist();
}

export function getKnownFakeTipsters(): FakeTipster[] {
  return getFakeTipsters();
}
