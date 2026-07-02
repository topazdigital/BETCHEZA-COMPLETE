/**
 * Email HTML templates — beautiful, branded Betcheza emails.
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';

// ── Shared Design Primitives ─────────────────────────────────────────────────

function emailShell(content: string, preheader = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Betcheza</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:36px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.12);">

        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#065f46 0%,#059669 55%,#10b981 100%);padding:28px 32px 22px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;padding-right:12px;">
                  <div style="width:42px;height:42px;background:rgba(255,255,255,0.18);border-radius:10px;text-align:center;line-height:42px;font-size:22px;">⚽</div>
                </td>
                <td style="vertical-align:middle;">
                  <div style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.3px;line-height:1;">Betcheza</div>
                  <div style="color:rgba(255,255,255,0.68);font-size:10px;letter-spacing:1px;text-transform:uppercase;margin-top:2px;">Expert Sports Predictions</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ACCENT LINE -->
        <tr>
          <td style="height:3px;background:linear-gradient(90deg,#f59e0b 0%,#10b981 45%,#7c3aed 100%);"></td>
        </tr>

        <!-- BODY -->
        <tr>
          <td style="background:#ffffff;padding:36px 32px;">
            ${content}
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#0f172a;padding:22px 32px;text-align:center;">
            <p style="margin:0 0 6px;color:rgba(255,255,255,0.5);font-size:12px;line-height:1.6;">
              <a href="${BASE_URL}" style="color:#10b981;text-decoration:none;font-weight:600;">betcheza.co.ke</a>
              &nbsp;·&nbsp;
              <a href="mailto:support@betcheza.co.ke" style="color:rgba(255,255,255,0.35);text-decoration:none;">support@betcheza.co.ke</a>
            </p>
            <p style="margin:0;color:rgba(255,255,255,0.25);font-size:11px;line-height:1.5;">
              © ${new Date().getFullYear()} Betcheza &nbsp;·&nbsp; Bet responsibly &nbsp;·&nbsp; 18+ only
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function statCard(label: string, value: string, color = '#10b981'): string {
  return `<td style="text-align:center;padding:16px 10px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
    <div style="color:${color};font-size:21px;font-weight:800;line-height:1;">${value}</div>
    <div style="color:#94a3b8;font-size:10px;margin-top:5px;text-transform:uppercase;letter-spacing:0.7px;font-weight:600;">${label}</div>
  </td>`;
}

function sectionLabel(text: string): string {
  return `<p style="margin:0 0 12px;color:#94a3b8;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">${text}</p>`;
}

function primaryButton(text: string, href: string, color = '#10b981'): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr>
      <td style="background:${color};border-radius:10px;">
        <a href="${href}" style="display:inline-block;padding:14px 36px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:-0.2px;">${text}</a>
      </td>
    </tr>
  </table>`;
}

function divider(): string {
  return `<div style="height:1px;background:#f1f5f9;margin:28px 0;"></div>`;
}

// ── Tipster Subscription ─────────────────────────────────────────────────────

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

  const html = emailShell(`
    <!-- Hero badge -->
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#f0fdf4;border:2px solid #bbf7d0;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;">🎉</div>
    </div>

    <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;font-weight:800;text-align:center;">You're now subscribed!</h2>
    <p style="margin:0 0 28px;color:#64748b;font-size:14px;line-height:1.65;text-align:center;">
      Hi <strong style="color:#0f172a;">${opts.subscriberName}</strong> — your subscription to
      <strong style="color:#059669;">@${opts.tipsterUsername}</strong> is now active.
    </p>

    ${sectionLabel('Subscription Details')}
    <table role="presentation" width="100%" cellpadding="6" cellspacing="6" style="margin-bottom:28px;">
      <tr>
        ${statCard('Tipster', opts.tipsterName, '#7c3aed')}
        <td style="width:12px;"></td>
        ${statCard('Amount Paid', `${opts.currency} ${opts.price.toLocaleString()}`, '#10b981')}
        <td style="width:12px;"></td>
        ${statCard('Days Remaining', String(opts.daysLeft), '#f59e0b')}
      </tr>
    </table>

    <!-- Active until box -->
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:18px 22px;margin-bottom:28px;">
      <div style="color:#064e3b;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Subscription Active Until</div>
      <div style="color:#059669;font-size:18px;font-weight:800;">${expiry}</div>
    </div>

    <p style="margin:0 0 28px;color:#64748b;font-size:14px;line-height:1.65;">
      You'll receive an email notification every time <strong style="color:#0f172a;">@${opts.tipsterUsername}</strong> posts new tips during your subscription period. Sit back and let the picks come to you.
    </p>

    ${primaryButton('View Tips →', `${BASE_URL}/tipsters/${opts.tipsterUsername}`)}
  `, `You've subscribed to ${opts.tipsterName} on Betcheza`);

  const text = `Hi ${opts.subscriberName},\n\nYou've subscribed to @${opts.tipsterUsername} on Betcheza.\n\nPaid: ${opts.currency} ${opts.price.toLocaleString()}\nActive until: ${expiry} (${opts.daysLeft} days left)\n\nView tips: ${BASE_URL}/tipsters/${opts.tipsterUsername}\n\nBet responsibly. 18+ only.`;

  return {
    subject: `✅ Subscribed to ${opts.tipsterName} — Betcheza`,
    html,
    text,
  };
}

// ── Tipster New Tips ─────────────────────────────────────────────────────────

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
  }>;
}): { subject: string; html: string; text: string } {
  const tipCards = opts.tips.map((t, i) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;border-radius:12px;overflow:hidden;border:1px solid #f1f5f9;">
      <!-- League / pick # -->
      <tr>
        <td style="background:#f8fafc;padding:8px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:#94a3b8;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${t.league}</td>
              <td style="text-align:right;color:#cbd5e1;font-size:10px;font-weight:600;">Pick ${i + 1}</td>
            </tr>
          </table>
        </td>
      </tr>
      <!-- Teams -->
      <tr>
        <td style="background:#ffffff;padding:14px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:40%;text-align:center;">
                <div style="color:#0f172a;font-size:14px;font-weight:700;line-height:1.3;">${t.homeTeam}</div>
                <div style="color:#94a3b8;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-top:3px;">HOME</div>
              </td>
              <td style="width:20%;text-align:center;">
                <div style="background:#f1f5f9;border-radius:6px;padding:6px 4px;color:#64748b;font-size:11px;font-weight:800;">VS</div>
              </td>
              <td style="width:40%;text-align:center;">
                <div style="color:#0f172a;font-size:14px;font-weight:700;line-height:1.3;">${t.awayTeam}</div>
                <div style="color:#94a3b8;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-top:3px;">AWAY</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <!-- Pick + odds -->
      <tr>
        <td style="background:#fafafa;border-top:1px solid #f1f5f9;padding:10px 16px;text-align:center;">
          <span style="display:inline-block;background:#7c3aed;color:#fff;font-size:11px;font-weight:700;padding:4px 14px;border-radius:20px;margin-right:8px;">${t.pick}</span>
          <span style="color:#64748b;font-size:12px;">${t.market}</span>
          <span style="color:#94a3b8;font-size:12px;"> · Odds </span>
          <span style="color:#f59e0b;font-size:14px;font-weight:800;">${t.odds}</span>
        </td>
      </tr>
    </table>
  `).join('');

  const html = emailShell(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:#fef3c7;border:2px solid #fcd34d;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;">🔥</div>
    </div>

    <h2 style="margin:0 0 6px;color:#0f172a;font-size:22px;font-weight:800;text-align:center;">New tips from @${opts.tipsterUsername}</h2>
    <p style="margin:0 0 28px;color:#64748b;font-size:14px;line-height:1.65;text-align:center;">
      Hi <strong style="color:#0f172a;">${opts.subscriberName}</strong> — <strong style="color:#059669;">${opts.tipsterName}</strong> just posted
      <strong style="color:#0f172a;">${opts.tips.length} new tip${opts.tips.length !== 1 ? 's' : ''}</strong> for you.
    </p>

    ${sectionLabel("Today's Tips")}
    ${tipCards}

    ${divider()}

    ${primaryButton('View All Tips →', `${BASE_URL}/tipsters/${opts.tipsterUsername}`)}

    <p style="margin:20px 0 0;color:#94a3b8;font-size:11px;text-align:center;line-height:1.6;">
      Tips are for entertainment &amp; educational purposes only.<br/>
      Always bet responsibly. Odds can change at kick-off.
    </p>
  `, `${opts.tipsterName} posted ${opts.tips.length} new tip${opts.tips.length !== 1 ? 's' : ''}`);

  const tipLines = opts.tips.map(t =>
    `• ${t.homeTeam} vs ${t.awayTeam} — ${t.pick} (${t.market}) @ ${t.odds}`
  ).join('\n');

  const text = `Hi ${opts.subscriberName},\n\n${opts.tipsterName} just posted ${opts.tips.length} new tip${opts.tips.length !== 1 ? 's' : ''}:\n\n${tipLines}\n\nView all tips: ${BASE_URL}/tipsters/${opts.tipsterUsername}\n\nBet responsibly. 18+ only.`;

  return {
    subject: `🔥 New tips from ${opts.tipsterName} — Betcheza`,
    html,
    text,
  };
}

// ── Strategy Access ──────────────────────────────────────────────────────────

export function strategyAccessEmail(opts: {
  subscriberName: string;
  startDay: number;
  endDay: number;
  expiresAt: string;
  stake: number;
}): { subject: string; html: string; text: string } {
  const expiry = new Date(opts.expiresAt).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const html = emailShell(`
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:#f0fdf4;border:2px solid #bbf7d0;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;">🚀</div>
    </div>

    <h2 style="margin:0 0 6px;color:#0f172a;font-size:22px;font-weight:800;text-align:center;">Your strategy is live!</h2>
    <p style="margin:0 0 28px;color:#64748b;font-size:14px;line-height:1.65;text-align:center;">
      Hi <strong style="color:#0f172a;">${opts.subscriberName}</strong> — your 7-day
      <strong style="color:#059669;">3 Daily Odds Strategy</strong> has been activated.
      Picks are published each morning — check your email daily.
    </p>

    ${sectionLabel('Strategy Overview')}
    <table role="presentation" width="100%" cellpadding="6" cellspacing="6" style="margin-bottom:28px;">
      <tr>
        ${statCard('Days', `${opts.startDay}–${opts.endDay}`, '#7c3aed')}
        <td style="width:12px;"></td>
        ${statCard('Daily Stake', `KES ${opts.stake.toLocaleString()}`, '#10b981')}
        <td style="width:12px;"></td>
        ${statCard('Active Until', expiry, '#f59e0b')}
      </tr>
    </table>

    <!-- How it works -->
    <div style="background:#f0fdf4;border-left:4px solid #10b981;border-radius:0 12px 12px 0;padding:18px 20px;margin-bottom:28px;">
      <div style="color:#064e3b;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">💡 How it works</div>
      <p style="margin:0;color:#334155;font-size:14px;line-height:1.7;">
        Each day we publish <strong>2–3 football picks</strong> with combined odds between <strong>3.0 – 4.0</strong>.
        Follow the daily staking plan and let compounding work over your 7 days. Picks arrive in your inbox every morning.
      </p>
    </div>

    <!-- Steps -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      ${[
        ['1', 'Check your email every morning for the day\'s picks', '#10b981'],
        ['2', 'Place the exact picks with your preferred bookmaker', '#7c3aed'],
        ['3', 'Follow the staking plan — don\'t skip or change picks', '#f59e0b'],
      ].map(([n, txt, c]) => `
      <tr>
        <td style="padding:8px 0;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:top;padding-right:12px;">
                <div style="width:26px;height:26px;background:${c};border-radius:50%;text-align:center;line-height:26px;font-size:12px;color:#fff;font-weight:800;">${n}</div>
              </td>
              <td style="vertical-align:middle;color:#334155;font-size:14px;line-height:1.5;">${txt}</td>
            </tr>
          </table>
        </td>
      </tr>`).join('')}
    </table>

    ${primaryButton('Open My Strategy →', `${BASE_URL}/strategy`, '#059669')}
  `, 'Your 3 Daily Odds Strategy is now active');

  const text = `Hi ${opts.subscriberName},\n\nYour 3 Daily Odds Strategy is now active (Days ${opts.startDay}–${opts.endDay}).\n\nActive until: ${expiry}\nDaily stake: KES ${opts.stake.toLocaleString()}\n\nCheck your email every morning for picks.\nView strategy: ${BASE_URL}/strategy\n\nBet responsibly. 18+ only.`;

  return {
    subject: `🚀 Your 3 Daily Odds Strategy is live — Betcheza`,
    html,
    text,
  };
}

// ── Strategy Expiry Reminder ─────────────────────────────────────────────────

export function strategyExpiryReminderEmail(opts: {
  subscriberName: string;
  daysLeft: number;
  expiresAt: string;
}): { subject: string; html: string; text: string } {
  const expiry = new Date(opts.expiresAt).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const urgentColor = opts.daysLeft <= 1 ? '#ef4444' : '#f59e0b';

  const html = emailShell(`
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#fefce8;border:2px solid #fde047;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:32px;">⏰</div>
    </div>

    <h2 style="margin:0 0 6px;color:#0f172a;font-size:22px;font-weight:800;text-align:center;">
      ${opts.daysLeft === 1 ? 'Last day' : `${opts.daysLeft} days left`} on your strategy
    </h2>
    <p style="margin:0 0 28px;color:#64748b;font-size:14px;line-height:1.65;text-align:center;">
      Hi <strong style="color:#0f172a;">${opts.subscriberName}</strong> — your strategy access expires on
      <strong style="color:${urgentColor};">${expiry}</strong>. Don't miss today's picks!
    </p>

    <!-- Countdown -->
    <div style="text-align:center;background:#fafafa;border:2px solid #f1f5f9;border-radius:16px;padding:28px;margin-bottom:28px;">
      <div style="color:${urgentColor};font-size:72px;font-weight:900;line-height:1;letter-spacing:-2px;">${opts.daysLeft}</div>
      <div style="color:#64748b;font-size:14px;font-weight:600;margin-top:8px;text-transform:uppercase;letter-spacing:0.5px;">
        day${opts.daysLeft !== 1 ? 's' : ''} remaining
      </div>
    </div>

    <div style="background:#fff8e6;border-left:4px solid #f59e0b;border-radius:0 12px 12px 0;padding:16px 20px;margin-bottom:28px;">
      <p style="margin:0;color:#78350f;font-size:14px;line-height:1.65;">
        Make sure you've checked <strong>today's picks</strong>. Every day counts — don't let a pick go unplaced.
      </p>
    </div>

    ${primaryButton("Check Today's Picks →", `${BASE_URL}/strategy`, urgentColor)}

    <p style="margin:20px 0 0;color:#94a3b8;font-size:12px;text-align:center;">
      Want to continue? You can renew your access anytime on the strategy page.
    </p>
  `, `${opts.daysLeft} day${opts.daysLeft !== 1 ? 's' : ''} left on your strategy`);

  const text = `Hi ${opts.subscriberName},\n\nYour strategy access expires on ${expiry} (${opts.daysLeft} day${opts.daysLeft !== 1 ? 's' : ''} left).\n\nCheck today's picks: ${BASE_URL}/strategy\n\nBet responsibly. 18+ only.`;

  return {
    subject: `⏰ ${opts.daysLeft} day${opts.daysLeft !== 1 ? 's' : ''} left — 3 Daily Odds Strategy — Betcheza`,
    html,
    text,
  };
}

// ── Strategy Daily Picks ─────────────────────────────────────────────────────

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

  const pickCards = opts.picks.map((p, i) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
      <!-- Pick header -->
      <tr>
        <td style="background:#0f172a;padding:10px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="background:#10b981;color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:0.5px;">PICK ${i + 1}</span>
              </td>
              <td style="text-align:right;">
                <span style="color:#475569;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${p.league}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <!-- Teams -->
      <tr>
        <td style="background:#ffffff;padding:18px 16px 14px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:40%;text-align:center;">
                <div style="color:#0f172a;font-size:15px;font-weight:700;line-height:1.3;">${p.homeTeam}</div>
                <div style="color:#94a3b8;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">HOME</div>
              </td>
              <td style="width:20%;text-align:center;">
                <div style="background:#f1f5f9;border-radius:8px;padding:8px 4px;color:#64748b;font-size:12px;font-weight:800;">VS</div>
              </td>
              <td style="width:40%;text-align:center;">
                <div style="color:#0f172a;font-size:15px;font-weight:700;line-height:1.3;">${p.awayTeam}</div>
                <div style="color:#94a3b8;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">AWAY</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <!-- Bet row -->
      <tr>
        <td style="background:#fafafa;border-top:1px solid #f1f5f9;padding:12px 16px;text-align:center;">
          <span style="display:inline-block;background:#7c3aed;color:#fff;font-size:11px;font-weight:700;padding:5px 16px;border-radius:20px;margin-right:8px;">${p.pick}</span>
          <span style="color:#64748b;font-size:12px;">${p.market}</span>
          <span style="color:#94a3b8;font-size:12px;"> · Odds </span>
          <span style="color:#f59e0b;font-size:16px;font-weight:900;">${p.odds}</span>
        </td>
      </tr>
      ${p.reasoning ? `
      <!-- Reasoning -->
      <tr>
        <td style="background:#fafafa;border-top:1px solid #f1f5f9;padding:10px 16px;">
          <p style="margin:0;color:#64748b;font-size:11px;line-height:1.65;font-style:italic;">💡 ${p.reasoning}</p>
        </td>
      </tr>` : ''}
    </table>
  `).join('');

  // Day progress dots
  const dots = Array.from({ length: 7 }, (_, i) => {
    const d = i + 1;
    if (d < opts.day) {
      return `<td style="text-align:center;padding:0 4px;"><div style="width:32px;height:32px;background:#10b981;border-radius:50%;line-height:32px;text-align:center;font-size:12px;color:#fff;font-weight:800;display:inline-block;">✓</div></td>`;
    }
    if (d === opts.day) {
      return `<td style="text-align:center;padding:0 4px;"><div style="width:32px;height:32px;background:#7c3aed;border-radius:50%;line-height:32px;text-align:center;font-size:12px;color:#fff;font-weight:900;display:inline-block;">${d}</div></td>`;
    }
    return `<td style="text-align:center;padding:0 4px;"><div style="width:32px;height:32px;background:#e2e8f0;border-radius:50%;line-height:32px;text-align:center;font-size:12px;color:#94a3b8;font-weight:600;display:inline-block;">${d}</div></td>`;
  }).join('');

  const html = emailShell(`
    <!-- Day badge -->
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:#0f172a;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:30px;">🎯</div>
    </div>

    <h2 style="margin:0 0 4px;color:#0f172a;font-size:24px;font-weight:900;text-align:center;letter-spacing:-0.4px;">Day ${opts.day} Picks Are Ready!</h2>
    <p style="margin:0 0 28px;color:#94a3b8;font-size:13px;text-align:center;">${opts.date} &nbsp;·&nbsp; 3 Daily Odds Strategy</p>

    <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.65;text-align:center;">
      Hi <strong style="color:#0f172a;">${opts.subscriberName}</strong> 👋 — here are today's picks.
      Stay disciplined and let compounding work for you.
    </p>

    ${sectionLabel('Strategy Stats')}
    <table role="presentation" width="100%" cellpadding="6" cellspacing="6" style="margin-bottom:28px;">
      <tr>
        ${statCard(`Day`, `${opts.day} of 7`, '#7c3aed')}
        <td style="width:12px;"></td>
        ${statCard("Today's Stake", `KES ${opts.stake.toLocaleString()}`, '#10b981')}
        <td style="width:12px;"></td>
        ${statCard('Combined Odds', `${opts.combinedOdds}×`, '#f59e0b')}
      </tr>
    </table>

    ${sectionLabel("Today's Picks")}
    ${pickCards}

    <!-- Potential return banner -->
    <div style="background:linear-gradient(135deg,#064e3b 0%,#065f46 100%);border-radius:14px;padding:24px;margin:20px 0 28px;text-align:center;">
      <div style="color:#6ee7b7;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">💰 Potential Return if All Win</div>
      <div style="color:#ffffff;font-size:36px;font-weight:900;letter-spacing:-0.5px;margin-bottom:4px;">KES ${opts.targetWin.toLocaleString()}</div>
      <div style="color:#a7f3d0;font-size:13px;">KES ${opts.stake.toLocaleString()} stake × ${opts.combinedOdds} combined odds</div>
    </div>

    <!-- Week progress -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin-bottom:28px;">
      <div style="color:#94a3b8;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;text-align:center;margin-bottom:14px;">Week Progress</div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>${dots}</tr>
      </table>
    </div>

    ${primaryButton('View Full Strategy & Plan →', `${BASE_URL}/strategy`, '#059669')}

    <p style="margin:20px 0 0;color:#94a3b8;font-size:11px;text-align:center;line-height:1.7;">
      These picks are for entertainment &amp; educational purposes.<br/>
      Always bet within your means. Odds can change at kick-off.
    </p>
  `, `Day ${opts.day} picks: ${opts.picks.map(p => `${p.homeTeam} vs ${p.awayTeam}`).join(', ')}`);

  const pickLines = opts.picks.map(p =>
    `• ${p.homeTeam} vs ${p.awayTeam} — ${p.pick} (${p.market}) @ ${p.odds}`
  ).join('\n');

  const text = `Hi ${opts.subscriberName},\n\nDay ${opts.day} picks for 3 Daily Odds Strategy:\n\n${pickLines}\n\nCombined odds: ${opts.combinedOdds}\nStake: KES ${opts.stake.toLocaleString()} → Target: KES ${opts.targetWin.toLocaleString()}\n\nView: ${BASE_URL}/strategy\n\nBet responsibly. 18+ only.`;

  return {
    subject: `🎯 Day ${opts.day} Picks Ready — ${opts.combinedOdds}× odds — Betcheza`,
    html,
    text,
  };
}

// ── Broadcast / Blast Email ──────────────────────────────────────────────────

/**
 * Wraps any plain-text or HTML broadcast body in the Betcheza branded template.
 * Used by the admin email blast system.
 */
