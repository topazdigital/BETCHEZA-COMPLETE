/**
 * Email HTML templates for subscription confirmations and tip notifications.
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';

function baseLayout(content: string, preheader = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Betcheza</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  ${preheader ? `<span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1e293b;border-radius:12px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">⚽ Betcheza</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Expert Sports Betting Tips</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #334155;text-align:center;">
              <p style="margin:0;color:#64748b;font-size:12px;">
                © ${new Date().getFullYear()} Betcheza · <a href="${BASE_URL}" style="color:#7c3aed;text-decoration:none;">betcheza.co.ke</a>
              </p>
              <p style="margin:6px 0 0;color:#475569;font-size:11px;">
                Bet responsibly. 18+ only. You received this email because you subscribed on Betcheza.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function statBox(label: string, value: string, color = '#7c3aed'): string {
  return `<td style="text-align:center;padding:12px 16px;background:#0f172a;border-radius:8px;">
    <div style="color:${color};font-size:20px;font-weight:700;">${value}</div>
    <div style="color:#94a3b8;font-size:11px;margin-top:2px;">${label}</div>
  </td>`;
}

/** Sent to subscriber when they subscribe to a tipster */
export function tipsterSubscriptionEmail(opts: {
  subscriberName: string;
  tipsterName: string;
  tipsterUsername: string;
  price: number;
  currency: string;
  expiresAt: string;
  daysLeft: number;
}): { subject: string; html: string; text: string } {
  const expiry = new Date(opts.expiresAt).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const html = baseLayout(`
    <h2 style="margin:0 0 8px;color:#f1f5f9;font-size:20px;">You're now subscribed! 🎉</h2>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6;">
      Hi <strong style="color:#f1f5f9;">${opts.subscriberName}</strong>, you've successfully subscribed to
      <strong style="color:#7c3aed;">@${opts.tipsterUsername}</strong>'s premium tips.
    </p>

    <table width="100%" cellpadding="8" cellspacing="8" style="margin-bottom:24px;">
      <tr>
        ${statBox('Tipster', opts.tipsterName, '#7c3aed')}
        ${statBox('Paid', `${opts.currency} ${opts.price.toLocaleString()}`, '#10b981')}
        ${statBox('Days Left', String(opts.daysLeft), '#f59e0b')}
      </tr>
    </table>

    <div style="background:#0f172a;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;">Subscription active until</p>
      <p style="margin:0;color:#f1f5f9;font-size:16px;font-weight:600;">${expiry}</p>
    </div>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:13px;line-height:1.6;">
      You'll receive an email every time <strong style="color:#f1f5f9;">@${opts.tipsterUsername}</strong>
      posts new tips during your subscription period.
    </p>

    <a href="${BASE_URL}/tipsters/${opts.tipsterUsername}"
       style="display:inline-block;background:#7c3aed;color:#fff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">
      View Tips →
    </a>
  `, `You've subscribed to ${opts.tipsterName} on Betcheza`);

  const text = `Hi ${opts.subscriberName},\n\nYou've subscribed to @${opts.tipsterUsername} on Betcheza.\n\nPaid: ${opts.currency} ${opts.price.toLocaleString()}\nActive until: ${expiry}\n\nView tips: ${BASE_URL}/tipsters/${opts.tipsterUsername}\n\nBet responsibly. 18+ only.`;

  return {
    subject: `✅ Subscribed to ${opts.tipsterName} — Betcheza`,
    html,
    text,
  };
}

