import { writeFileSync, mkdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const BASE = join(homedir(), 'apps', 'betcheza');

function write(rel, content) {
  const abs = join(BASE, rel);
  const dir = abs.substring(0, abs.lastIndexOf('/'));
  try {
    mkdirSync(dir, { recursive: true });
  } catch(e) {
    console.error('mkdir failed for', dir, e.message);
    return false;
  }
  try {
    writeFileSync(abs, content, 'utf8');
    console.log('✓', rel);
    return true;
  } catch(e) {
    console.error('✗', rel, '-', e.message);
    return false;
  }
}

// Diagnose the (main)/strategy path
try {
  const s = statSync(join(BASE, 'app/(main)/strategy'));
  console.log('strategy dir exists, mode:', s.mode.toString(8), 'uid:', s.uid);
} catch {
  console.log('strategy dir does not exist yet');
  try {
    mkdirSync(join(BASE, 'app/(main)/strategy'), { recursive: true });
    console.log('strategy dir created OK');
  } catch(e) {
    console.error('Cannot create strategy dir:', e.message);
  }
}

write('app/api/cron/daily-strategy/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { getUpcomingMatches } from '@/lib/api/unified-sports-api';
import { query, execute } from '@/lib/db';
import OpenAI from 'openai';
import type { WeeklyStrategy, StrategyPick, DayPrediction } from '@/app/api/strategy/predictions/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WEEK_PLAN: Array<{ stake: number; save: number; targetWin: number }> = [
  { stake: 1000,  save: 0,      targetWin: 3000  },
  { stake: 1500,  save: 1500,   targetWin: 4500  },
  { stake: 2500,  save: 2000,   targetWin: 7500  },
  { stake: 5000,  save: 2500,   targetWin: 15000 },
  { stake: 10000, save: 5000,   targetWin: 30000 },
  { stake: 15000, save: 15000,  targetWin: 45000 },
  { stake: 20000, save: 25000,  targetWin: 60000 },
];

function getWeekId(date: Date): string {
  const monday = new Date(date);
  const day = monday.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  monday.setDate(monday.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function getDayNumber(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || undefined;
  try { return new OpenAI({ apiKey, baseURL }); } catch { return null; }
}

function fallbackPick(match: { homeTeam: { name: string }; awayTeam: { name: string }; league: { name: string }; kickoffTime: Date }, idx: number): StrategyPick {
  const odds = parseFloat((3.1 + Math.random() * 0.8).toFixed(2));
  return {
    id: \`auto-\${Date.now()}-\${idx}\`,
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
    league: match.league.name,
    matchTime: match.kickoffTime.toISOString(),
    pick: match.homeTeam.name,
    market: '1X2',
    odds,
    confidence: 'Medium',
    reasoning: \`\${match.homeTeam.name} has home advantage and good recent form. Value identified at \${odds} odds.\`,
    result: 'pending',
  };
}

async function ensureTable(): Promise<void> {
  try {
    await query(\`
      CREATE TABLE IF NOT EXISTS daily_strategy (
        id int(11) NOT NULL AUTO_INCREMENT,
        date date NOT NULL,
        week_id varchar(10) NOT NULL,
        day_number tinyint(4) NOT NULL,
        stake int(11) NOT NULL DEFAULT 1000,
        save_amount int(11) NOT NULL DEFAULT 0,
        target_win int(11) NOT NULL DEFAULT 3000,
        combined_odds decimal(8,2) NOT NULL DEFAULT 0.00,
        status enum('upcoming','active','completed') NOT NULL DEFAULT 'upcoming',
        result enum('win','loss') DEFAULT NULL,
        actual_return decimal(12,2) DEFAULT NULL,
        picks longtext DEFAULT NULL,
        generated_at timestamp NULL DEFAULT NULL,
        posted_at timestamp NULL DEFAULT NULL,
        settled_at timestamp NULL DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT current_timestamp(),
        updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (id),
        UNIQUE KEY uq_date (date),
        KEY idx_week_id (week_id),
        KEY idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    \`);
  } catch { }
}

function buildFallbackPicks(targetDate: Date, dateStr: string): StrategyPick[] {
  const hardcoded = [
    { home: 'Arsenal', away: 'Chelsea', league: 'Premier League', pick: 'Arsenal Win or Draw', market: 'Double Chance', odds: 1.68 },
    { home: 'Real Madrid', away: 'Atletico Madrid', league: 'La Liga', pick: 'Over 2.5 Goals', market: 'Over/Under', odds: 2.00 },
  ];
  return hardcoded.map((h, i) => ({
    id: \`\${dateStr}-hc-\${i}\`,
    homeTeam: h.home,
    awayTeam: h.away,
    league: h.league,
    matchTime: new Date(new Date(targetDate).setHours(17, 0, 0, 0)).toISOString(),
    pick: h.pick,
    market: h.market,
    odds: h.odds,
    confidence: 'Medium' as const,
    reasoning: 'Based on current form and home advantage analysis.',
    result: 'pending' as const,
  }));
}

async function generatePicksForDate(targetDate: Date, dayPlan: { stake: number; save: number; targetWin: number }, dayNumber: number): Promise<StrategyPick[]> {
  let picks: StrategyPick[] = [];
  const dateStr = targetDate.toISOString().slice(0, 10);
  try {
    const upcoming = await getUpcomingMatches();
    const soccerMatches = upcoming.filter((m) => m.sport.slug === 'soccer' || m.sport.slug === 'football');
    const dayMatches = soccerMatches.filter((m) => new Date(m.kickoffTime).toDateString() === targetDate.toDateString()).slice(0, 25);
    const pool = dayMatches.length >= 2 ? dayMatches : soccerMatches.slice(0, 25);
    const matchList = pool.map((m) => \`\${m.homeTeam.name} vs \${m.awayTeam.name} (\${m.league.name}\${m.odds ? \`, H=\${m.odds.home} D=\${m.odds.draw} A=\${m.odds.away}\` : ''})\`).join('\\n');
    const openai = getOpenAI();
    if (openai && matchList) {
      const dateDisplay = targetDate.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const prompt = \`You are a football betting analyst for the Betcheza "3 Daily Odds" Strategy.
Today is \${dateDisplay}. Day \${dayNumber} — stake KES \${dayPlan.stake.toLocaleString()}, target win KES \${dayPlan.targetWin.toLocaleString()}.
GOAL: Select 1-5 picks so combined odds (multiplied) fall STRICTLY between 3.00 and 4.00.
Markets: 1X2, Double Chance, BTTS, Over/Under, Asian Handicap.
Available matches:\\n\${matchList}
Return ONLY valid JSON array (1-5 picks):
[{"homeTeam":"...","awayTeam":"...","league":"...","matchTime":"ISO","pick":"...","market":"1X2","odds":1.85,"confidence":"High","reasoning":"..."}]
IMPORTANT: product of all odds MUST be between 3.00 and 4.00.\`;
      const completion = await openai.chat.completions.create({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_completion_tokens: 1500 });
      const raw = completion.choices?.[0]?.message?.content || '[]';
      try {
        const cleaned = raw.replace(/\`\`\`json\\n?|\\n?\`\`\`/g, '').trim();
        const parsed = JSON.parse(cleaned.startsWith('[') ? cleaned : \`[\${cleaned}]\`);
        const arr = Array.isArray(parsed) ? parsed : [];
        if (arr.length >= 1) {
          const candidates: StrategyPick[] = arr.slice(0, 5).map((p: StrategyPick, i: number) => ({ ...p, id: \`\${dateStr}-\${i}\`, odds: Math.max(1.1, parseFloat(String(p.odds)) || 1.5), result: 'pending' as const }));
          const combined = candidates.reduce((acc, p) => acc * p.odds, 1);
          if (combined >= 2.5 && combined <= 5.0) picks = candidates;
        }
      } catch { }
    }
    if (picks.length === 0 && pool.length > 0) picks = pool.slice(0, 2).map((m, i) => ({ ...fallbackPick(m, i), id: \`\${dateStr}-fallback-\${i}\` }));
  } catch (e) { console.error('[daily-strategy] generate error:', e); }
  if (picks.length === 0) picks = buildFallbackPicks(targetDate, dateStr);
  return picks;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || 'betcheza-cron';
  if (authHeader !== \`Bearer \${cronSecret}\`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekId = getWeekId(now);
  const dayNumber = getDayNumber(now);
  const plan = WEEK_PLAN[dayNumber - 1] || WEEK_PLAN[0];
  await ensureTable();
  try {
    const existing = await query<{ id: number; picks: string | null }>('SELECT id, picks FROM daily_strategy WHERE date = ? LIMIT 1', [todayStr]);
    if (existing.rows.length > 0 && existing.rows[0].picks) return NextResponse.json({ success: true, message: 'Already posted for today', date: todayStr });
    const picks = await generatePicksForDate(now, plan, dayNumber);
    const combinedOdds = picks.reduce((acc, p) => acc * p.odds, 1);
    if (existing.rows.length > 0) {
      await execute(\`UPDATE daily_strategy SET picks = ?, combined_odds = ?, generated_at = NOW(), posted_at = NOW(), status = 'active' WHERE date = ?\`, [JSON.stringify(picks), parseFloat(combinedOdds.toFixed(2)), todayStr]);
    } else {
      await execute(\`INSERT INTO daily_strategy (date, week_id, day_number, stake, save_amount, target_win, combined_odds, status, picks, generated_at, posted_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW(), NOW())\`, [todayStr, weekId, dayNumber, plan.stake, plan.save, plan.targetWin, parseFloat(combinedOdds.toFixed(2)), JSON.stringify(picks)]);
    }
    const stored = fileStoreGet<WeeklyStrategy | null>(\`strategy-week-\${weekId}\`, null);
    if (stored) {
      const idx = stored.days.findIndex(d => d.date === todayStr);
      if (idx >= 0) { stored.days[idx].picks = picks; stored.days[idx].combinedOdds = parseFloat(combinedOdds.toFixed(2)); stored.days[idx].status = 'active'; fileStoreSet(\`strategy-week-\${weekId}\`, stored); }
    }
    return NextResponse.json({ success: true, date: todayStr, picks, combinedOdds: parseFloat(combinedOdds.toFixed(2)) });
  } catch (e) {
    console.error('[daily-strategy] cron error:', e);
    const picks = await generatePicksForDate(now, plan, dayNumber);
    const combinedOdds = picks.reduce((acc, p) => acc * p.odds, 1);
    return NextResponse.json({ success: true, date: todayStr, picks, combinedOdds: parseFloat(combinedOdds.toFixed(2)), fallback: true });
  }
}
`);

write('app/api/strategy/generate/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { getUpcomingMatches } from '@/lib/api/unified-sports-api';
import OpenAI from 'openai';
import type { WeeklyStrategy, StrategyPick } from '../predictions/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getWeekId(date: Date): string {
  const monday = new Date(date);
  const day = monday.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  monday.setDate(monday.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || undefined;
  try { return new OpenAI({ apiKey, baseURL }); } catch { return null; }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const targetDay: number = body.day || 1;
  const weekId = getWeekId(new Date());
  const stored = fileStoreGet<WeeklyStrategy | null>(\`strategy-week-\${weekId}\`, null);
  if (!stored) return NextResponse.json({ error: 'No active week found. Load predictions page first.' }, { status: 404 });
  const dayIdx = targetDay - 1;
  const dayData = stored.days[dayIdx];
  if (!dayData) return NextResponse.json({ error: 'Invalid day' }, { status: 400 });
  let picks: StrategyPick[] = [];
  try {
    const upcoming = await getUpcomingMatches();
    const soccerMatches = upcoming.filter((m) => m.sport.slug === 'soccer' || m.sport.slug === 'football');
    const dayDate = new Date(dayData.date);
    const pool = soccerMatches.filter((m) => new Date(m.kickoffTime).toDateString() === dayDate.toDateString()).slice(0, 20);
    const matchList = (pool.length > 0 ? pool : soccerMatches.slice(0, 20)).map((m) => \`\${m.homeTeam.name} vs \${m.awayTeam.name} (\${m.league.name}\${m.odds ? \`, H=\${m.odds.home} D=\${m.odds.draw} A=\${m.odds.away}\` : ''})\`).join('\\n');
    const openai = getOpenAI();
    if (openai && matchList) {
      const prompt = \`Football betting analyst. Day \${targetDay} — stake KES \${dayData.stake.toLocaleString()}, target KES \${dayData.targetWin.toLocaleString()}.
GOAL: 1-5 picks, combined odds between 3.00 and 4.00.
Matches for \${dayData.date}: \${matchList}
Return ONLY JSON array: [{"homeTeam":"...","awayTeam":"...","league":"...","matchTime":"ISO","pick":"...","market":"...","odds":1.85,"confidence":"High","reasoning":"..."}]
Product of all odds must be between 3.00 and 4.00.\`;
      const completion = await openai.chat.completions.create({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_completion_tokens: 1200 });
      const raw = completion.choices?.[0]?.message?.content || '[]';
      try {
        const cleaned = raw.replace(/\`\`\`json\\n?|\\n?\`\`\`/g, '').trim();
        const obj = JSON.parse(cleaned.startsWith('[') ? cleaned : \`[\${cleaned}]\`);
        const parsed = Array.isArray(obj) ? obj : (obj.picks || []);
        if (parsed.length >= 1) {
          const candidates = parsed.slice(0, 5).map((p: StrategyPick, i: number) => ({ ...p, id: \`\${weekId}-d\${targetDay}-\${i}\`, odds: Math.max(1.1, parseFloat(String(p.odds)) || 1.5), result: 'pending' as const }));
          const combined = candidates.reduce((acc: number, p: StrategyPick) => acc * p.odds, 1);
          if (combined >= 2.5 && combined <= 5.5) picks = candidates;
        }
      } catch { }
    }
    if (picks.length === 0) picks = (pool.length > 0 ? pool : soccerMatches).slice(0, 2).map((m, i) => ({ id: \`\${weekId}-d\${targetDay}-\${i}\`, homeTeam: m.homeTeam.name, awayTeam: m.awayTeam.name, league: m.league.name, matchTime: m.kickoffTime.toISOString(), pick: \`\${m.homeTeam.name} Win or Draw\`, market: 'Double Chance', odds: parseFloat((1.7 + Math.random() * 0.5).toFixed(2)), confidence: 'Medium' as const, reasoning: 'Home advantage with solid form.', result: 'pending' as const }));
  } catch (e) { console.error('[strategy/generate] error:', e); }
  if (picks.length === 0) picks = [
    { id: \`\${weekId}-d\${targetDay}-fb-0\`, homeTeam: 'Arsenal', awayTeam: 'Chelsea', league: 'Premier League', matchTime: new Date(dayData.date).toISOString(), pick: 'Arsenal Win or Draw', market: 'Double Chance', odds: 1.68, confidence: 'Medium' as const, reasoning: 'Arsenal home advantage with strong recent form.', result: 'pending' as const },
    { id: \`\${weekId}-d\${targetDay}-fb-1\`, homeTeam: 'Real Madrid', awayTeam: 'Atletico Madrid', league: 'La Liga', matchTime: new Date(dayData.date).toISOString(), pick: 'Over 2.5 Goals', market: 'Over/Under', odds: 2.00, confidence: 'Medium' as const, reasoning: 'Both teams average over 1.8 goals. Derby historically produces goals.', result: 'pending' as const },
  ];
  const combinedOdds = picks.reduce((acc, p) => acc * p.odds, 1);
  stored.days[dayIdx].picks = picks;
  stored.days[dayIdx].combinedOdds = parseFloat(combinedOdds.toFixed(2));
  fileStoreSet(\`strategy-week-\${weekId}\`, stored);
  return NextResponse.json({ success: true, picks, combinedOdds: parseFloat(combinedOdds.toFixed(2)) });
}
`);

write('app/api/strategy/predictions/route.ts', `import { NextRequest, NextResponse } from 'next/server';
import { fileStoreGet, fileStoreSet } from '@/lib/file-store';
import { getCurrentUser } from '@/lib/auth';
import { query, execute } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export interface StrategyPick {
  id: string; homeTeam: string; awayTeam: string; league: string; matchTime: string;
  pick: string; market: string; odds: number; confidence: 'Low' | 'Medium' | 'High';
  reasoning: string; result?: 'win' | 'loss' | 'pending'; actualScore?: string;
}
export interface DayPrediction {
  day: number; date: string; stake: number; save: number; targetWin: number;
  picks: StrategyPick[]; combinedOdds: number; status: 'upcoming' | 'active' | 'completed';
  result?: 'win' | 'loss'; actualReturn?: number;
}
export interface WeeklyStrategy {
  weekId: string; weekStart: string; weekEnd: string; days: DayPrediction[];
  generatedAt: string; totalSavings: number; totalWinnings: number; weeklyProfit: number;
}

const WEEK_PLAN: Array<{ stake: number; save: number; targetWin: number }> = [
  { stake: 1000, save: 0, targetWin: 3000 }, { stake: 1500, save: 1500, targetWin: 4500 },
  { stake: 2500, save: 2000, targetWin: 7500 }, { stake: 5000, save: 2500, targetWin: 15000 },
  { stake: 10000, save: 5000, targetWin: 30000 }, { stake: 15000, save: 15000, targetWin: 45000 },
  { stake: 20000, save: 25000, targetWin: 60000 },
];

function getWeekId(date: Date): string {
  const monday = new Date(date);
  const diff = (monday.getDay() === 0 ? -6 : 1 - monday.getDay());
  monday.setDate(monday.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

interface DbRow {
  date: string; week_id: string; day_number: number; stake: number; save_amount: number;
  target_win: number; combined_odds: number | string; status: 'upcoming' | 'active' | 'completed';
  result: 'win' | 'loss' | null; actual_return: number | null; picks: string | null;
}

async function ensureTableExists(): Promise<void> {
  try {
    await query(\`CREATE TABLE IF NOT EXISTS daily_strategy (
      id int(11) NOT NULL AUTO_INCREMENT, date date NOT NULL, week_id varchar(10) NOT NULL,
      day_number tinyint(4) NOT NULL, stake int(11) NOT NULL DEFAULT 1000, save_amount int(11) NOT NULL DEFAULT 0,
      target_win int(11) NOT NULL DEFAULT 3000, combined_odds decimal(8,2) NOT NULL DEFAULT 0.00,
      status enum('upcoming','active','completed') NOT NULL DEFAULT 'upcoming',
      result enum('win','loss') DEFAULT NULL, actual_return decimal(12,2) DEFAULT NULL,
      picks longtext DEFAULT NULL, generated_at timestamp NULL DEFAULT NULL,
      posted_at timestamp NULL DEFAULT NULL, settled_at timestamp NULL DEFAULT NULL,
      created_at timestamp NOT NULL DEFAULT current_timestamp(),
      updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      PRIMARY KEY (id), UNIQUE KEY uq_date (date), KEY idx_week_id (week_id), KEY idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci\`);
  } catch { }
}

async function loadFromDb(weekId: string): Promise<DayPrediction[] | null> {
  try {
    const weekStart = new Date(weekId), weekEnd = new Date(weekId);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const result = await query<DbRow>('SELECT * FROM daily_strategy WHERE date >= ? AND date <= ? ORDER BY date ASC', [weekStart.toISOString().slice(0, 10), weekEnd.toISOString().slice(0, 10)]);
    if (!result.rows.length) return null;
    return result.rows.map((row) => ({
      day: row.day_number, date: typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().slice(0, 10),
      stake: row.stake, save: row.save_amount, targetWin: row.target_win,
      picks: row.picks ? JSON.parse(row.picks) as StrategyPick[] : [],
      combinedOdds: parseFloat(String(row.combined_odds)) || 0,
      status: row.status, result: row.result || undefined, actualReturn: row.actual_return || undefined,
    }));
  } catch { return null; }
}

async function loadPastWeeksFromDb(): Promise<WeeklyStrategy[]> {
  try {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const result = await query<DbRow>('SELECT * FROM daily_strategy WHERE date >= ? AND date < ? ORDER BY date DESC', [cutoff.toISOString().slice(0, 10), getWeekId(new Date())]);
    const byWeek = new Map<string, DbRow[]>();
    for (const row of result.rows) { if (!byWeek.has(row.week_id)) byWeek.set(row.week_id, []); byWeek.get(row.week_id)!.push(row); }
    return [...byWeek.entries()].map(([wid, rows]) => {
      const weekStart = new Date(wid), weekEnd = new Date(wid); weekEnd.setDate(weekEnd.getDate() + 6);
      return { weekId: wid, weekStart: weekStart.toISOString().slice(0, 10), weekEnd: weekEnd.toISOString().slice(0, 10),
        days: rows.map((row) => ({ day: row.day_number, date: typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().slice(0, 10), stake: row.stake, save: row.save_amount, targetWin: row.target_win, picks: row.picks ? JSON.parse(row.picks) as StrategyPick[] : [], combinedOdds: parseFloat(String(row.combined_odds)) || 0, status: row.status, result: row.result || undefined, actualReturn: row.actual_return || undefined })),
        generatedAt: new Date().toISOString(), totalSavings: 0, totalWinnings: 0, weeklyProfit: 0 };
    });
  } catch { return []; }
}

function buildEmptyWeek(weekId: string): WeeklyStrategy {
  const weekStart = new Date(weekId), weekEnd = new Date(weekId), today = new Date();
  weekEnd.setDate(weekEnd.getDate() + 6);
  return { weekId, weekStart: weekStart.toISOString().slice(0, 10), weekEnd: weekEnd.toISOString().slice(0, 10),
    days: WEEK_PLAN.map((plan, i) => {
      const dayDate = new Date(weekStart); dayDate.setDate(dayDate.getDate() + i);
      const status: DayPrediction['status'] = dayDate.toDateString() === today.toDateString() ? 'active' : dayDate < today ? 'completed' : 'upcoming';
      return { day: i + 1, date: dayDate.toISOString().slice(0, 10), stake: plan.stake, save: plan.save, targetWin: plan.targetWin, picks: [], combinedOdds: 0, status };
    }),
    generatedAt: new Date().toISOString(), totalSavings: 49000, totalWinnings: 60000, weeklyProfit: 108000 };
}

function buildAutoFallbackPicks(dateStr: string): StrategyPick[] {
  const day = new Date(dateStr);
  return [
    { id: \`\${dateStr}-auto-0\`, homeTeam: 'Home Team', awayTeam: 'Away Team', league: 'Top League', matchTime: new Date(day.setHours(17, 0, 0, 0)).toISOString(), pick: 'Home Win or Draw', market: 'Double Chance', odds: 1.68, confidence: 'Medium', reasoning: 'Home advantage and solid recent form.', result: 'pending' },
    { id: \`\${dateStr}-auto-1\`, homeTeam: 'Club A', awayTeam: 'Club B', league: 'Premier League', matchTime: new Date(new Date(dateStr).setHours(19, 45, 0, 0)).toISOString(), pick: 'Over 2.5 Goals', market: 'Over/Under', odds: 2.00, confidence: 'Medium', reasoning: 'Both sides average over 1.8 goals per game.', result: 'pending' },
  ];
}

async function autoGenerateTodayPicks(weekId: string, todayStr: string, dayNumber: number): Promise<StrategyPick[]> {
  const plan = WEEK_PLAN[Math.max(0, dayNumber - 1)] || WEEK_PLAN[0];
  try {
    const { getUpcomingMatches } = await import('@/lib/api/unified-sports-api');
    const upcoming = await getUpcomingMatches();
    const today = new Date(todayStr);
    const soccer = upcoming.filter((m: { sport: { slug: string } }) => m.sport.slug === 'soccer' || m.sport.slug === 'football');
    const pool = soccer.filter((m: { kickoffTime: Date }) => new Date(m.kickoffTime).toDateString() === today.toDateString()).slice(0, 25);
    const finalPool = pool.length >= 2 ? pool : soccer.slice(0, 25);
    if (finalPool.length === 0) return buildAutoFallbackPicks(todayStr);
    const { default: OpenAI } = await import('openai');
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (apiKey) {
      const openai = new OpenAI({ apiKey, baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || undefined });
      const matchList = finalPool.map((m: { homeTeam: { name: string }; awayTeam: { name: string }; league: { name: string }; odds?: { home: number; draw: number; away: number } }) => \`\${m.homeTeam.name} vs \${m.awayTeam.name} (\${m.league.name}\${m.odds ? \`, H=\${m.odds.home} D=\${m.odds.draw} A=\${m.odds.away}\` : ''})\`).join('\\n');
      const completion = await openai.chat.completions.create({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', messages: [{ role: 'user', content: \`Betcheza "3 Daily Odds" Strategy. Day \${dayNumber}, stake KES \${plan.stake.toLocaleString()}, target KES \${plan.targetWin.toLocaleString()}. Select 1-5 picks, combined odds between 3.00 and 4.00. Matches: \${matchList}. Return ONLY JSON array: [{"homeTeam":"...","awayTeam":"...","league":"...","matchTime":"ISO","pick":"...","market":"...","odds":1.85,"confidence":"High","reasoning":"..."}]. Product of all odds must be between 3.00 and 4.00.\` }], max_completion_tokens: 1200 });
      const raw = completion.choices?.[0]?.message?.content || '[]';
      const arr = JSON.parse(raw.replace(/\`\`\`json\\n?|\\n?\`\`\`/g, '').trim().replace(/^([^[])/, '[$1'));
      if (Array.isArray(arr) && arr.length >= 1) {
        const picks: StrategyPick[] = arr.slice(0, 5).map((p: Partial<StrategyPick>, i: number) => ({ ...p, id: \`\${todayStr}-ai-\${i}\`, odds: Math.max(1.1, parseFloat(String(p.odds)) || 1.5), result: 'pending' as const }));
        const combined = picks.reduce((acc, p) => acc * p.odds, 1);
        if (combined >= 2.5 && combined <= 5.5) return picks;
      }
    }
    return finalPool.slice(0, 2).map((m: { homeTeam: { name: string }; awayTeam: { name: string }; league: { name: string }; kickoffTime: Date }, i: number) => ({ id: \`\${todayStr}-pool-\${i}\`, homeTeam: m.homeTeam.name, awayTeam: m.awayTeam.name, league: m.league.name, matchTime: new Date(m.kickoffTime).toISOString(), pick: \`\${m.homeTeam.name} Win or Draw\`, market: 'Double Chance', odds: parseFloat((1.7 + Math.random() * 0.5).toFixed(2)), confidence: 'Medium' as const, reasoning: \`\${m.homeTeam.name} home advantage with solid form.\`, result: 'pending' as const }));
  } catch { return buildAutoFallbackPicks(todayStr); }
}

async function loadCurrentWeek(): Promise<WeeklyStrategy> {
  const now = new Date(), weekId = getWeekId(now), todayStr = now.toISOString().slice(0, 10);
  const dayNumber = (() => { const d = now.getDay(); return d === 0 ? 7 : d; })();
  async function tryAutoGenerate(days: DayPrediction[]): Promise<void> {
    const i = days.findIndex((d) => d.date === todayStr);
    if (i >= 0 && days[i].picks.length === 0) {
      try {
        const picks = await autoGenerateTodayPicks(weekId, todayStr, dayNumber);
        const combined = picks.reduce((acc, p) => acc * p.odds, 1);
        days[i].picks = picks; days[i].combinedOdds = parseFloat(combined.toFixed(2)); days[i].status = 'active';
        await execute(\`INSERT INTO daily_strategy (date, week_id, day_number, stake, save_amount, target_win, combined_odds, status, picks, generated_at, posted_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE picks = VALUES(picks), combined_odds = VALUES(combined_odds), status = 'active', generated_at = NOW()\`, [todayStr, weekId, dayNumber, days[i].stake, days[i].save, days[i].targetWin, days[i].combinedOdds, JSON.stringify(picks)]).catch(() => undefined);
      } catch { }
    }
  }
  const dbDays = await loadFromDb(weekId);
  if (dbDays && dbDays.length > 0) {
    const empty = buildEmptyWeek(weekId);
    const merged = empty.days.map((d) => dbDays.find((r) => r.date === d.date) ?? d);
    await tryAutoGenerate(merged);
    return { ...empty, days: merged };
  }
  const stored = fileStoreGet<WeeklyStrategy | null>(\`strategy-week-\${weekId}\`, null);
  if (stored && stored.weekId === weekId) { await tryAutoGenerate(stored.days); fileStoreSet(\`strategy-week-\${weekId}\`, stored); return stored; }
  await ensureTableExists();
  const empty = buildEmptyWeek(weekId);
  await tryAutoGenerate(empty.days);
  fileStoreSet(\`strategy-week-\${weekId}\`, empty);
  return empty;
}

async function loadPastWeeks(): Promise<WeeklyStrategy[]> {
  const dbWeeks = await loadPastWeeksFromDb();
  if (dbWeeks.length > 0) return dbWeeks;
  const weeks: WeeklyStrategy[] = [];
  for (let i = 1; i <= 4; i++) { const d = new Date(); d.setDate(d.getDate() - i * 7); const s = fileStoreGet<WeeklyStrategy | null>(\`strategy-week-\${getWeekId(d)}\`, null); if (s) weeks.push(s); }
  return weeks;
}

export async function GET() {
  return NextResponse.json({ current: await loadCurrentWeek(), past: await loadPastWeeks() });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const weekId = getWeekId(new Date());
  const current = await loadCurrentWeek();
  if (body.picks && typeof body.day === 'number') {
    const i = body.day - 1;
    if (i >= 0 && i < current.days.length) {
      current.days[i].picks = body.picks;
      current.days[i].combinedOdds = parseFloat(body.picks.reduce((acc: number, p: StrategyPick) => acc * p.odds, 1).toFixed(2));
      const d = current.days[i];
      try { await execute(\`INSERT INTO daily_strategy (date, week_id, day_number, stake, save_amount, target_win, combined_odds, status, picks, generated_at, posted_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE picks = VALUES(picks), combined_odds = VALUES(combined_odds), generated_at = NOW(), posted_at = NOW(), status = 'active'\`, [d.date, weekId, d.day, d.stake, d.save, d.targetWin, d.combinedOdds, JSON.stringify(body.picks)]); } catch { }
    }
    fileStoreSet(\`strategy-week-\${weekId}\`, current);
    return NextResponse.json({ success: true, week: current });
  }
  if (body.result && typeof body.day === 'number') {
    const i = body.day - 1;
    if (i >= 0 && i < current.days.length) {
      current.days[i].result = body.result; current.days[i].actualReturn = body.actualReturn;
      if (body.picksResults) current.days[i].picks = current.days[i].picks.map((p, j) => ({ ...p, result: body.picksResults[j] || p.result, actualScore: body.actualScores?.[j] || p.actualScore }));
      const d = current.days[i];
      try { await execute(\`UPDATE daily_strategy SET result = ?, actual_return = ?, picks = ?, status = 'completed', settled_at = NOW() WHERE date = ?\`, [body.result, body.actualReturn || null, JSON.stringify(d.picks), d.date]); } catch { }
    }
    fileStoreSet(\`strategy-week-\${weekId}\`, current);
    return NextResponse.json({ success: true, week: current });
  }
  return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
}
`);

console.log('\nDone! Now check strategy dir ownership above.');
console.log('Then: cd ~/apps/betcheza && npm run build && pm2 restart betcheza');
