// Auto-generated fake-tipster tips on REAL matches.
// Primary storage: MySQL auto_tips table (when DB_HOST is configured).
// Fallback: .local/state/auto-tips.json for dev / no-DB environments.
// Both stores are written on every change; DB takes precedence on startup.

import fs from 'fs';
import path from 'path';
import { getFakeTipsterById, getFakeTipsters, pickTipstersForMatch, type FakeTipster } from './fake-tipsters';
import { seedTipEngagement } from './tip-engagement-store';
import {
  initAutoTipsTable,
  loadAllTipsFromDb,
  upsertTipsToDb,
  bulkUpdateStatusInDb,
} from './auto-tips-db';

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
    console.warn('[auto-tips] persist (JSON) failed', e);
  }
}

// Fire-and-forget DB sync — never blocks the hot path.
function syncToDb(tips: GeneratedTip[]) {
  upsertTipsToDb(tips).catch(e => console.warn('[auto-tips] syncToDb failed', e));
}

function syncStatusesToDb(updates: Array<{ id: string; status: GeneratedTip['status']; settledByProb: boolean }>) {
  bulkUpdateStatusInDb(updates).catch(e => console.warn('[auto-tips] syncStatusesToDb failed', e));
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

// Sports that never end in a draw — Double Chance / Draw markets are invalid for these
const NO_DRAW_SPORTS = new Set([
  'basketball', 'tennis', 'baseball', 'hockey', 'icehockey', 'mma', 'boxing',
  'american-football', 'americanfootball', 'nfl', 'nba', 'mlb', 'nhl',
  'volleyball', 'darts', 'snooker', 'esports',
]);

// Sports where "Both Teams to Score" IS a valid market (teams score independently, no draws)
const BTTS_VALID_SPORTS = new Set([
  'hockey', 'icehockey', 'nhl', 'ice-hockey',
]);

function normSport(sport?: string): string {
  return (sport || '').toLowerCase().replace(/[\s_-]/g, '');
}

function isNoDrawSport(sport?: string): boolean {
  if (!sport) return false;
  return NO_DRAW_SPORTS.has(normSport(sport));
}

/**
 * Returns true if the market is appropriate for the given sport.
 * Prevents soccer-specific markets (Double Chance, BTTS, etc.) being used
 * for no-draw sports like baseball, basketball, tennis.
 * Ice hockey is special: BTTS is valid (both teams regularly score), but
 * Draw / Double Chance / DNB are not (games go to OT/shootout).
 */
function isSportAppropriateMarket(sport: string | undefined, marketName: string, marketKey?: string): boolean {
  if (!sport || !isNoDrawSport(sport)) return true; // soccer/rugby/cricket: all markets OK
  const mn = marketName.toLowerCase();
  const mk = (marketKey || '').toLowerCase();
  const sn = normSport(sport);
  // Draw-dependent markets — never valid for no-draw sports
  if (mk === 'dc' || mn.includes('double chance')) return false;
  if (mn.includes('draw no bet') || mk === 'dnb') return false;
  if (mn.includes('correct score') || mn.includes('exact score')) return false;
  if (mn.includes('half-time') && mn.includes('full-time')) return false;
  if (mn.includes('clean sheet') || mn.includes('win to nil')) return false;
  // BTTS is valid for ice hockey but NOT for baseball/basketball/tennis/etc.
  if (mk === 'btts' || mn.includes('both teams to score') || mn === 'btts') {
    return BTTS_VALID_SPORTS.has(sn);
  }
  return true;
}

/**
 * Removes tips whose market is inappropriate for their sport from the in-memory
 * store (and flags them for DB/file cleanup). Returns count of tips removed.
 */
function purgeSportInappropriateTips(): number {
  let purged = 0;
  for (const [matchId, tips] of stores.byMatch.entries()) {
    const clean = tips.filter(t => isSportAppropriateMarket(t.sport, t.market, t.marketKey));
    if (clean.length !== tips.length) {
      purged += tips.length - clean.length;
      stores.byMatch.set(matchId, clean);
    }
  }
  // Rebuild byTipster index after purge
  stores.byTipster.clear();
  for (const tips of stores.byMatch.values()) {
    for (const t of tips) {
      const list = stores.byTipster.get(t.tipsterId) || [];
      list.push(t);
      stores.byTipster.set(t.tipsterId, list);
    }
  }
  return purged;
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
        const outcome = determineTipOutcome(tip.prediction, kr.homeScore, kr.awayScore, tip.market, undefined, tip.sport);
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

function indexTips(tips: GeneratedTip[]) {
  const allTipsters = getFakeTipsters();
  for (const tip of tips) {
    const existing = stores.byMatch.get(tip.matchId) || [];
    if (!existing.find(t => t.id === tip.id)) existing.push(tip);
    stores.byMatch.set(tip.matchId, existing);
    const list = stores.byTipster.get(tip.tipsterId) || [];
    if (!list.find(t => t.id === tip.id)) list.push(tip);
    stores.byTipster.set(tip.tipsterId, list);
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

async function loadFromDb(): Promise<boolean> {
  try {
    const dbOk = await initAutoTipsTable();
    if (!dbOk) return false;
    const tips = await loadAllTipsFromDb();
    if (!tips) return false;
    let needsCorrection = false;
    if (applyKnownResults(tips)) needsCorrection = true;
    indexTips(tips);
    if (needsCorrection) {
      const statusUpdates = tips.map(t => ({ id: t.id, status: t.status, settledByProb: !!t.settledByProb }));
      syncStatusesToDb(statusUpdates);
    }
    console.log(`[auto-tips] loaded ${tips.length} tips from DB`);
    return true;
  } catch (e) {
    console.warn('[auto-tips] loadFromDb failed:', e);
    return false;
  }
}

function loadFromFile() {
  try {
    if (!fs.existsSync(FILE)) return;
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Record<string, GeneratedTip[]>;
    let needsPersist = false;
    const allTips: GeneratedTip[] = [];
    for (const [, v] of Object.entries(raw)) {
      if (applyKnownResults(v)) needsPersist = true;
      allTips.push(...v);
    }
    indexTips(allTips);
    if (needsPersist) persist();
    // Opportunistically back-fill DB with file data
    if (allTips.length > 0) syncToDb(allTips);
    console.log(`[auto-tips] loaded ${allTips.length} tips from JSON file`);
  } catch (e) {
    console.warn('[auto-tips] loadFromFile failed:', e);
  }
}

function load() {
  if (stores.loaded) return;
  stores.loaded = true;
  // Try DB first (async); fall back to JSON synchronously so the store is
  // immediately usable while DB is connecting on first boot.
  loadFromFile(); // instant — seeds memory right away
  // Remove any previously-generated tips that use sport-inappropriate markets
  // (e.g. BTTS on baseball, Double Chance on basketball). This corrects tips
  // that were generated before sport-awareness was added.
  const purged = purgeSportInappropriateTips();
  if (purged > 0) {
    console.log(`[auto-tips] purged ${purged} sport-inappropriate tips`);
    persist();
  }
  loadFromDb().then(dbOk => {
    if (dbOk) {
      // DB loaded additional / fresher tips — run purge again in case DB had stale entries
      const dbPurged = purgeSportInappropriateTips();
      if (dbPurged > 0) {
        console.log(`[auto-tips] purged ${dbPurged} sport-inappropriate tips from DB`);
        persist();
      }
    }
  });
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
  if (fixed > 0) {
    persist();
    const updates: Array<{ id: string; status: GeneratedTip['status']; settledByProb: boolean }> = [];
    for (const list of stores.byMatch.values())
      for (const t of list) updates.push({ id: t.id, status: t.status, settledByProb: !!t.settledByProb });
    syncStatusesToDb(updates);
  }
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
        const outcome = determineTipOutcome(tip.prediction, homeScore, awayScore, tip.market, matchData, tip.sport);
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
  if (fixed > 0) {
    persist();
    const updates: Array<{ id: string; status: GeneratedTip['status']; settledByProb: boolean }> = [];
    for (const list of stores.byMatch.values())
      for (const t of list) updates.push({ id: t.id, status: t.status, settledByProb: !!t.settledByProb });
    syncStatusesToDb(updates);
  }
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

// Sport-specific fallback predictions — used only when real market odds are unavailable.
// Never includes random/mock odds. Keyed by sportType.
const SPORT_FALLBACK_PREDICTIONS: Record<string, Array<{ prediction: string; market: string; marketKey: string }>> = {
  soccer: [
    { prediction: 'Home Win', market: 'Match Result (1X2)', marketKey: 'h2h' },
    { prediction: 'Away Win', market: 'Match Result (1X2)', marketKey: 'h2h' },
    { prediction: 'Draw', market: 'Match Result (1X2)', marketKey: 'h2h' },
    { prediction: 'Both Teams to Score - Yes', market: 'BTTS', marketKey: 'btts' },
    { prediction: 'Both Teams to Score - No', market: 'BTTS', marketKey: 'btts' },
    { prediction: 'Over 2.5 Goals', market: 'Over/Under 2.5 Goals', marketKey: 'totals' },
    { prediction: 'Under 2.5 Goals', market: 'Over/Under 2.5 Goals', marketKey: 'totals' },
    { prediction: 'Home or Draw (1X)', market: 'Double Chance', marketKey: 'dc' },
    { prediction: 'Away or Draw (X2)', market: 'Double Chance', marketKey: 'dc' },
  ],
  football: [
    { prediction: 'Home Win', market: 'Moneyline', marketKey: 'h2h' },
    { prediction: 'Away Win', market: 'Moneyline', marketKey: 'h2h' },
    { prediction: 'Over 44.5 Points', market: 'Over/Under 44.5 Points', marketKey: 'totals' },
    { prediction: 'Under 44.5 Points', market: 'Over/Under 44.5 Points', marketKey: 'totals' },
    { prediction: 'Home -3.5', market: 'Point Spread', marketKey: 'spreads' },
    { prediction: 'Away +3.5', market: 'Point Spread', marketKey: 'spreads' },
  ],
  basketball: [
    { prediction: 'Home Win', market: 'Moneyline', marketKey: 'h2h' },
    { prediction: 'Away Win', market: 'Moneyline', marketKey: 'h2h' },
    { prediction: 'Over 215.5 Points', market: 'Over/Under 215.5 Points', marketKey: 'totals' },
    { prediction: 'Under 215.5 Points', market: 'Over/Under 215.5 Points', marketKey: 'totals' },
    { prediction: 'Home -4.5', market: 'Point Spread', marketKey: 'spreads' },
    { prediction: 'Away +4.5', market: 'Point Spread', marketKey: 'spreads' },
  ],
  tennis: [
    { prediction: 'Home Win', market: 'Moneyline', marketKey: 'h2h' },
    { prediction: 'Away Win', market: 'Moneyline', marketKey: 'h2h' },
    { prediction: 'Over 22.5 Games', market: 'Over/Under 22.5 Games', marketKey: 'totals' },
    { prediction: 'Under 22.5 Games', market: 'Over/Under 22.5 Games', marketKey: 'totals' },
    { prediction: 'Over 2.5 Sets', market: 'Total Sets', marketKey: 'sets' },
    { prediction: 'Under 2.5 Sets', market: 'Total Sets', marketKey: 'sets' },
  ],
  cricket: [
    { prediction: 'Home Win', market: 'Match Winner', marketKey: 'h2h' },
    { prediction: 'Away Win', market: 'Match Winner', marketKey: 'h2h' },
    { prediction: 'Draw', market: 'Match Winner', marketKey: 'h2h' },
    { prediction: 'Over 300.5 Runs', market: 'Total Runs', marketKey: 'totals' },
    { prediction: 'Under 300.5 Runs', market: 'Total Runs', marketKey: 'totals' },
  ],
  baseball: [
    { prediction: 'Home Win', market: 'Moneyline', marketKey: 'h2h' },
    { prediction: 'Away Win', market: 'Moneyline', marketKey: 'h2h' },
    { prediction: 'Over 8.5 Runs', market: 'Over/Under 8.5 Runs', marketKey: 'totals' },
    { prediction: 'Under 8.5 Runs', market: 'Over/Under 8.5 Runs', marketKey: 'totals' },
    { prediction: 'Home -1.5', market: 'Run Line', marketKey: 'spreads' },
    { prediction: 'Away +1.5', market: 'Run Line', marketKey: 'spreads' },
  ],
  hockey: [
    { prediction: 'Home Win', market: 'Moneyline (60 min)', marketKey: 'h2h' },
    { prediction: 'Away Win', market: 'Moneyline (60 min)', marketKey: 'h2h' },
    { prediction: 'Over 5.5 Goals', market: 'Over/Under 5.5 Goals', marketKey: 'totals' },
    { prediction: 'Under 5.5 Goals', market: 'Over/Under 5.5 Goals', marketKey: 'totals' },
    { prediction: 'Both Teams to Score', market: 'Both Teams to Score', marketKey: 'btts' },
  ],
  mma: [
    { prediction: 'Home Win (Decision)', market: 'Method of Victory', marketKey: 'method' },
    { prediction: 'Away Win (Decision)', market: 'Method of Victory', marketKey: 'method' },
    { prediction: 'Home Win (KO/TKO)', market: 'Method of Victory', marketKey: 'method' },
    { prediction: 'Away Win (KO/TKO)', market: 'Method of Victory', marketKey: 'method' },
    { prediction: 'Fight Goes the Distance - Yes', market: 'Fight Goes the Distance', marketKey: 'distance' },
  ],
  rugby: [
    { prediction: 'Home Win', market: 'Match Result', marketKey: 'h2h' },
    { prediction: 'Away Win', market: 'Match Result', marketKey: 'h2h' },
    { prediction: 'Draw', market: 'Match Result', marketKey: 'h2h' },
    { prediction: 'Over 42.5 Points', market: 'Over/Under 42.5 Points', marketKey: 'totals' },
    { prediction: 'Under 42.5 Points', market: 'Over/Under 42.5 Points', marketKey: 'totals' },
  ],
  golf: [
    { prediction: 'Home Win (Tournament)', market: 'Tournament Winner', marketKey: 'outright' },
    { prediction: 'Away Win (Tournament)', market: 'Tournament Winner', marketKey: 'outright' },
    { prediction: 'Over 69.5 Strokes', market: 'Total Strokes', marketKey: 'totals' },
    { prediction: 'Under 69.5 Strokes', market: 'Total Strokes', marketKey: 'totals' },
  ],
};

function getFallbackPredictions(sport?: string): Array<{ prediction: string; market: string; marketKey: string }> {
  const key = (sport || 'soccer').toLowerCase();
  return SPORT_FALLBACK_PREDICTIONS[key] || SPORT_FALLBACK_PREDICTIONS['soccer'];
}

// Sport-specific analysis templates — each sport has its own vocabulary.
// Never uses xG / full-backs / clean sheets / etc. for non-soccer sports.
const SPORT_ANALYSIS_LINES: Record<string, (home: string, away: string, league: string, sel: string, spec: string, rand: () => number) => string[]> = {
  baseball: (home, away, league, sel, spec, rand) => {
    const era = (3.2 + rand() * 2.1).toFixed(2);
    const whip = (1.1 + rand() * 0.4).toFixed(2);
    const avg = (0.230 + rand() * 0.060).toFixed(3);
    return [
      `Starting pitcher ERA gap backs ${sel}. ${home}'s rotation has a ${era} ERA over the last two starts — lean into the run line.`,
      `Both pitching rotations are solid but ${home}'s bullpen WHIP (${whip}) is the tiebreaker here. ${sel} is the call.`,
      `Batting average against lefty starters strongly favours ${sel}. Spot play on the run line, ${spec} wheelhouse.`,
      `${home}'s closer blew two saves in a row last week — ${sel} targets that vulnerability directly.`,
      `Park factor and today's wind direction lean ${sel} on the total. First-pitch ERA makes this a value play.`,
      `${away}'s lineup is hitting ${avg} on the road this month — ${sel} respects the home-park edge.`,
      `${home} are 7-2 in day games this season. ${sel} captures that scheduling edge; cap at ${(1 + rand() * 3).toFixed(0)}% bankroll.`,
      `WHIP + strikeout rate for tonight's starter makes ${sel} the value side of the run line. Sharp money agrees.`,
      `${away} travel on a back-to-back — fatigue in the bullpen is the hidden angle behind ${sel}.`,
      `H2H at this ballpark has produced under 8.5 runs in 5 of the last 6. ${sel} keeps us on the right side.`,
    ];
  },
  basketball: (home, away, league, sel, spec, rand) => {
    const netRtg = (2 + rand() * 6).toFixed(1);
    const pace = (96 + rand() * 10).toFixed(1);
    return [
      `${home}'s pace (${pace} possessions/game) and 3-point rate at home back ${sel} on the spread. ${spec} model agrees.`,
      `Pace-adjusted efficiency: ${home} carry a +${netRtg} net rating at home vs road-weary opponents. ${sel} is the play.`,
      `${away}'s defensive rating drops 6 points on road — ${sel} exploits that regression. Cap at ${(1 + rand() * 3).toFixed(0)}% bankroll.`,
      `Rebounding edge and second-chance points for ${home} support ${sel}. ${away}'s front-court is short-handed.`,
      `${home} cover the spread in 68% of home games as a single-digit favourite — ${sel} fits the pattern exactly.`,
      `Both offenses rank top-10 in pace — ${sel} on the total is the natural read coming into this one.`,
      `${away}'s star is on a minutes restriction; backup PG is a -3 efficiency drag. ${sel} prices in that drop-off.`,
      `${home}'s 3-point volume vs ${away}'s perimeter defence is the matchup to exploit. ${sel} is the result.`,
      `H2H at this arena: ${home} win outright in 4 of last 5 and cover 3 of those. ${sel} follows the pattern.`,
      `Sharp money moved the line 2 points toward ${sel} overnight — public is fading the wrong side.`,
    ];
  },
  tennis: (home, away, league, sel, spec, rand) => {
    const serveW = (58 + rand() * 18).toFixed(0);
    const bpConv = (38 + rand() * 18).toFixed(0);
    return [
      `Surface form is decisive: ${home}'s win rate on this surface makes ${sel} the standout pick. ${spec} backing.`,
      `First-serve percentage (${serveW}%) and break-point conversion (${bpConv}%) for ${home} support ${sel}.`,
      `H2H on this surface is one-sided — ${sel} respects the pattern and offers closing-line value.`,
      `${away} has dropped a deciding set in three of their last four matches. ${sel} on the sets total is the lean.`,
      `${home} is fresh — ${away} played three-setters in each of the last two rounds. ${sel} is the fatigue play.`,
      `Double-fault rate for ${away} on ${league} surfaces backs ${sel} on the games handicap.`,
      `Serve-hold percentage makes ${sel} on games over/under the clear analytical pick this week.`,
      `${home} won the last meeting in straight sets — ${sel} gives us the same outcome at value odds.`,
      `${away}'s footwork has been below par on this surface — ${sel} exploits the movement disadvantage.`,
      `Cap at ${(1 + rand() * 2).toFixed(0)}% bankroll. Tennis single-match variance is high, but the model says ${sel}.`,
    ];
  },
  hockey: (home, away, league, sel, spec, rand) => {
    const svPct = (0.905 + rand() * 0.020).toFixed(3);
    const ppEff = (16 + rand() * 8).toFixed(1);
    return [
      `${home}'s goaltender save percentage (${svPct}) at home supports ${sel}. Power-play efficiency (${ppEff}%) is the tiebreaker.`,
      `Shot differential and Corsi numbers back ${sel} at even strength — ${spec} read on the puck-possession edge.`,
      `${away}'s penalty kill has been leaking — ${sel} targets the power-play advantage directly.`,
      `Both teams have scored in the opening period in 6 of their last 8 meetings. ${sel} respects that pattern.`,
      `Puck-possession metrics and zone-entry data lean ${sel} over the total. Road back-up in net seals it.`,
      `${home} are 8-2 at home this month — ${sel} is the moneyline read with the ice advantage confirmed.`,
      `${away}'s starting goaltender is questionable — ${sel} prices in that drop-off in the crease.`,
      `H2H at this rink: 5 of last 6 games went over 5.5 goals. ${sel} respects the high-scoring trend.`,
      `Sharp money overnight on ${sel}; syndicate action confirmed on the puck line. ${spec} workflow says take it.`,
      `Cap at ${(1 + rand() * 2).toFixed(0)}% bankroll. Hockey variance is real, but the model rates ${sel} as value.`,
    ];
  },
  football: (home, away, league, sel, spec, rand) => {
    const ypg = (320 + rand() * 120).toFixed(0);
    const tdRatio = (2 + rand() * 1.5).toFixed(1);
    return [
      `${home}'s red zone efficiency and turnover margin support ${sel} on the spread. ${spec} read.`,
      `Yards-per-play differential and third-down conversion rate back ${sel} against ${away}'s defence.`,
      `${away} ranks 28th in pass defence — ${sel} exploits the matchup with ${home}'s air attack (${ypg} py/g).`,
      `${home} cover 71% as a home favourite — ${sel} on the spread has strong historical edge in ${league}.`,
      `Weather: dome game or wind below 10 mph. ${sel} on the total is the environmental play.`,
      `${home}'s rushing attack averages 145 yards per game — ${sel} captures the clock-control edge.`,
      `${away} is 1-6 ATS on the road — ${sel} is the analytical read regardless of the line movement.`,
      `Turnover differential: ${home} +${(1 + rand() * 5).toFixed(0)} on the season. ${sel} stays on the right side of possession.`,
      `${away} travel across two time zones — fatigue angle backs ${sel} in the second half.`,
      `${home} TD-to-INT ratio (${tdRatio}) vs ${away}'s corners backs ${sel} on the moneyline.`,
    ];
  },
  mma: (home, away, _league, sel, spec, rand) => {
    const strAcc = (48 + rand() * 14).toFixed(0);
    const tdDef = (62 + rand() * 20).toFixed(0);
    return [
      `${home}'s striking accuracy (${strAcc}%) vs ${away}'s chin — ${sel} is the method-of-victory lean. ${spec} read.`,
      `Grappling stats: ${home} carries ${tdDef}% takedown defence. ${sel} shuts down the ground game.`,
      `Both fighters are finishers — ${sel} on going the distance is the contrarian value on this card.`,
      `${home} has the reach advantage and 43% more significant strikes landed. ${sel} is backed by the CompuStrike data.`,
      `${away}'s gas tank has been questioned in five-rounders — ${sel} captures that late-round read.`,
      `Judge scoring patterns in this promotion favour ${sel} when the fight stays upright.`,
      `${home} finished the last three opponents inside two rounds. ${sel} on the method market is the call.`,
      `Cardio edge: ${home} trains at altitude — ${sel} holds up in championship rounds.`,
    ];
  },
  cricket: (home, away, league, sel, spec, rand) => {
    const wickets = (3 + rand() * 3).toFixed(1);
    const runs = (240 + rand() * 80).toFixed(0);
    return [
      `Pitch report and toss advantage strongly favour ${sel} in these ${league} conditions. ${spec} call.`,
      `${home}'s bowling attack averages ${wickets} wickets per innings on this surface — ${sel} on the runs market.`,
      `${away}'s top-order batting average in away conditions (${runs} first-innings runs) supports ${sel}.`,
      `${home} have the stronger tail — ${sel} on first-innings runs is where the edge sits.`,
      `Dew factor in the second innings: ${sel} is the read for sides batting second here.`,
      `Both teams' net run-rate and recent form back ${sel} on the match winner market.`,
      `${home} pacers are thriving in current humidity — ${sel} targets the early-wicket angle.`,
      `${away}'s middle order has collapsed in 3 of 4 away Tests — ${sel} is the pressure play.`,
    ];
  },
  rugby: (home, away, league, sel, spec, rand) => {
    const scrumW = (58 + rand() * 18).toFixed(0);
    const tries = (3 + rand() * 2).toFixed(0);
    return [
      `${home}'s scrum dominance (${scrumW}% win rate) and maul success back ${sel}. ${spec} read on the set-piece.`,
      `${away}'s lineout has been unstable — ${sel} targets the set-piece edge at ${league} level.`,
      `${home} dominant at home, averaging 28 points on their own park — ${sel} fits the handicap comfortably.`,
      `Both teams rank top-5 in breakdown turnovers — ${sel} on the total is the tactical read.`,
      `${away} have been leaking tries in the opening 20 minutes — ${sel} exploits that early pressure.`,
      `${home} scored ${tries} tries per game at home this campaign — ${sel} on the try-scorer market is live.`,
      `${away} travel without two first-choice locks — ${sel} targets the lineout disadvantage.`,
      `Kicking game: ${home} territory battle has won 3 of last 4 H2H. ${sel} follows the map.`,
    ];
  },
  volleyball: (home, away, _league, sel, spec, _rand) => [
    `${home}'s serve error rate is the lowest in the division — ${sel} on set totals is backed by the data. ${spec} lean.`,
    `${away} are strong in tiebreaks but ${home}'s block efficiency backs ${sel} on the match outcome.`,
    `Both teams go to five sets frequently in even matchups — ${sel} on the match total captures that variance.`,
    `${home}'s reception percentage (52%) vs ${away}'s serving squad backs ${sel} at home.`,
    `${away}'s setter has been below 60% efficiency away from home — ${sel} exploits that dip.`,
  ],
};

function buildAnalysis(rand: () => number, t: FakeTipster, ctx: MatchContext, sel: string): string {
  const home = ctx.homeTeam;
  const away = ctx.awayTeam;
  const league = ctx.league || 'this fixture';
  const spec = t.specialties[0] || 'value';
  const stakePct = (1 + Math.floor(rand() * 4) * 0.5).toFixed(1);

  // Normalise sport slug to our analysis key
  const rawSport = (ctx.sport || 'soccer').toLowerCase();
  let sportKey = rawSport
    .replace(/american[\s_-]?football|americanfootball|nfl/, 'football')
    .replace(/ice[\s_-]?hockey|nhl/, 'hockey')
    .replace(/nba/, 'basketball')
    .replace(/mlb/, 'baseball');

  const generator = SPORT_ANALYSIS_LINES[sportKey];

  // Tipster signature — ~15% chance regardless of sport
  if (rand() < 0.15) {
    return `${t.displayName}'s ${spec} workflow: ${sel} is the highest-value pick on today's slate. Cap at ${stakePct}% bankroll — single only.`;
  }

  // Sharp/public angle — ~10% chance
  if (rand() < 0.10) {
    return `Sharp move overnight on ${sel}; consensus closing-line value supports the pick. Public is fading the wrong side in ${league}.`;
  }

  if (generator) {
    const lines = generator(home, away, league, sel, spec, rand);
    return lines[Math.floor(rand() * lines.length)];
  }

  // Soccer / default fallback
  const last5W = 2 + Math.floor(rand() * 3);
  const xgFor = (1.1 + rand() * 1.4).toFixed(2);
  const xgAg = (0.9 + rand() * 1.1).toFixed(2);
  const soccerLines = [
    `xG model lean: ${sel}. ${away}'s away xGA is trending up (${xgAg}/g) and ${home} are creating ${xgFor} xG/match — value on the right side.`,
    `${home} have leaked goals in 4 of last 5 — ${sel} keeps us on the right side of the line. ${stakePct}% bankroll only.`,
    `${home} won ${last5W}/5 at home this run-in. ${sel} is the cleanest expression of that form.`,
    `Three losses on the trot for ${away} — ${sel} is the obvious read but the price still has juice.`,
    `H2H pattern + tempo data point to ${sel}. ${away}'s key creator is doubtful — adjust your stake accordingly.`,
    `Last four meetings have all hit the ${sel} marker. Trends matter when the line-ups stay similar.`,
    `${home} unbeaten in the last 5 H2H at this venue. ${sel} respects the home advantage angle.`,
    `Bookmakers shading the favourite, but the underlying probability says ${sel} is closer to a coin-flip.`,
    `${home} dominate the half-spaces; ${away}'s defensive shape leaks there. ${sel} is the tactical read.`,
    `Weather: rain at kickoff, slower surface — that historically nudges ${league} games toward ${sel}.`,
  ];
  return soccerLines[Math.floor(rand() * soccerLines.length)];
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
      // Use real bookmaker market odds — filter to sport-appropriate markets only
      // (prevents Double Chance / BTTS / Draw markets being used for baseball/basketball/tennis)
      const sportSlug = (ctx.sport || '').toLowerCase();
      const suitableMarkets = ctx.markets.filter(mk =>
        isSportAppropriateMarket(sportSlug, mk.name, mk.key) &&
        mk.selections && mk.selections.length > 0 &&
        mk.selections.some(s => s.odds > 1.01)
      );
      const marketsPool = suitableMarkets.length > 0 ? suitableMarkets : ctx.markets;
      const m = marketsPool[Math.floor(r() * marketsPool.length)];
      const validSels = m.selections.filter(s => s.odds > 1.01);
      const sel = (validSels.length > 0 ? validSels : m.selections)[Math.floor(r() * (validSels.length || m.selections.length))];
      prediction = sel.label;
      market = m.name;
      marketKey = m.key;
      odds = sel.odds;
    } else {
      // No real odds available — use sport-correct market names but skip
      // this tipster if odds are genuinely missing (no mock/random odds).
      const fallbacks = getFallbackPredictions(ctx.sport);
      const fp = fallbacks[Math.floor(r() * fallbacks.length)];
      prediction = fp.prediction;
      market = fp.market;
      marketKey = fp.marketKey;
      // No real odds available — skip this tip entirely rather than use mock odds
      odds = 0;
    }

    const confidence = Math.max(50, Math.min(95, Math.round(60 + (t.winRate - 50) + r() * 20)));
    const stake = 1 + Math.floor(r() * 4);
    const isPremium = t.isPro && r() > 0.5;
    const hoursAgo = Math.floor(r() * 36);
    const createdAt = new Date(Date.now() - hoursAgo * 3600_000).toISOString();
    const likes = Math.floor(r() * 80) + 5;
    const dislikes = Math.floor(r() * 12);
    const comments = Math.floor(r() * 18);

    // Skip tip if no real odds are available — no mock odds policy
    if (odds === 0) continue;

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
  syncToDb(tips);
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
 * Find the best-performing tipster for the current week (last 7 days).
 * Falls back to all-time if fewer than 3 tipsters have 3+ settled tips this week.
 * Returns null when there are no settled tips in the system at all.
 */
export function getTopTipsterThisWeek(): {
  tipsterId: number;
  won: number;
  lost: number;
  total: number;
  winRate: number;
  roi: number;
  streak: number;
  isWeekly: boolean;
} | null {
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;

  type Result = { tipsterId: number; won: number; lost: number; winRate: number; roi: number };

  function calcResults(filterSince?: number): Result[] {
    const out: Result[] = [];
    for (const [tid, tips] of stores.byTipster.entries()) {
      const pool = filterSince
        ? tips.filter(t => new Date(t.createdAt).getTime() >= filterSince)
        : tips;
      const settled = pool.filter(t => t.status === 'won' || t.status === 'lost');
      if (settled.length < 3) continue;
      const won = settled.filter(t => t.status === 'won').length;
      const lost = settled.length - won;
      const winRate = Math.round((won / settled.length) * 1000) / 10;
      let totalReturn = 0; let totalStake = 0;
      for (const t of settled) {
        const stake = t.stake > 0 ? t.stake : 1;
        totalReturn += t.status === 'won' ? (t.odds - 1) * stake : -stake;
        totalStake += stake;
      }
      const roi = totalStake > 0 ? Math.round((totalReturn / totalStake) * 1000) / 10 : 0;
      out.push({ tipsterId: tid, won, lost, winRate, roi });
    }
    out.sort((a, b) => b.winRate - a.winRate || b.roi - a.roi || (b.won + b.lost) - (a.won + a.lost));
    return out;
  }

  const weekly = calcResults(since);
  if (weekly.length > 0) {
    const top = weekly[0];
    return { ...top, total: top.won + top.lost, streak: computeRealStreak(top.tipsterId), isWeekly: true };
  }
  const allTime = calcResults();
  if (allTime.length === 0) return null;
  const top = allTime[0];
  return { ...top, total: top.won + top.lost, streak: computeRealStreak(top.tipsterId), isWeekly: false };
}

/**
 * Compute real ROI from the settled tip ledger for a tipster.
 * ROI = (net return / total staked) × 100. Unit-stake assumed where stake = 0.
 */
export function computeRealRoi(tipsterId: number): number {
  const list = stores.byTipster.get(tipsterId) || [];
  const settled = list.filter(t => t.status === 'won' || t.status === 'lost');
  if (settled.length === 0) return 0;
  let totalReturn = 0;
  let totalStake = 0;
  for (const t of settled) {
    const stake = t.stake > 0 ? t.stake : 1;
    totalReturn += t.status === 'won' ? (t.odds - 1) * stake : -stake;
    totalStake += stake;
  }
  return totalStake > 0 ? Math.round((totalReturn / totalStake) * 1000) / 10 : 0;
}

/**
 * Compute real current win/loss streak from the settled tip ledger.
 * Positive = win streak, negative = loss streak, 0 = no settled tips.
 */
export function computeRealStreak(tipsterId: number): number {
  const list = stores.byTipster.get(tipsterId) || [];
  const settled = list.filter(t => t.status === 'won' || t.status === 'lost');
  if (settled.length === 0) return 0;
  const firstStatus = settled[0].status;
  let count = 0;
  for (const t of settled) {
    if (t.status === firstStatus) count++;
    else break;
  }
  return firstStatus === 'won' ? count : -count;
}

/**
 * Determine if a tip won or lost based on actual match score.
 * Returns null if the prediction type is unrecognised.
 * Covers: 1X2, Double Chance, Draw No Bet, Over/Under, BTTS,
 * Half-Time Result, Half-Time / Full-Time (X/X format), Odd/Even,
 * Correct Score, Asian Handicap (approximate).
 */
export type TipMatchData = {
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
  sport?: string,
): 'won' | 'lost' | null {
  const total = homeScore + awayScore;
  const mkt = (market || '').toLowerCase().replace(/\s+/g, ' ').trim();
  // Normalise prediction: lowercase, collapse spaces, strip "marketKey:" prefix
  // (fake-activity cron stores predictions as "dc:Away or Draw" — strip the "dc:" part)
  let rawPred = prediction.toLowerCase().replace(/\s+/g, ' ').trim();
  const prefixEnd = rawPred.indexOf(':');
  if (prefixEnd > 0 && prefixEnd <= 8 && !/^\d/.test(rawPred)) {
    rawPred = rawPred.slice(prefixEnd + 1).trim();
  }
  const pred = rawPred;

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

  // ── First Team to Score ───────────────────────────────────────────────────
  // MUST come before 1X2 — bare "Home"/"Away" predictions are shared with 1X2.
  // We can only settle definitively when one side scored and the other didn't,
  // or when the game ended 0-0. When both teams scored we return null (no guess).
  const isFttsMkt =
    mkt.includes('first team to score') || mkt.includes('first to score') ||
    mkt.includes('first goal scorer') || mkt === 'first scorer' ||
    mkt.includes('first goal') && !mkt.includes('first goalscorer') ||
    pred.includes('first team to score');
  if (isFttsMkt) {
    if (total === 0) {
      // 0-0: no team scored → "None" / "No Goal" wins
      const isNone = pred.includes('none') || pred.includes('no goal') || pred === 'no' || pred === 'draw';
      return isNone ? 'won' : 'lost';
    }
    if (homeScore > 0 && awayScore === 0) {
      // Only home scored → home MUST have scored first
      const isHome = pred.includes('home') || pred === '1';
      return isHome ? 'won' : 'lost';
    }
    if (awayScore > 0 && homeScore === 0) {
      // Only away scored → away MUST have scored first
      const isAway = pred.includes('away') || pred === '2';
      return isAway ? 'won' : 'lost';
    }
    // Both teams scored → cannot determine who scored first from final score alone
    return null; // keep pending; never probabilistically settle
  }

  // ── Win to Nil ────────────────────────────────────────────────────────────
  // "Home Win to Nil": home wins AND away scored 0
  // "Away Win to Nil": away wins AND home scored 0
  // Selections from bookmaker APIs: "Home", "Away", "Neither", "No" (= neither), "Yes"
  const isWtnMkt =
    mkt.includes('win to nil') || mkt.includes('win & clean') ||
    mkt.includes('win and clean') || mkt.includes('win-to-nil') ||
    pred.includes('win to nil') || pred.includes('win-to-nil') ||
    // "Home Win to Nil" / "Away Win to Nil" as standalone prediction strings
    (pred.includes('win') && pred.includes('nil')) ||
    (pred.includes('win') && pred.includes('clean sheet'));
  if (isWtnMkt) {
    const homeWtn = homeScore > awayScore && awayScore === 0;
    const awayWtn = awayScore > homeScore && homeScore === 0;
    // "Neither" / "No" — no team wins to nil
    if (
      pred === 'neither' || pred === 'nether' ||
      pred === 'no' || pred === 'no goal' ||
      pred.includes('neither') || pred.includes('nether')
    ) return (!homeWtn && !awayWtn) ? 'won' : 'lost';
    // "Yes" — any team wins to nil
    if (pred === 'yes') return (homeWtn || awayWtn) ? 'won' : 'lost';
    // Home selections: "Home", "1", "Home Win to Nil", "Win to Nil - Home"
    if (
      pred === 'home' || pred === '1' ||
      pred.includes('home') ||
      (pred.includes('win') && pred.includes('nil') && !pred.includes('away'))
    ) return homeWtn ? 'won' : 'lost';
    // Away selections: "Away", "2", "Away Win to Nil", "Win to Nil - Away"
    if (
      pred === 'away' || pred === '2' ||
      pred.includes('away') ||
      (pred.includes('win') && pred.includes('nil') && !pred.includes('home'))
    ) return awayWtn ? 'won' : 'lost';
    return null;
  }

  // ── Score in Both Halves ──────────────────────────────────────────────────
  // Needs HT score data — return null if unavailable (never probabilistically settle)
  const isScoreBothHalvesMkt =
    mkt.includes('score in both halves') || mkt.includes('score both halves') ||
    mkt.includes('to score in both') || pred.includes('score in both halves') ||
    pred.includes('score both halves');
  if (isScoreBothHalvesMkt) {
    const htH = matchData?.htHomeScore;
    const htA = matchData?.htAwayScore;
    if (htH == null || htA == null) return null; // need HT score — keep pending
    const h2H = homeScore - htH;
    const h2A = awayScore - htA;
    const mktIsHome = mkt.includes('home') || pred.includes('home');
    const mktIsAway = mkt.includes('away') || pred.includes('away');
    if (mktIsAway) {
      const ok = htA > 0 && h2A > 0;
      if (pred === 'yes') return ok ? 'won' : 'lost';
      if (pred === 'no')  return !ok ? 'won' : 'lost';
      return ok ? 'won' : 'lost';
    }
    if (mktIsHome) {
      const ok = htH > 0 && h2H > 0;
      if (pred === 'yes') return ok ? 'won' : 'lost';
      if (pred === 'no')  return !ok ? 'won' : 'lost';
      return ok ? 'won' : 'lost';
    }
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
  // Catch-all for "{Team Name} or Draw" / "Draw or {Team Name}" in Double Chance market.
  // Team names replace "home"/"away" so the checks above won't match.
  // "or Draw" at end → treat as 1X (home or draw); "Draw or" at start → treat as X2 (draw or away).
  if (mkt.includes('double chance') && (pred.includes('or draw') || pred.includes('draw or'))) {
    if (pred.includes('draw or')) return awayScore >= homeScore ? 'won' : 'lost'; // X2-style
    return homeScore >= awayScore ? 'won' : 'lost'; // 1X-style (most common)
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

  // ── BTTS & Result (compound market: result + BTTS) ────────────────────────
  // MUST come before generic BTTS check — "Home & Yes" means home WINS + BTTS,
  // not just BTTS Yes. If treated as pure BTTS it returns wrong outcomes.
  // Market names: "BTTS & Result", "BTTS & Match Result", "Both Teams Score & Result"
  // Predictions: "Home & Yes", "Away & Yes", "Draw & Yes", "Home & No", etc.
  const isBttsAndResult =
    (mkt.includes('btts') || mkt.includes('both teams')) &&
    (mkt.includes('result') || mkt.includes('& result') || mkt.includes('and result'));
  if (isBttsAndResult) {
    const both = homeScore > 0 && awayScore > 0;
    const homeWins = homeScore > awayScore;
    const awayWins = awayScore > homeScore;
    const isDraw = homeScore === awayScore;
    const hasYes = pred.includes('yes') || pred.endsWith('& yes') || pred.includes('& yes');
    const hasNo = pred.includes('no') || pred.endsWith('& no') || pred.includes('& no');
    const bttsPart = hasYes ? both : hasNo ? !both : both; // default yes
    if (pred.includes('home') || pred.startsWith('1 &') || pred.startsWith('1&')) return homeWins && bttsPart ? 'won' : 'lost';
    if (pred.includes('away') || pred.startsWith('2 &') || pred.startsWith('2&')) return awayWins && bttsPart ? 'won' : 'lost';
    if (pred.includes('draw') || pred.startsWith('x &') || pred.startsWith('x&')) return isDraw && bttsPart ? 'won' : 'lost';
    return bttsPart ? 'won' : 'lost'; // fallback: just evaluate BTTS part
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
  // ── Clean Sheet ───────────────────────────────────────────────────────────
  // MUST come before standalone yes/no — "Yes" under "Away Clean Sheet" is a
  // clean-sheet question, NOT a BTTS question.
  // "Home Clean Sheet": the HOME team kept a clean sheet → AWAY scored 0.
  // "Away Clean Sheet": the AWAY team kept a clean sheet → HOME scored 0.
  const isCleanSheetMkt =
    mkt.includes('clean sheet') || pred.includes('clean sheet');
  if (isCleanSheetMkt) {
    const homeCsKept = awayScore === 0;   // home team did not concede
    const awayCsKept = homeScore === 0;   // away team did not concede

    const mktIsAway = mkt.startsWith('away') || mkt.includes('away clean');
    const mktIsHome = mkt.startsWith('home') || mkt.includes('home clean');

    if (mktIsAway) {
      if (pred === 'yes' || pred.endsWith(' yes')) return awayCsKept ? 'won' : 'lost';
      if (pred === 'no'  || pred.endsWith(' no'))  return !awayCsKept ? 'won' : 'lost';
      // "Away Clean Sheet" with just team-direction label
      if (pred.includes('away')) return awayCsKept ? 'won' : 'lost';
      return awayCsKept ? 'won' : 'lost'; // default: "Yes"
    }
    if (mktIsHome) {
      if (pred === 'yes' || pred.endsWith(' yes')) return homeCsKept ? 'won' : 'lost';
      if (pred === 'no'  || pred.endsWith(' no'))  return !homeCsKept ? 'won' : 'lost';
      if (pred.includes('home')) return homeCsKept ? 'won' : 'lost';
      return homeCsKept ? 'won' : 'lost'; // default: "Yes"
    }
    // Generic "Clean Sheet" market where prediction names the side
    if (pred === 'home' || pred === 'home yes') return homeCsKept ? 'won' : 'lost';
    if (pred === 'away' || pred === 'away yes') return awayCsKept ? 'won' : 'lost';
    if (pred === 'both')    return (homeCsKept && awayCsKept) ? 'won' : 'lost'; // 0-0
    if (pred === 'neither') return (!homeCsKept && !awayCsKept) ? 'won' : 'lost';
    if (pred === 'yes') return (homeCsKept || awayCsKept) ? 'won' : 'lost';
    if (pred === 'no')  return (!homeCsKept && !awayCsKept) ? 'won' : 'lost';
    return null;
  }

  // ── Team to Score (Home / Away) ────────────────────────────────────────────
  // "Home Team to Score Yes/No" / "Away Team to Score Yes/No"
  const isTeamToScoreMkt =
    (mkt.includes('home team to score') || mkt.includes('home to score')) ||
    (mkt.includes('away team to score') || mkt.includes('away to score'));
  if (isTeamToScoreMkt) {
    const mktIsAway2 = mkt.includes('away');
    const scored = mktIsAway2 ? awayScore > 0 : homeScore > 0;
    if (pred === 'yes') return scored ? 'won' : 'lost';
    if (pred === 'no')  return !scored ? 'won' : 'lost';
    return scored ? 'won' : 'lost';
  }

  // Standalone yes/no (only if not already caught above)
  if (pred === 'yes') return homeScore > 0 && awayScore > 0 ? 'won' : 'lost';
  if (pred === 'no')  return !(homeScore > 0 && awayScore > 0) ? 'won' : 'lost';

  // ── Total Corners ──────────────────────────────────────────────────────────
  // MUST come before generic Over/Under goals check — "Over 11.5" under a corner
  // market must use corner totals, NOT goal totals.
  if (mkt.includes('corner') || pred.includes('corner')) {
    const cd = matchData?.corners;
    if (!cd) return null; // no corner data — keep pending
    const totalCorners = cd.home + cd.away;
    const overC = pred.match(/over\s*([\d.]+)/i);
    const underC = pred.match(/under\s*([\d.]+)/i);
    if (overC) return totalCorners > parseFloat(overC[1]) ? 'won' : 'lost';
    if (underC) return totalCorners < parseFloat(underC[1]) ? 'won' : 'lost';
    return null;
  }

  // ── Total Cards / Yellow Cards / Red Cards ────────────────────────────────
  // Also before generic Over/Under so "Over 3.5" under a cards market
  // uses card totals, not goal totals.
  if (mkt.includes('card') || pred.includes('yellow card') || pred.includes('red card')) {
    if (mkt.includes('yellow') || pred.includes('yellow')) {
      const yd = matchData?.yellowCards;
      if (!yd) return null;
      const tot = yd.home + yd.away;
      const overY = pred.match(/over\s*([\d.]+)/i);
      const underY = pred.match(/under\s*([\d.]+)/i);
      if (overY) return tot > parseFloat(overY[1]) ? 'won' : 'lost';
      if (underY) return tot < parseFloat(underY[1]) ? 'won' : 'lost';
    }
    if (mkt.includes('red') || pred.includes('red card')) {
      const rd = matchData?.redCards;
      if (!rd) return null;
      const tot = rd.home + rd.away;
      const overR = pred.match(/over\s*([\d.]+)/i);
      if (overR) return tot > parseFloat(overR[1]) ? 'won' : 'lost';
      if (pred.includes('yes')) return tot > 0 ? 'won' : 'lost';
      if (pred.includes('no'))  return tot === 0 ? 'won' : 'lost';
    }
    return null;
  }

  // ── Team Total Goals (Home / Away specific Over/Under) ───────────────────
  // "Home Team Over 1.5" / "Away Team Under 0.5" etc.
  // MUST come before generic Over/Under so team-specific markets use the right score.
  const teamGoalsMktHome =
    mkt.includes('home team goals') || mkt.includes('home goals') ||
    (mkt.includes('home') && (mkt.includes('total goals') || mkt.includes('over/under')));
  const teamGoalsMktAway =
    mkt.includes('away team goals') || mkt.includes('away goals') ||
    (mkt.includes('away') && (mkt.includes('total goals') || mkt.includes('over/under')));
  const predHasTeamGoals =
    /home team (over|under)\s*[\d.]+/i.test(pred) ||
    /away team (over|under)\s*[\d.]+/i.test(pred);
  if (teamGoalsMktHome || teamGoalsMktAway || predHasTeamGoals) {
    const isHomeTeam = teamGoalsMktHome || /home team/i.test(pred);
    const isAwayTeam = teamGoalsMktAway || /away team/i.test(pred);
    const teamScore = isAwayTeam ? awayScore : isHomeTeam ? homeScore : null;
    if (teamScore !== null) {
      const overTG = pred.match(/over\s*([\d.]+)/i);
      const underTG = pred.match(/under\s*([\d.]+)/i);
      if (overTG)  return teamScore > parseFloat(overTG[1])  ? 'won' : 'lost';
      if (underTG) return teamScore < parseFloat(underTG[1]) ? 'won' : 'lost';
    }
  }

  // ── Over / Under (goals / total) ──────────────────────────────────────────
  // Comes AFTER corner/card market checks so those use their own stat sources.
  const overM = pred.match(/over\s+([\d.]+)/i);
  if (overM) return total > parseFloat(overM[1]) ? 'won' : 'lost';
  const underM = pred.match(/under\s+([\d.]+)/i);
  if (underM) return total < parseFloat(underM[1]) ? 'won' : 'lost';
  // "O2.5" / "U2.5" shorthand
  const overShort = pred.match(/^o\s*([\d.]+)$/);
  if (overShort) return total > parseFloat(overShort[1]) ? 'won' : 'lost';
  const underShort = pred.match(/^u\s*([\d.]+)$/);
  if (underShort) return total < parseFloat(underShort[1]) ? 'won' : 'lost';

  // ── Exact Goals / Total Goals Count ──────────────────────────────────────
  // "Exactly 2 Goals" / "2 Goals" / "4+ Goals" etc.
  const exactGoalsM = pred.match(/^(?:exactly\s+)?(\d+)\+?\s*goals?$/i);
  if (exactGoalsM) {
    const n = parseInt(exactGoalsM[1]);
    return pred.includes('+') ? (total >= n ? 'won' : 'lost') : (total === n ? 'won' : 'lost');
  }
  // Catch "N goals" under an "Exact Goals" or "Total Goals" market
  if (mkt.includes('exact goals') || mkt.includes('exact total')) {
    const exactM2 = pred.match(/^(\d+)\+?$/);
    if (exactM2) {
      const n2 = parseInt(exactM2[1]);
      return pred.includes('+') ? (total >= n2 ? 'won' : 'lost') : (total === n2 ? 'won' : 'lost');
    }
  }

  // ── Odd / Even Goals ──────────────────────────────────────────────────────
  if (pred === 'odd' || pred === 'odd goals' || pred === 'total goals odd')  return total % 2 !== 0 ? 'won' : 'lost';
  if (pred === 'even' || pred === 'even goals' || pred === 'total goals even') return total % 2 === 0 ? 'won' : 'lost';

  // ── Correct Score ─────────────────────────────────────────────────────────
  const csM = pred.match(/^(\d+)\s*[:\-]\s*(\d+)$/);
  if (csM) return parseInt(csM[1]) === homeScore && parseInt(csM[2]) === awayScore ? 'won' : 'lost';
  // "Any Other Score" under Correct Score market — wins when no exact score matched
  if ((mkt.includes('correct score') || mkt.includes('exact score')) &&
      (pred === 'any other' || pred === 'any other score' || pred === 'other')) {
    return null; // cannot determine without full correct score set — keep pending
  }

  // ── Asian Handicap (approximate — treat as 1X2 direction) ────────────────
  const ahM = pred.match(/asian handicap[:\s]*([-+]?[\d.]+)/);
  if (ahM) {
    const line = parseFloat(ahM[1]);
    const adjHome = homeScore + line;
    if (adjHome > awayScore) return 'won';
    if (adjHome < awayScore) return 'lost';
    return null; // push/void
  }

  // ── Handicap / Spreads (European / regular handicap) ─────────────────────
  // Market "Handicap" or marketKey "spreads". Predictions: "Home -1.5", "Away +0.5".
  // Apply the handicap adjustment to the named side and evaluate.
  if ((mkt.includes('handicap') || mkt.includes('spread')) && !mkt.includes('asian')) {
    // Prediction has explicit line: "Home -1.5", "Away +2", etc.
    const homeHcapM = pred.match(/home\s*([-+][\d.]+)/i);
    const awayHcapM = pred.match(/away\s*([-+][\d.]+)/i);
    if (homeHcapM) {
      const adj = homeScore + parseFloat(homeHcapM[1]);
      if (adj > awayScore) return 'won';
      if (adj < awayScore) return 'lost';
      return null; // push
    }
    if (awayHcapM) {
      const adj = awayScore + parseFloat(awayHcapM[1]);
      if (adj > homeScore) return 'won';
      if (adj < homeScore) return 'lost';
      return null; // push
    }
    // Prediction is bare "Home"/"Away"/"Draw" — treat as standard 1X2 direction
    if (pred === 'home' || pred === '1') return homeScore > awayScore ? 'won' : 'lost';
    if (pred === 'away' || pred === '2') return awayScore > homeScore ? 'won' : 'lost';
    if (pred === 'draw' || pred === 'x') return homeScore === awayScore ? 'won' : 'lost';
  }

  // ── Match winner (team-name based — cannot resolve without team names) ────
  if (pred.includes('match winner')) return null;

  // ── Goalscorer / Player markets — need event-level data, never guess ──────
  if (
    mkt.includes('goalscorer') || mkt.includes('goal scorer') ||
    mkt.includes('anytime scorer') || mkt.includes('first scorer') ||
    mkt.includes('last scorer') || mkt.includes('player to score')
  ) return null;

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

  // FIRST PASS: correct any probabilistically-settled or wrongly-settled tips
  // using real match data — this must happen BEFORE the pending-only pass below
  if (realResults && realResults.size > 0) {
    for (const list of stores.byMatch.values()) {
      for (const tip of list) {
        // Only skip intentionally voided non-prob tips
        if (tip.status === 'void' && !tip.settledByProb) continue;
        // Skip tips that are correctly settled with real data (not prob)
        if ((tip.status === 'won' || tip.status === 'lost') && !tip.settledByProb) continue;
        // Only process if kickoff has passed
        if (!tip.kickoff) continue;
        const kt = new Date(tip.kickoff).getTime();
        if (!Number.isFinite(kt) || now - kt < 2 * 3600_000) continue;

        // Try exact matchId lookup first
        let real = realResults.get(tip.matchId);

        // Fallback: fuzzy team-name search when matchId format doesn't align
        // This is the critical fix — prevents wrong prob settlements from persisting
        if (!real && tip.homeTeam && tip.awayTeam) {
          const th = normTeam(tip.homeTeam);
          const ta = normTeam(tip.awayTeam);
          for (const v of realResults.values()) {
            const rh = normTeam((v as { homeTeam?: string }).homeTeam || '');
            const ra = normTeam((v as { awayTeam?: string }).awayTeam || '');
            if (!rh || !ra) continue;
            const homeMatch = th === rh || rh.includes(th) || th.includes(rh);
            const awayMatch = ta === ra || ra.includes(ta) || ta.includes(ra);
            if (homeMatch && awayMatch) { real = v; break; }
          }
        }

        if (!real) continue;
        const outcome = determineTipOutcome(tip.prediction, real.homeScore, real.awayScore, tip.market, real, tip.sport);
        if (outcome && (outcome !== tip.status || tip.settledByProb)) {
          tip.status = outcome;
          tip.settledByProb = false;
          changed = true;
        }
      }
    }
  }

  // SECOND PASS: handle genuinely pending tips — settle with real data or probabilistically
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
      if (r > 0.97) { tip.status = 'void'; tip.settledByProb = false; changed = true; continue; }

      // Try direct matchId lookup first
      let real2 = realResults?.get(tip.matchId);

      // Fallback: fuzzy team-name search when matchId format doesn't align
      if (!real2 && realResults && tip.homeTeam && tip.awayTeam) {
        const th2 = normTeam(tip.homeTeam);
        const ta2 = normTeam(tip.awayTeam);
        for (const v of realResults.values()) {
          const rh2 = normTeam((v as { homeTeam?: string }).homeTeam || '');
          const ra2 = normTeam((v as { awayTeam?: string }).awayTeam || '');
          if (!rh2 || !ra2) continue;
          const hm2 = th2 === rh2 || rh2.includes(th2) || th2.includes(rh2);
          const am2 = ta2 === ra2 || ra2.includes(ta2) || ta2.includes(ra2);
          if (hm2 && am2) { real2 = v; break; }
        }
      }

      // Use real match result if available (exact or fuzzy matched)
      if (real2) {
        const outcome = determineTipOutcome(tip.prediction, real2.homeScore, real2.awayScore, tip.market, real2, tip.sport);
        if (outcome) { tip.status = outcome; tip.settledByProb = false; changed = true; continue; }
      }

      // Don't probabilistically settle markets where a tipster win-rate guess
      // would be systematically wrong — these MUST be settled with real data only.
      const mktLow = (tip.market || '').toLowerCase();
      const predLow = tip.prediction.toLowerCase();
      const needsRealData =
        // Stat-collection markets — need actual corner/card data
        mktLow.includes('corner') || predLow.includes('corner') ||
        mktLow.includes('card') || predLow.includes('yellow card') || predLow.includes('red card') ||
        // Half-time markets — need HT score
        mktLow.includes('half-time result') || mktLow.includes('half time result') ||
        mktLow.includes('ht result') || mktLow.includes('first half result') ||
        predLow.includes('half-time') || predLow.includes('half time') || predLow.startsWith('ht ') ||
        /^[12x]\/[12x]$/.test(predLow) || // HT/FT double-result format
        // Score-in-both-halves needs HT score
        mktLow.includes('score in both halves') || mktLow.includes('score both halves') ||
        mktLow.includes('to score in both') ||
        // First Team to Score: ambiguous when both teams scored — needs event data
        mktLow.includes('first team to score') || mktLow.includes('first to score') ||
        mktLow === 'first scorer' || (mktLow.includes('first goal') && !mktLow.includes('scorer')) ||
        // Goalscorer / player markets — always need event-level data
        mktLow.includes('goalscorer') || mktLow.includes('goal scorer') ||
        mktLow.includes('anytime scorer') || mktLow.includes('player to score') ||
        mktLow.includes('first scorer') || mktLow.includes('last scorer') ||
        mktLow.includes('player ') || mktLow.startsWith('player') ||
        // Win to Nil — clean-sheet-win probability is much lower than general win rate.
        // A tipster with 60% win rate does NOT have 60% chance of winning to nil.
        mktLow.includes('win to nil') || mktLow.includes('win & clean') ||
        mktLow.includes('win and clean') || predLow.includes('win to nil') ||
        // Clean Sheet — depends on actual defensive outcome, not win rate
        mktLow.includes('clean sheet') || predLow.includes('clean sheet') ||
        // Correct / Exact Score — probability is always much lower than win rate
        mktLow.includes('correct score') || mktLow.includes('exact score') ||
        mktLow.includes('scoreline') ||
        // Score in Both Halves — needs HT data
        mktLow.includes('score both halves') || mktLow.includes('score in both') ||
        // BTTS — both teams scoring is independent of which tipster is posting
        mktLow.includes('btts') || mktLow.includes('both teams to score') ||
        predLow.includes('both teams to score') ||
        // Asian Handicap / Spread — line-specific, win rate doesn't apply
        mktLow.includes('asian handicap') || mktLow.includes('asian hcap') ||
        (mktLow.includes('handicap') && mktLow.includes('asian')) ||
        // Moneyline / spread for non-soccer sports (points-based)
        mktLow.includes('point spread') || mktLow.includes('run line') || mktLow.includes('puck line') ||
        // Team to Score Yes/No — needs actual scoring data
        mktLow.includes('team to score') || mktLow.includes('to score') ||
        // Odd/Even goals — 50/50, win rate irrelevant
        mktLow.includes('odd/even') || mktLow.includes('odd or even') ||
        predLow === 'odd' || predLow === 'even' ||
        // Double Chance (1X / X2 / 12) — directional market: win rate doesn't tell you
        // which direction the tipster backed. Must always settle from real scores.
        mktLow.includes('double chance') || mktLow === 'dc';
      if (needsRealData) continue; // leave pending — real data will settle these correctly

      // Fallback: probabilistic using tipster win rate — ONLY for simple 1X2 / match winner
      // markets where the tipster's win rate is a reasonable proxy.
      // Mark as settledByProb so real scores always override this later.
      // Only fire after 4 hours to give all score APIs time to update.
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
 * Bulk re-settle ALL stored tips using a full map of real match results.
 * Corrects any wrong outcomes — including probabilistic, wrong real-data, and pending.
 * This is the single source of truth for settlement correctness.
 * Call this whenever you have fresh real match data (cron, tipster page, match page).
 */
export function bulkResettleWithRealData(
  realResults: Map<string, { homeScore: number; awayScore: number } & TipMatchData>,
  now = Date.now(),
): number {
  let corrected = 0;
  for (const list of stores.byMatch.values()) {
    for (const tip of list) {
      // Never override an intentionally voided (non-prob) tip
      if (tip.status === 'void' && !tip.settledByProb) continue;
      // Only process tips whose kickoff has passed (2h grace period)
      if (!tip.kickoff) continue;
      const kt = new Date(tip.kickoff).getTime();
      if (!Number.isFinite(kt) || now - kt < 2 * 3600_000) continue;

      // Try exact matchId lookup first
      let real = realResults.get(tip.matchId);

      // Fallback: fuzzy team-name search — critical for correcting prob-settled tips
      // when the matchId stored in the tip doesn't match the API's ID format
      if (!real && tip.homeTeam && tip.awayTeam) {
        const th = normTeam(tip.homeTeam);
        const ta = normTeam(tip.awayTeam);
        for (const v of realResults.values()) {
          const rh = normTeam((v as { homeTeam?: string }).homeTeam || '');
          const ra = normTeam((v as { awayTeam?: string }).awayTeam || '');
          if (!rh || !ra) continue;
          const homeMatch = th === rh || rh.includes(th) || th.includes(rh);
          const awayMatch = ta === ra || ra.includes(ta) || ta.includes(ra);
          if (homeMatch && awayMatch) { real = v; break; }
        }
      }

      if (!real) continue;

      const r = rng(hashStr(tip.id))();
      // Void rate only applies to tips that are still pending
      if (tip.status === 'pending' && r > 0.97) {
        tip.status = 'void';
        tip.settledByProb = false;
        corrected++;
        continue;
      }

      const outcome = determineTipOutcome(tip.prediction, real.homeScore, real.awayScore, tip.market, real, tip.sport);
      if (!outcome) continue; // cannot determine — leave as-is (HT with no HT data, etc.)

      if (outcome !== tip.status || tip.settledByProb) {
        tip.status = outcome;
        tip.settledByProb = false;
        corrected++;
      }
    }
  }
  if (corrected > 0) {
    persist();
    const updates: Array<{ id: string; status: GeneratedTip['status']; settledByProb: boolean }> = [];
    for (const list of stores.byMatch.values())
      for (const t of list) updates.push({ id: t.id, status: t.status, settledByProb: !!t.settledByProb });
    syncStatusesToDb(updates);
  }
  return corrected;
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
    const outcome = determineTipOutcome(tip.prediction, homeScore, awayScore, tip.market, matchData, tip.sport);
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
  if (changed) {
    persist();
    if (list) syncStatusesToDb(list.map(t => ({ id: t.id, status: t.status, settledByProb: !!t.settledByProb })));
  }
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
      const outcome = determineTipOutcome(tip.prediction, homeScore, awayScore, tip.market, matchData, tip.sport);
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
  if (changed) {
    persist();
    const updates: Array<{ id: string; status: GeneratedTip['status']; settledByProb: boolean }> = [];
    for (const list of stores.byMatch.values())
      for (const t of list) updates.push({ id: t.id, status: t.status, settledByProb: !!t.settledByProb });
    syncStatusesToDb(updates);
  }
}

/**
 * Fix existing auto-tips that have sport-inappropriate markets.
 * For no-draw sports (baseball, basketball, tennis, hockey) with soccer-specific markets:
 *  - Double Chance X2 → normalized to "Away Win" Moneyline (same settlement direction)
 *  - Double Chance 1X → normalized to "Home Win" Moneyline
 *  - Double Chance 12 → kept (any decisive result = always true in no-draw sports)
 *  - BTTS / Draw No Bet for no-draw sports → voided (market doesn't apply)
 * All affected tips that were probabilistically (incorrectly) settled are reset to
 * pending so the next settle-tips cron run can re-settle them with real scores.
 * Returns count of tips modified.
 */
export function fixSportSpecificMarkets(): number {
  let fixed = 0;
  for (const list of stores.byMatch.values()) {
    for (const tip of list) {
      if (!tip.sport || !isNoDrawSport(tip.sport)) continue;
      const mktLow = tip.market.toLowerCase();
      const mkLow = (tip.marketKey || '').toLowerCase();

      // Fix: Double Chance for no-draw sports
      if (mkLow === 'dc' || mktLow.includes('double chance')) {
        let predLow = tip.prediction.toLowerCase().trim();
        // Strip market key prefix (e.g., "dc:Away or Draw" → "Away or Draw")
        if (predLow.indexOf(':') > 0 && predLow.indexOf(':') <= 8) {
          predLow = predLow.slice(predLow.indexOf(':') + 1).trim();
        }
        const isX2 = predLow === 'x2' || predLow === 'away or draw' ||
          predLow === 'away/draw' || predLow.includes('away or draw') ||
          (predLow.includes('away') && predLow.includes('draw'));
        const is1X = predLow === '1x' || predLow === 'home or draw' ||
          predLow === 'home/draw' || predLow.includes('home or draw') ||
          (predLow.includes('home') && predLow.includes('draw') && !predLow.includes('away'));
        // 12 (Home or Away, either wins) — valid in no-draw sports, just rename to Moneyline Either
        const is12 = predLow === '12' || predLow === 'home or away' || predLow === '1 or 2';

        if (isX2) {
          tip.market = 'Moneyline';
          tip.marketKey = 'h2h';
          tip.prediction = 'Away Win';
          // Reset to pending if it was prob-settled (so real data can re-settle it)
          if (tip.settledByProb || tip.status === 'pending') {
            tip.status = 'pending';
            tip.settledByProb = false;
          }
          fixed++;
        } else if (is1X) {
          tip.market = 'Moneyline';
          tip.marketKey = 'h2h';
          tip.prediction = 'Home Win';
          if (tip.settledByProb || tip.status === 'pending') {
            tip.status = 'pending';
            tip.settledByProb = false;
          }
          fixed++;
        } else if (is12) {
          // 12 (Home or Away wins) = always won in no-draw sports — keep as Double Chance 12
          // so determineTipOutcome still hits the "homeScore !== awayScore" check correctly.
          // Just reset to pending if prob-settled wrongly.
          if (tip.settledByProb) {
            tip.status = 'pending';
            tip.settledByProb = false;
            fixed++;
          }
        }
        continue;
      }

      // Void BTTS for no-draw sports (doesn't make sense — e.g. baseball scoring is different)
      if (mkLow === 'btts' || mktLow.includes('both teams to score')) {
        if (tip.status === 'pending' || tip.settledByProb) {
          tip.status = 'void';
          tip.settledByProb = false;
          fixed++;
        }
        continue;
      }

      // Void Draw No Bet for no-draw sports (draw refund doesn't apply)
      if (mkLow === 'dnb' || mktLow.includes('draw no bet')) {
        if (tip.status === 'pending' || tip.settledByProb) {
          tip.status = 'void';
          tip.settledByProb = false;
          fixed++;
        }
      }
    }
  }

  if (fixed > 0) {
    persist();
    const updates: Array<{ id: string; status: GeneratedTip['status']; settledByProb: boolean }> = [];
    for (const list of stores.byMatch.values())
      for (const t of list) updates.push({ id: t.id, status: t.status, settledByProb: !!t.settledByProb });
    syncStatusesToDb(updates);
    console.log(`[auto-tips] fixSportSpecificMarkets: normalised ${fixed} tips`);
  }
  return fixed;
}

export function getKnownFakeTipsters(): FakeTipster[] {
  return getFakeTipsters();
}
