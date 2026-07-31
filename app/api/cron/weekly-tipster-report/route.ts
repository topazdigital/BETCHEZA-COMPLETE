import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendMail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || 'betcheza-cron-2024';

interface WeeklyTipsterRow {
  id: number;
  email: string;
  display_name: string | null;
  username: string | null;
  total_tips: number;
  won: number;
  lost: number;
  pending: number;
  roi: number;
  avg_odds: number;
}

interface StreakRow {
  tipster_id: number;
  status: string;
  created_at: string;
}

function computeStreak(tips: { status: string }[]): number {
  if (!tips.length) return 0;
  const settled = tips.filter(t => t.status === 'won' || t.status === 'lost');
  if (!settled.length) return 0;
  const lastStatus = settled[settled.length - 1].status;
  let count = 0;
  for (let i = settled.length - 1; i >= 0; i--) {
    if (settled[i].status === lastStatus) count++;
    else break;
  }
  return lastStatus === 'won' ? count : -count;
}

function buildWeeklyEmailHtml(
  tipster: WeeklyTipsterRow,
  weekLabel: string,
  streak: number,
  appUrl: string,
): string {
  const displayName = tipster.display_name || tipster.username || `Tipster #${tipster.id}`;
  const roi = tipster.roi >= 0
    ? `<span style="color:#22c55e">+${tipster.roi.toFixed(1)}%</span>`
    : `<span style="color:#ef4444">${tipster.roi.toFixed(1)}%</span>`;
  const streakEmoji = streak >= 3 ? '🔥' : streak <= -3 ? '❄️' : '📊';
  const streakLabel = streak > 0 ? `${streak}W streak` : streak < 0 ? `${Math.abs(streak)}L streak` : 'No current streak';
  const settled = tipster.won + tipster.lost;
  const winRate = settled > 0 ? ((tipster.won / settled) * 100).toFixed(1) : '0.0';
  const streakMsg = streak >= 3
    ? 'You are on fire! Keep the momentum going.'
    : streak <= -3
    ? 'Everyone hits rough patches — review your process and bounce back strong.'
    : 'Stay consistent and the results will follow.';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:24px 16px">
  <div style="background:#1a1f2e;border-radius:16px;overflow:hidden;border:1px solid #2a2f3e">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 24px;text-align:center">
      <div style="font-size:36px;margin-bottom:8px">📊</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">Your Weekly Performance Report</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px">${weekLabel}</p>
    </div>

    <!-- Greeting -->
    <div style="padding:24px 24px 0">
      <p style="color:#e2e8f0;font-size:16px;margin:0 0 4px">Hey <strong>${displayName}</strong> 👋</p>
      <p style="color:#94a3b8;font-size:14px;margin:0">Here is how you performed on Betcheza this week.</p>
    </div>

    <!-- Stats Grid -->
    <div style="padding:20px 24px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="background:#0f1117;border-radius:12px;padding:16px;border:1px solid #2a2f3e;text-align:center">
          <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Tips This Week</div>
          <div style="color:#e2e8f0;font-size:28px;font-weight:700">${tipster.total_tips}</div>
        </div>
        <div style="background:#0f1117;border-radius:12px;padding:16px;border:1px solid #2a2f3e;text-align:center">
          <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Win Rate</div>
          <div style="color:#e2e8f0;font-size:28px;font-weight:700">${winRate}%</div>
        </div>
        <div style="background:#0f1117;border-radius:12px;padding:16px;border:1px solid #2a2f3e;text-align:center">
          <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Won / Lost</div>
          <div style="font-size:22px;font-weight:700">
            <span style="color:#22c55e">${tipster.won}W</span>
            <span style="color:#475569;margin:0 4px">/</span>
            <span style="color:#ef4444">${tipster.lost}L</span>
          </div>
          ${tipster.pending > 0 ? `<div style="color:#f59e0b;font-size:12px;margin-top:4px">${tipster.pending} pending</div>` : ''}
        </div>
        <div style="background:#0f1117;border-radius:12px;padding:16px;border:1px solid #2a2f3e;text-align:center">
          <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Weekly ROI</div>
          <div style="font-size:24px;font-weight:700">${roi}</div>
        </div>
      </div>

      <!-- Streak -->
      <div style="background:#0f1117;border-radius:12px;padding:14px 16px;border:1px solid #2a2f3e;margin-top:12px;display:flex;align-items:center;gap:12px">
        <div style="font-size:24px">${streakEmoji}</div>
        <div>
          <div style="color:#e2e8f0;font-size:14px;font-weight:600">${streakLabel}</div>
          <div style="color:#94a3b8;font-size:12px;margin-top:2px">${streakMsg}</div>
        </div>
      </div>

      ${tipster.avg_odds > 0 ? `
      <!-- Avg Odds -->
      <div style="background:#0f1117;border-radius:12px;padding:12px 16px;border:1px solid #2a2f3e;margin-top:12px;display:flex;align-items:center;justify-content:space-between">
        <span style="color:#94a3b8;font-size:13px">Average odds this week</span>
        <span style="color:#e2e8f0;font-size:16px;font-weight:700">${tipster.avg_odds.toFixed(2)}</span>
      </div>` : ''}
    </div>

    <!-- CTA -->
    <div style="padding:0 24px 24px;text-align:center">
      <a href="${appUrl}/tipsters" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;border-radius:10px;padding:14px 32px;font-weight:600;font-size:15px">View Your Profile →</a>
      <p style="color:#475569;font-size:12px;margin:16px 0 0">You are receiving this because you are a tipster on Betcheza. <a href="${appUrl}/settings" style="color:#6366f1">Manage notifications</a></p>
    </div>
  </div>
</div>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const secret = req.nextUrl.searchParams.get('secret');
  if (auth !== `Bearer ${CRON_SECRET}` && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only run on Sundays unless forced
  const force = req.nextUrl.searchParams.get('force') === '1';
  const now = new Date();
  if (!force && now.getDay() !== 0) {
    return NextResponse.json({ skipped: true, reason: 'Not Sunday' });
  }

  // Compute this week's window: Mon 00:00 → Sun 23:59:59
  const sunday = new Date(now);
  const monday = new Date(sunday);
  monday.setDate(sunday.getDate() - 6);
  monday.setHours(0, 0, 0, 0);
  sunday.setHours(23, 59, 59, 999);

  const weekStart = monday.toISOString();
  const weekEnd = sunday.toISOString();

  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const weekLabel = `${fmt(monday)} – ${fmt(new Date(now))}`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://betcheza.co.ke';

  // ── Query this week's tips from auto_tips for real users only ────────────
  let tipsters: WeeklyTipsterRow[] = [];
  try {
    const result = await query<WeeklyTipsterRow>(`
      SELECT
        at.tipster_id                                                        AS id,
        u.email,
        up.display_name,
        u.username,
        COUNT(*)                                                             AS total_tips,
        SUM(at.status = 'won')                                               AS won,
        SUM(at.status = 'lost')                                              AS lost,
        SUM(at.status = 'pending')                                           AS pending,
        ROUND(
          (
            SUM(CASE WHEN at.status = 'won' THEN (at.odds - 1) ELSE -1 END)
            / NULLIF(SUM(at.status IN ('won','lost')), 0)
          ) * 100
        , 1)                                                                 AS roi,
        ROUND(AVG(at.odds), 2)                                               AS avg_odds
      FROM auto_tips at
      JOIN users u ON u.id = at.tipster_id
      LEFT JOIN user_profiles up ON up.user_id = at.tipster_id
      WHERE at.created_at >= ?
        AND at.created_at <= ?
        AND at.tipster_id < 1000
        AND u.email IS NOT NULL
        AND u.email != ''
        AND u.is_banned = 0
      GROUP BY at.tipster_id, u.email, up.display_name, u.username
      HAVING total_tips >= 1
      ORDER BY roi DESC
      LIMIT 2000
    `, [weekStart, weekEnd]);
    tipsters = result.rows;
  } catch (e) {
    return NextResponse.json({ error: 'DB unavailable', detail: String(e) }, { status: 500 });
  }

  if (tipsters.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, message: 'No tipsters with tips this week' });
  }

  // Fetch streak data — ordered tip history for each tipster this week
  let streakData: StreakRow[] = [];
  try {
    const tipsterIds = tipsters.map(t => t.id);
    const placeholders = tipsterIds.map(() => '?').join(',');
    const result = await query<StreakRow>(`
      SELECT tipster_id, status, created_at
      FROM auto_tips
      WHERE tipster_id IN (${placeholders})
        AND created_at >= ?
        AND created_at <= ?
        AND status IN ('won', 'lost')
      ORDER BY tipster_id ASC, created_at ASC
    `, [...tipsterIds, weekStart, weekEnd]);
    streakData = result.rows;
  } catch { /* streak optional */ }

  // Build streak map per tipster
  const streakMap = new Map<number, number>();
  const grouped = new Map<number, { status: string }[]>();
  for (const row of streakData) {
    const id = Number(row.tipster_id);
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id)!.push({ status: row.status });
  }
  for (const [id, tips] of grouped.entries()) {
    streakMap.set(id, computeStreak(tips));
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const tipster of tipsters) {
    if (tipster.total_tips === 0) { skipped++; continue; }

    const streak = streakMap.get(tipster.id) ?? 0;
    const html = buildWeeklyEmailHtml(tipster, weekLabel, streak, appUrl);
    const displayName = tipster.display_name || tipster.username || `Tipster #${tipster.id}`;

    const result = await sendMail({
      to: tipster.email,
      subject: `📊 Your Betcheza Weekly Report — ${weekLabel}`,
      html,
      text: `Hi ${displayName}, here is your Betcheza weekly summary: ${tipster.won}W / ${tipster.lost}L / ${(tipster.roi ?? 0).toFixed(1)}% ROI this week. Visit ${appUrl}/tipsters to see your full profile.`,
    });

    if (result.ok) sent++;
    else if (result.skipped) { skipped++; break; }
    else failed++;

    await new Promise(r => setTimeout(r, 80));
  }

  console.log(`[cron] weekly-tipster-report: sent=${sent} failed=${failed} skipped=${skipped} week="${weekLabel}" tipsters=${tipsters.length}`);
  return NextResponse.json({ sent, failed, skipped, week: weekLabel, total: tipsters.length });
}