export function buildBroadcastEmail(opts: {
  subject: string;
  body: string;
  recipientName?: string;
  ctaText?: string;
  ctaUrl?: string;
}): { html: string; text: string } {
  const greeting = opts.recipientName
    ? `<p style="margin:0 0 20px;color:#0f172a;font-size:16px;font-weight:600;">Hi ${opts.recipientName},</p>`
    : '';

  const bodyHtml = opts.body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .split('\n\n')
    .map(para => para.trim())
    .filter(Boolean)
    .map(para => `<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.7;">${para.replace(/\n/g, '<br/>')}</p>`)
    .join('');

  const ctaHtml = opts.ctaText && opts.ctaUrl
    ? `${divider()}${primaryButton(`${opts.ctaText} →`, opts.ctaUrl)}`
    : '';

  const html = emailShell(`
    ${greeting}
    ${bodyHtml}
    ${ctaHtml}
    <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;text-align:center;line-height:1.6;">
      You received this email as a registered Betcheza user.<br/>
      <a href="${BASE_URL}/dashboard/settings" style="color:#10b981;text-decoration:none;">Manage email preferences</a>
    </p>
  `, opts.subject);

  return { html, text: opts.body };
}

// ── Bookmaker Partnership Emails ─────────────────────────────────────────────

type BookmakerTier = 'banner' | 'odds' | 'homepage' | 'package';