/** Sent to subscriber when a tipster posts new tips */
export function tipsterNewTipsEmail(opts: {
  subscriberName: string;
  tipsterName: string;
  tipsterUsername: string;
  tips: Array<{
    homeTeam: string;
    awayTeam: string;
    league: string;
    pick: string;
    market: string;
    odds: number;
    matchTime?: string;
    reasoning?: string;
  }>;
}): { subject: string; html: string; text: string } {
  const tipRows = opts.tips.map(t => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #1e293b;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
          <div>
            <div style="color:#f1f5f9;font-size:14px;font-weight:600;">${t.homeTeam} vs ${t.awayTeam}</div>
            <div style="color:#64748b;font-size:11px;margin-top:2px;">${t.league}${t.matchTime ? ' · ' + t.matchTime : ''}</div>
            ${t.reasoning ? `<div style="color:#94a3b8;font-size:12px;margin-top:4px;">${t.reasoning}</div>` : ''}
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="background:#7c3aed;color:#fff;font-size:12px;font-weight:700;padding:3px 8px;border-radius:5px;">${t.pick}</div>
            <div style="color:#64748b;font-size:11px;margin-top:4px;">${t.market} · @${t.odds}</div>
          </div>
        </div>
      </td>
    </tr>
  `).join('');

  const html = baseLayout(`
    <h2 style="margin:0 0 8px;color:#f1f5f9;font-size:20px;">New tips from @${opts.tipsterUsername} 🔥</h2>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6;">
      Hi <strong style="color:#f1f5f9;">${opts.subscriberName}</strong>,
      <strong style="color:#7c3aed;">${opts.tipsterName}</strong> just posted ${opts.tips.length} new tip${opts.tips.length !== 1 ? 's' : ''} for you.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${tipRows}
    </table>

    <a href="${BASE_URL}/tipsters/${opts.tipsterUsername}"
       style="display:inline-block;background:#7c3aed;color:#fff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">
      View All Tips →
    </a>
  `, `${opts.tipsterName} posted ${opts.tips.length} new tip${opts.tips.length !== 1 ? 's' : ''}`);

  const tipLines = opts.tips.map(t =>
    `• ${t.homeTeam} vs ${t.awayTeam} — ${t.pick} (${t.market}) @ ${t.odds}`
  ).join('\n');

  const text = `Hi ${opts.subscriberName},\n\n${opts.tipsterName} posted new tips:\n\n${tipLines}\n\nView: ${BASE_URL}/tipsters/${opts.tipsterUsername}\n\nBet responsibly. 18+ only.`;

  return {
    subject: `🔥 ${opts.tipsterName} just posted ${opts.tips.length} new tip${opts.tips.length !== 1 ? 's' : ''} — Betcheza`,
    html,
    text,
  };
}

/** Sent to subscriber when they purchase 3 Daily Odds access */
export function strategyAccessEmail(opts: {
  subscriberName: string;
  subscriberEmail: string;
  price: number;
  currency: string;
  expiresAt: string;
  daysRemaining: number;
  reference: string;
}): { subject: string; html: string; text: string } {
  const expiry = new Date(opts.expiresAt).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const html = baseLayout(`
    <h2 style="margin:0 0 8px;color:#f1f5f9;font-size:20px;">3 Daily Odds Strategy — Access Confirmed ✅</h2>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6;">
      Hi <strong style="color:#f1f5f9;">${opts.subscriberName}</strong>, your 7-day access to the
      <strong style="color:#f59e0b;">3 Daily Odds Strategy</strong> is now active.
    </p>

    <table width="100%" cellpadding="8" cellspacing="8" style="margin-bottom:24px;">
      <tr>
        ${statBox('Paid', `${opts.currency} ${opts.price.toLocaleString()}`, '#10b981')}
        ${statBox('Days Remaining', String(opts.daysRemaining), '#f59e0b')}
        ${statBox('Target Return', '60K+', '#7c3aed')}
      </tr>
    </table>

    <div style="background:#0f172a;border-radius:8px;padding:16px;margin-bottom:20px;">
      <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;">Access expires</p>
      <p style="margin:0;color:#f1f5f9;font-size:16px;font-weight:600;">${expiry}</p>
      <p style="margin:6px 0 0;color:#475569;font-size:11px;">Ref: ${opts.reference}</p>
    </div>

    <div style="background:#1a1a2e;border:1px solid #7c3aed33;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;color:#f59e0b;font-size:13px;font-weight:600;">How it works:</p>
      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.7;">
        📅 3 AI-selected picks posted daily with combined odds between 3.0 – 4.0<br/>
        💰 Compounding stake plan across 7 days<br/>
        📧 You'll receive each day's picks by email as soon as they're posted
      </p>
    </div>

    <a href="${BASE_URL}/3-daily-odds-strategy"
       style="display:inline-block;background:#f59e0b;color:#000;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">
      View Today's Picks →
    </a>
  `, '3 Daily Odds Strategy access confirmed');

  const text = `Hi ${opts.subscriberName},\n\nYour 3 Daily Odds Strategy access is confirmed.\n\nPaid: ${opts.currency} ${opts.price.toLocaleString()}\nExpires: ${expiry}\nRef: ${opts.reference}\n\nView picks: ${BASE_URL}/3-daily-odds-strategy\n\nBet responsibly. 18+ only.`;

  return {
    subject: `✅ 3 Daily Odds Strategy — Access Active (${opts.daysRemaining} days) — Betcheza`,
    html,
    text,
  };
}

/** Sent to a strategy subscriber 1 day before their access expires */
export function strategyExpiryReminderEmail(opts: {
  subscriberName: string;
  expiresAt: string;
  daysRemaining: number;
}): { subject: string; html: string; text: string } {
  const expiry = new Date(opts.expiresAt).toLocaleDateString('en-KE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const html = baseLayout(`
    <h2 style="margin:0 0 4px;color:#f1f5f9;font-size:20px;">Your Strategy Access Expires Tomorrow ⏰</h2>
    <p style="margin:0 0 20px;color:#94a3b8;font-size:13px;">Don't lose your winning streak</p>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:14px;line-height:1.6;">
      Hi <strong style="color:#f1f5f9;">${opts.subscriberName}</strong>, just a heads-up —
      your <strong style="color:#f59e0b;">3 Daily Odds Strategy</strong> access expires
      <strong style="color:#f1f5f9;">${expiry}</strong>.
    </p>

    <div style="background:#0f172a;border-radius:8px;padding:16px;margin-bottom:20px;">
      <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;">Access expires</p>
      <p style="margin:0;color:#ef4444;font-size:16px;font-weight:700;">${expiry}</p>
      <p style="margin:6px 0 0;color:#475569;font-size:12px;">Renew now to keep receiving daily picks without interruption</p>
    </div>

    <div style="background:#1a1a2e;border:1px solid #f59e0b33;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0 0 8px;color:#f59e0b;font-size:13px;font-weight:600;">What you'll keep getting:</p>
      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.7;">
        📅 3 AI-selected picks posted every day<br/>
        💰 Compounding stake plan (KES 1,000 → KES 60,000+ target)<br/>
        📧 Email alerts the moment picks are posted each morning
      </p>
    </div>

    <a href="${BASE_URL}/3-daily-odds-strategy"
       style="display:inline-block;background:#f59e0b;color:#000;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">
      Renew Access — KES 5,000 →
    </a>
  `, 'Your 3 Daily Odds Strategy access expires tomorrow — renew to keep your picks coming');

  const text = `Hi ${opts.subscriberName},\n\nYour 3 Daily Odds Strategy access expires on ${expiry}.\n\nRenew now to keep receiving daily picks: ${BASE_URL}/3-daily-odds-strategy\n\nBet responsibly. 18+ only.`;

  return {
    subject: `⏰ Strategy Access Expires Tomorrow — Renew Now — Betcheza`,
    html,
    text,
  };
}

/** Sent to all strategy subscribers when today's picks are posted */
export function strategyPicksEmail(opts: {
  subscriberName: string;
  day: number;
  date: string;
  stake: number;
  targetWin: number;
  picks: Array<{
    homeTeam: string;
    awayTeam: string;
    league: string;
    pick: string;
    market: string;
    odds: number;
    reasoning?: string;
  }>;
  combinedOdds: number;
}): { subject: string; html: string; text: string } {
  const pickRows = opts.picks.map(p => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #1e293b;">
        <div>
          <div style="color:#f1f5f9;font-size:14px;font-weight:600;">${p.homeTeam} vs ${p.awayTeam}</div>
          <div style="color:#64748b;font-size:11px;margin-top:2px;">${p.league}</div>
          ${p.reasoning ? `<div style="color:#94a3b8;font-size:12px;margin-top:4px;line-height:1.5;">${p.reasoning}</div>` : ''}
        </div>
        <div style="margin-top:8px;display:flex;gap:8px;align-items:center;">
          <span style="background:#7c3aed;color:#fff;font-size:12px;font-weight:700;padding:3px 8px;border-radius:5px;">${p.pick}</span>
          <span style="color:#64748b;font-size:12px;">${p.market} · Odds: <strong style="color:#f59e0b;">${p.odds}</strong></span>
        </div>
      </td>
    </tr>
  `).join('');

  const html = baseLayout(`
    <h2 style="margin:0 0 4px;color:#f1f5f9;font-size:20px;">Day ${opts.day} Picks Are Ready! 🎯</h2>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:13px;">${opts.date}</p>

    <p style="margin:0 0 20px;color:#94a3b8;font-size:14px;line-height:1.6;">
      Hi <strong style="color:#f1f5f9;">${opts.subscriberName}</strong>, here are your
      <strong style="color:#f59e0b;">3 Daily Odds</strong> picks for today.
    </p>

    <table width="100%" cellpadding="8" cellspacing="8" style="margin-bottom:24px;">
      <tr>
        ${statBox('Day', `${opts.day}/7`, '#7c3aed')}
        ${statBox('Stake', `KES ${opts.stake.toLocaleString()}`, '#10b981')}
        ${statBox('Combined Odds', String(opts.combinedOdds), '#f59e0b')}
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      ${pickRows}
    </table>

    <div style="background:#0f172a;border-radius:8px;padding:14px;margin-bottom:24px;">
      <p style="margin:0;color:#94a3b8;font-size:13px;">
        🎯 If all 3 picks win, your <strong style="color:#f59e0b;">KES ${opts.stake.toLocaleString()}</strong> stake
        could return <strong style="color:#10b981;">KES ${opts.targetWin.toLocaleString()}</strong>
      </p>
    </div>

    <a href="${BASE_URL}/3-daily-odds-strategy"
       style="display:inline-block;background:#f59e0b;color:#000;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">
      View Full Plan →
    </a>
  `, `Day ${opts.day} picks: ${opts.picks.map(p => `${p.homeTeam} vs ${p.awayTeam}`).join(', ')}`);

  const pickLines = opts.picks.map(p =>
    `• ${p.homeTeam} vs ${p.awayTeam} — ${p.pick} (${p.market}) @ ${p.odds}`
  ).join('\n');

  const text = `Hi ${opts.subscriberName},\n\nDay ${opts.day} picks for 3 Daily Odds Strategy:\n\n${pickLines}\n\nCombined odds: ${opts.combinedOdds}\nStake: KES ${opts.stake.toLocaleString()} → Target: KES ${opts.targetWin.toLocaleString()}\n\nView: ${BASE_URL}/3-daily-odds-strategy\n\nBet responsibly. 18+ only.`;

  return {
    subject: `🎯 Day ${opts.day} Picks Ready — 3 Daily Odds Strategy (${opts.combinedOdds}x odds) — Betcheza`,
    html,
    text,
  };
}
