import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendMail } from '@/lib/mailer';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || 'betcheza-cron-2024';

interface TipsterRow {
  id: number;
  email: string;
  display_name: string | null;
  username: string | null;
  total_tips: number;
  won: number;
  lost: number;
  pending: number;
  roi: number;
  streak: number;
  win_rate: number;
}

function buildWeeklyEmailHtml(tipster: TipsterRow, weekLabel: string): string {
  const displayName = tipster.display_name || tipster.username || `Tipster #${tipster.id}`;
  const roi = tipster.roi >= 0
    ? `<span style="color:#22c55e">+${tipster.roi.toFixed(1)}%</span>`
    : `<span style="color:#ef4444">${tipster.roi.toFixed(1)}%</span>`;
  const streakEmoji = tipster.streak >= 3 ? '🔥' : tipster.streak <= -3 ? '❄️' : '📊';
  const streakLabel = tipster.streak > 0 ? `${tipster.streak}W streak` : tipster.streak < 0 ? `${Math.abs(tipster.streak)}L streak` : 'No streak';
  const winRate = tipster.total_tips > 0 ? ((tipster.won / Math.max(tipster.won + tipster.lost, 1)) * 100).toFixed(1) : '0.0';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:24px 16px">
  <div style="background:#1a1f2e;border-radius:16px;overflow:hidden;border:1px solid #2a2f3e">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 24px;text-align:center">
      <div style="font-size:32px;margin-bottom:8px">📊</div>
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
          <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Tips Posted</div>
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
          <div style="color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">ROI</div>
          <div style="font-size:24px;font-weight:700">${roi}</div>
        </div>
      </div>

      <!-- Streak -->
      <div style="background:#0f1117;border-radius:12px;padding:14px 16px;border:1px solid #2a2f3e;margin-top:12px;display:flex;align-items:center;gap:12px">
        <div style="font-size:24px">${streakEmoji}</div>
        <div>
          <div style="color:#e2e8f0;font-size:14px;font-weight:600">${streakLabel}</div>
          <div style="color:#94a3b8;font-size:12px;margin-top:2px">
            ${tipster.streak >= 3 ? 'You are on fire! Keep the momentum going.' : tipster.streak <= -3 ? 'Everyone hits rough patches. Review your process and bounce back.' : 'Stay consistent and the results will follow.'}
          </div>
        </div>
      </div>
    </div>

    <!-- CTA -->
    <div style="padding:0 24px 24px;text-align:center">
      <a href="https://betcheza.co.ke/tipsters" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;border-radius:10px;padding:14px 32px;font-weight:600;font-size:15px">View Your Profile →</a>
      <p style="color:#475569;font-size:12px;margin-top:16px 0 0">You are receiving this because you are a tipster on Betcheza. <a href="https://betcheza.co.ke/settings" style="color:#6366f1">Manage notifications</a></p>
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

  // Only run on Sundays (day 0) — allow force param for testing
  const force = req.nextUrl.searchParams.get('force') === '1';
  const now = new Date();
  if (!force && now.getDay() !== 0) {
    return NextResponse.json({ skipped: true, reason: 'Not Sunday' });
  }

  // Build week label (Mon–Sun)
  const sunday = new Date(now);
  const monday = new Date(sunday);
  monday.setDate(sunday.getDate() - 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const weekLabel = `${fmt(monday)} – ${fmt(sunday)}`;

  // Fetch real tipsters only (has email + tipster_profiles row, NOT fake)
  // Fake tipsters have user IDs >= 1000 seeded in memory; real users are in the DB
  let tipsters: TipsterRow[] = [];
  try {
    const result = await query<TipsterRow>(`
      SELECT
        u.id,
        u.email,
        up.display_name,
        u.username,
        COALESCE(tp.total_tips, 0)   AS total_tips,
        COALESCE(tp.won, 0)          AS won,
        COALESCE(tp.lost, 0)         AS lost,
        COALESCE(tp.pending, 0)      AS pending,
        COALESCE(tp.roi, 0)          AS roi,
        COALESCE(tp.streak, 0)       AS streak,
        COALESCE(tp.win_rate, 0)     AS win_rate
      FROM users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      LEFT JOIN tipster_profiles tp ON tp.user_id = u.id
      WHERE u.email IS NOT NULL
        AND u.email != ''
        AND u.is_banned = 0
        AND COALESCE(tp.total_tips, 0) > 0
      ORDER BY u.id ASC
      LIMIT 2000
    `);
    tipsters = result.rows;
  } catch (e) {
    return NextResponse.json({ error: 'DB unavailable', detail: String(e) }, { status: 500 });
  }

  if (tipsters.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, message: 'No eligible tipsters found' });
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const tipster of tipsters) {
    // Skip if no tips this week (nothing to report)
    if (tipster.total_tips === 0) { skipped++; continue; }

    const html = buildWeeklyEmailHtml(tipster, weekLabel);
    const displayName = tipster.display_name || tipster.username || `Tipster #${tipster.id}`;
    const result = await sendMail({
      to: tipster.email,
      subject: `📊 Your Betcheza Weekly Report — ${weekLabel}`,
      html,
      text: `Hi ${displayName}, here is your Betcheza weekly summary: ${tipster.won}W / ${tipster.lost}L / ${tipster.roi.toFixed(1)}% ROI. Visit betcheza.co.ke to see your full profile.`,
    });

    if (result.ok) sent++;
    else if (result.skipped) { skipped++; break; } // SMTP not configured — stop early
    else failed++;

    // Small delay to avoid hitting SMTP rate limits
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`[cron] weekly-tipster-report: sent=${sent} failed=${failed} skipped=${skipped} week="${weekLabel}"`);
  return NextResponse.json({ sent, failed, skipped, week: weekLabel, total: tipsters.length });
}