const TIER_DETAILS: Record<BookmakerTier, { title: string; price: string; features: string[] }> = {
  banner: {
    title: 'Banner Advertising Package',
    price: 'KES 25,000 / month',
    features: [
      '728×90 leaderboard banner on all match pages',
      '300×250 sidebar banners across site',
      'Mobile-responsive ad units',
      'Retargeting to betting-active users',
      'Monthly performance report',
    ],
  },
  odds: {
    title: 'Live Odds Integration',
    price: 'KES 40,000 / month',
    features: [
      'Your odds shown on every match page',
      '"Bet Now" CTA linking to your bet slip',
      'Real-time odds updates via API',
      'Priority placement above competitor odds',
      'Bet slip deeplinks for each selection',
    ],
  },
  homepage: {
    title: 'Homepage Featured Placement',
    price: 'KES 35,000 / month',
    features: [
      'Featured bookmaker slot on the homepage',
      'Logo + promo banner above the fold',
      'Exclusive "Recommended Bookmaker" badge',
      'Welcome bonus promotion display',
      'Link to sign-up/deposit page',
    ],
  },
  package: {
    title: 'Complete Partnership Package',
    price: 'KES 80,000 / month',
    features: [
      'Everything in Banner + Odds + Homepage',
      'Dedicated bookmaker profile page',
      'Featured in jackpot and tips sections',
      'Email campaigns to 5,000+ subscribers',
      'Social media mentions (Twitter/Instagram)',
      'Quarterly strategy & performance review',
    ],
  },
};

function checkItem(text: string): string {
  return `<tr>
    <td style="padding:7px 0;">
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:24px;vertical-align:top;padding-top:1px;">
            <div style="width:20px;height:20px;background:#10b981;border-radius:50%;text-align:center;line-height:20px;font-size:12px;color:#fff;font-weight:700;">✓</div>
          </td>
          <td style="padding-left:10px;color:#334155;font-size:13px;line-height:1.55;">${text}</td>
        </tr>
      </table>
    </td>
  </tr>`;
}

export function bookmakerPartnershipEmail(opts: {
  bookmakerName: string;
  contactName?: string;
  tier: BookmakerTier;
  customNote?: string;
}): { subject: string; html: string; text: string } {
  const tier = TIER_DETAILS[opts.tier];
  const greeting = opts.contactName
    ? `Hi ${opts.contactName},`
    : `Hi ${opts.bookmakerName} Team,`;
  const year = new Date().getFullYear();
  const month = new Date().toLocaleString('en-KE', { month: 'long', year: 'numeric' });
  const logoUrl = `${BASE_URL}/betcheza-logo.png`;

  const statPill = (val: string, label: string, accent: string) => `
    <td style="text-align:center;padding:0 6px;">
      <div style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px 12px;">
        <div style="color:${accent};font-size:22px;font-weight:900;letter-spacing:-0.5px;line-height:1;">${val}</div>
        <div style="color:rgba(255,255,255,0.45);font-size:9px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;margin-top:6px;">${label}</div>
      </div>
    </td>`;

  const whyRow = (emoji: string, title: string, desc: string) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="width:36px;vertical-align:top;padding-top:2px;">
              <div style="width:30px;height:30px;background:#f0fdf4;border-radius:8px;text-align:center;line-height:30px;font-size:15px;">${emoji}</div>
            </td>
            <td style="padding-left:12px;vertical-align:top;">
              <div style="color:#0f172a;font-size:13px;font-weight:700;margin-bottom:2px;">${title}</div>
              <div style="color:#64748b;font-size:12px;line-height:1.55;">${desc}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  const featureRow = (text: string) => `
    <tr>
      <td style="padding:7px 0;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:26px;vertical-align:middle;">
              <div style="width:20px;height:20px;background:linear-gradient(135deg,#7c3aed,#a855f7);border-radius:50%;text-align:center;line-height:20px;font-size:11px;color:#fff;font-weight:800;">✓</div>
            </td>
            <td style="padding-left:10px;color:#334155;font-size:13px;line-height:1.6;">${text}</td>
          </tr>
        </table>
      </td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Partnership Proposal — Betcheza × ${opts.bookmakerName}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Exclusive advertising partnership proposal for ${opts.bookmakerName} from Betcheza — Kenya's leading sports predictions platform.</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:40px 16px;">
    <tr><td align="center">
    <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">

      <!-- ═══ HEADER ═══ -->
      <tr>
        <td style="background:linear-gradient(145deg,#0b1120 0%,#0f172a 45%,#1a1040 100%);border-radius:18px 18px 0 0;padding:36px 40px 28px;text-align:center;">

          <!-- Logo -->
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
            <tr>
              <td style="text-align:center;">
                <img src="${logoUrl}" alt="Betcheza" width="160" height="auto"
                  style="display:block;max-width:160px;height:auto;margin:0 auto;"
                  onerror="this.style.display='none'" />
                <div style="margin-top:4px;color:rgba(255,255,255,0.35);font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Kenya's #1 Tipster Community</div>
              </td>
            </tr>
          </table>

          <!-- Badge -->
          <div style="display:inline-block;background:rgba(124,58,237,0.25);border:1px solid rgba(167,139,250,0.35);border-radius:30px;padding:7px 22px;margin-bottom:22px;">
            <span style="color:rgba(255,255,255,0.9);font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">🤝 Partnership Proposal · ${year}</span>
          </div>

          <!-- Headline -->
          <h1 style="margin:0 0 8px;color:#ffffff;font-size:26px;font-weight:900;line-height:1.2;letter-spacing:-0.5px;">
            Grow <span style="color:#a78bfa;">${opts.bookmakerName}</span><br/>with Kenya's Most Engaged Bettors
          </h1>
          <p style="margin:0;color:rgba(255,255,255,0.5);font-size:13px;line-height:1.6;">
            An exclusive advertising opportunity tailored for ${opts.bookmakerName}
          </p>
        </td>
      </tr>

      <!-- Rainbow accent -->
      <tr><td style="height:4px;background:linear-gradient(90deg,#7c3aed 0%,#10b981 40%,#f59e0b 75%,#ef4444 100%);"></td></tr>

      <!-- ═══ AUDIENCE STATS ═══ -->
      <tr>
        <td style="background:#0f172a;padding:24px 40px 28px;">
          <p style="margin:0 0 16px;color:rgba(255,255,255,0.35);font-size:9px;font-weight:800;letter-spacing:2px;text-transform:uppercase;text-align:center;">Our Audience — ${month}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              ${statPill('50K+', 'Monthly Visitors', '#10b981')}
              ${statPill('87%', 'Mobile Audience', '#a78bfa')}
              ${statPill('2.5m', 'Avg. Session', '#f59e0b')}
              ${statPill('93%', 'East Africa Reach', '#38bdf8')}
            </tr>
          </table>
          <p style="margin:14px 0 0;color:rgba(255,255,255,0.25);font-size:10px;text-align:center;">Source: Microsoft Clarity · rolling 30-day average</p>
        </td>
      </tr>

      <!-- ═══ BODY ═══ -->
      <tr>
        <td style="background:#ffffff;padding:36px 40px 32px;">

          <!-- Greeting -->
          <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.75;">
            ${greeting}<br/><br/>
            We are reaching out to offer <strong style="color:#0f172a;">${opts.bookmakerName}</strong> an exclusive spot on
            <a href="${BASE_URL}" style="color:#7c3aed;font-weight:700;text-decoration:none;">Betcheza.co.ke</a> —
            where Kenya's most committed sports bettors discover tips, analyse odds, and decide where to place their bets every single day.
          </p>

          <!-- Why Betcheza -->
          <h2 style="margin:0 0 16px;color:#0f172a;font-size:16px;font-weight:800;border-left:3px solid #7c3aed;padding-left:12px;">
            Why ${opts.bookmakerName} Should Partner with Betcheza
          </h2>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
            ${whyRow('🎯', 'Pure Betting Intent', `Every visitor comes specifically for sports predictions and odds. ${opts.bookmakerName}'s brand appears exactly when they're ready to bet.`)}
            ${whyRow('📍', 'Kenya-First Reach', `78% Kenya, 93% East Africa. ${opts.bookmakerName} reaches the precise local market that matters, verified by Clarity.`)}
            ${whyRow('📈', 'Match-Day Traffic Spikes', `Traffic surges 3–5× on major match days — EPL, KPL, Champions League. Peak exposure for ${opts.bookmakerName} exactly when intent is highest.`)}
            ${whyRow('🤖', 'AI-Powered Engagement', 'Betcheza AI generates daily predictions that keep bettors returning. Subscribers engage for 2.5 minutes per session on average.')}
            ${whyRow('✅', 'Verified Real Bettors', 'Every account is registered and verified. Zero incentive traffic, zero bot farms — pure, high-quality betting audience.')}
          </table>

          <!-- Proposed package -->
          <div style="background:linear-gradient(135deg,#faf5ff 0%,#f5f3ff 100%);border:2px solid #7c3aed;border-radius:16px;padding:28px;margin-bottom:28px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr>
                <td style="vertical-align:middle;">
                  <div style="color:#7c3aed;font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;">Proposed for ${opts.bookmakerName}</div>
                  <h3 style="margin:0;color:#4c1d95;font-size:20px;font-weight:900;letter-spacing:-0.3px;">${tier.title}</h3>
                </td>
                <td style="text-align:right;vertical-align:middle;">
                  <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-size:14px;font-weight:800;padding:10px 20px;border-radius:30px;white-space:nowrap;box-shadow:0 4px 14px rgba(124,58,237,0.35);">${tier.price}</div>
                </td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${tier.features.map(featureRow).join('')}
            </table>
          </div>

          ${opts.customNote ? `
          <!-- Custom note -->
          <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 12px 12px 0;padding:16px 20px;margin-bottom:28px;">
            <div style="color:#92400e;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">📌 Special Note for ${opts.bookmakerName}</div>
            <p style="margin:0;color:#78350f;font-size:13px;line-height:1.7;">${opts.customNote}</p>
          </div>` : ''}

          <!-- CTA block -->
          <div style="background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%);border-radius:16px;padding:32px;text-align:center;">
            <div style="color:rgba(255,255,255,0.5);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;">Ready to grow with Kenya's #1 betting community?</div>
            <h3 style="margin:0 0 8px;color:#ffffff;font-size:18px;font-weight:800;">Let's talk, ${opts.bookmakerName}</h3>
            <p style="margin:0 0 24px;color:rgba(255,255,255,0.55);font-size:13px;line-height:1.65;">
              Reply to this email and we'll send you our full media kit and a tailored proposal within 24 hours. No commitment required.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="padding-right:12px;">
                  <a href="mailto:partnerships@betcheza.co.ke?subject=Re%3A%20Partnership%20Proposal%20%E2%80%94%20${encodeURIComponent(opts.bookmakerName)}"
                    style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-weight:700;font-size:14px;padding:14px 26px;border-radius:10px;text-decoration:none;box-shadow:0 4px 14px rgba(124,58,237,0.4);">
                    Reply to Discuss →
                  </a>
                </td>
                <td>
                  <a href="${BASE_URL}/partner"
                    style="display:inline-block;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;font-weight:600;font-size:14px;padding:14px 26px;border-radius:10px;text-decoration:none;">
                    View Partnership Page
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:20px 0 0;color:rgba(255,255,255,0.3);font-size:11px;">
              Or WhatsApp us: <a href="https://wa.me/254113226240" style="color:#10b981;text-decoration:none;">+254 113 226 240</a>
            </p>
          </div>

          <p style="margin:24px 0 0;color:#94a3b8;font-size:11px;line-height:1.8;text-align:center;">
            This proposal was prepared exclusively for <strong style="color:#64748b;">${opts.bookmakerName}</strong>.<br/>
            Rates are fully negotiable for long-term or exclusive partnerships.
          </p>
        </td>
      </tr>

      <!-- ═══ FOOTER ═══ -->
      <tr>
        <td style="background:#0b1120;border-radius:0 0 18px 18px;padding:28px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;">
                <img src="${logoUrl}" alt="Betcheza" width="100" height="auto"
                  style="display:block;max-width:100px;height:auto;margin-bottom:10px;opacity:0.7;"
                  onerror="this.style.display='none'" />
                <p style="margin:0;color:rgba(255,255,255,0.35);font-size:11px;line-height:1.8;">
                  Kenya's #1 Sports Betting Tipster Community<br/>
                  <a href="mailto:partnerships@betcheza.co.ke" style="color:#10b981;text-decoration:none;">partnerships@betcheza.co.ke</a>
                  &nbsp;·&nbsp;
                  <a href="${BASE_URL}" style="color:#10b981;text-decoration:none;">betcheza.co.ke</a>
                </p>
              </td>
              <td style="text-align:right;vertical-align:top;">
                <p style="margin:0;color:rgba(255,255,255,0.2);font-size:10px;line-height:1.8;">
                  Confidential<br/>
                  Prepared for ${opts.bookmakerName}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

    </table>
    </td></tr>
  </table>
</body>
</html>`;

  const featureText = tier.features.map(f => `  ✓ ${f}`).join('\n');
  const text = `${greeting}

Partnership Proposal — Betcheza × ${opts.bookmakerName}

We're reaching out to offer ${opts.bookmakerName} an exclusive advertising opportunity on Betcheza.co.ke — Kenya's #1 sports predictions platform, where thousands of active bettors discover tips, compare odds, and place bets every day.

WHY ${opts.bookmakerName.toUpperCase()} SHOULD PARTNER WITH BETCHEZA
• Pure betting intent — every visitor is in betting mode
• Kenya-first: 78% Kenya, 93% East Africa (Clarity verified)
• Match-day traffic spikes 3–5× on major fixtures
• 2.5-minute average session — highly engaged audience
• Verified real bettors — zero bot traffic

PROPOSED PACKAGE FOR ${opts.bookmakerName.toUpperCase()}
${tier.title} — ${tier.price}
${featureText}
${opts.customNote ? `\nSPECIAL NOTE FOR ${opts.bookmakerName.toUpperCase()}\n${opts.customNote}\n` : ''}
READY TO GET STARTED?
Reply to this email and we'll send our full media kit and a tailored proposal within 24 hours.

partnerships@betcheza.co.ke
${BASE_URL}/partner

Best regards,
The Betcheza Partnerships Team
Kenya's #1 Sports Betting Tipster Community`;

  return {
    subject: `Partnership Proposal for ${opts.bookmakerName} — Advertise on Betcheza.co.ke`,
    html,
    text,
  };
}

