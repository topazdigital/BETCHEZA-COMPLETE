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
  }>;
}): { subject: string; html: string; text: string } {
  const tipRows = opts.tips.map(t => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #334155;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:40%;text-align:center;padding:8px 4px;background:#0f172a;border-radius:6px 0 0 6px;">
              <div style="color:#f1f5f9;font-size:13px;font-weight:700;">${t.homeTeam}</div>
            </td>
            <td style="width:20%;text-align:center;background:#0f172a;">
              <div style="color:#475569;font-size:11px;font-weight:700;">VS</div>
            </td>
            <td style="width:40%;text-align:center;padding:8px 4px;background:#0f172a;border-radius:0 6px 6px 0;">
              <div style="color:#f1f5f9;font-size:13px;font-weight:700;">${t.awayTeam}</div>
            </td>
          </tr>
        </table>
        <div style="margin-top:8px;text-align:center;">
          <span style="display:inline-block;background:#7c3aed;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:5px;">${t.pick}</span>
          <span style="color:#64748b;font-size:11px;margin-left:6px;">${t.market} · <strong style="color:#f59e0b;">${t.odds}</strong></span>
        </div>
        <div style="text-align:center;margin-top:4px;color:#475569;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">${t.league}</div>
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

  const text = `Hi ${opts.subscriberName},\n\n${opts.tipsterName} just posted ${opts.tips.length} new tip${opts.tips.length !== 1 ? 's' : ''}:\n\n${tipLines}\n\nView all tips: ${BASE_URL}/tipsters/${opts.tipsterUsername}\n\nBet responsibly. 18+ only.`;

  return {
    subject: `🔥 New tips from ${opts.tipsterName} — Betcheza`,
    html,
    text,
  };
}

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

  const html = baseLayout(`
    <h2 style="margin:0 0 8px;color:#f1f5f9;font-size:20px;">Your strategy is now live! 🚀</h2>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6;">
      Hi <strong style="color:#f1f5f9;">${opts.subscriberName}</strong>, your 7-day 3 Daily Odds Strategy has been activated.
      Picks are published each day — check your email and the strategy page daily.
    </p>

    <table width="100%" cellpadding="8" cellspacing="8" style="margin-bottom:24px;">
      <tr>
        ${statBox('Days', `${opts.startDay}–${opts.endDay}`, '#7c3aed')}
        ${statBox('Daily Stake', `KES ${opts.stake.toLocaleString()}`, '#10b981')}
        ${statBox('Active Until', expiry, '#f59e0b')}
      </tr>
    </table>

    <div style="background:#0f172a;border-radius:8px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
        💡 <strong style="color:#f1f5f9;">How it works:</strong> Each day we publish 2–3 football picks with combined odds between 3.0–4.0.
        Follow the staking plan and let compounding do the work over 7 days.
      </p>
    </div>

    <a href="${BASE_URL}/3-daily-odds-strategy"
       style="display:inline-block;background:#10b981;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">
      Open My Strategy →
    </a>
  `, 'Your 3 Daily Odds Strategy is now active');

  const text = `Hi ${opts.subscriberName},\n\nYour 3 Daily Odds Strategy is now active (Days ${opts.startDay}–${opts.endDay}).\n\nActive until: ${expiry}\nDaily stake: KES ${opts.stake.toLocaleString()}\n\nView strategy: ${BASE_URL}/3-daily-odds-strategy\n\nBet responsibly. 18+ only.`;

  return {
    subject: `🚀 Your 3 Daily Odds Strategy is live — Betcheza`,
    html,
    text,
  };
}

export function strategyExpiryReminderEmail(opts: {
  subscriberName: string;
  daysLeft: number;
  expiresAt: string;
}): { subject: string; html: string; text: string } {
  const expiry = new Date(opts.expiresAt).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const html = baseLayout(`
    <h2 style="margin:0 0 8px;color:#f1f5f9;font-size:20px;">⏰ ${opts.daysLeft} day${opts.daysLeft !== 1 ? 's' : ''} left on your strategy</h2>
    <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6;">
      Hi <strong style="color:#f1f5f9;">${opts.subscriberName}</strong>,
      your 3 Daily Odds Strategy access expires on <strong style="color:#f59e0b;">${expiry}</strong>.
      Make sure you've checked today's picks before time runs out.
    </p>

    <div style="background:#0f172a;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;">
      <div style="color:#f59e0b;font-size:36px;font-weight:800;">${opts.daysLeft}</div>
      <div style="color:#94a3b8;font-size:13px;margin-top:4px;">day${opts.daysLeft !== 1 ? 's' : ''} remaining</div>
    </div>

    <a href="${BASE_URL}/3-daily-odds-strategy"
       style="display:inline-block;background:#f59e0b;color:#000;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">
      Check Today's Picks →
    </a>
  `, `${opts.daysLeft} days left on your strategy`);

  const text = `Hi ${opts.subscriberName},\n\nYour strategy access expires on ${expiry} (${opts.daysLeft} day${opts.daysLeft !== 1 ? 's' : ''} left).\n\nView picks: ${BASE_URL}/3-daily-odds-strategy\n\nBet responsibly. 18+ only.`;

  return {
    subject: `⏰ ${opts.daysLeft} day${opts.daysLeft !== 1 ? 's' : ''} left — 3 Daily Odds Strategy — Betcheza`,
    html,
    text,
  };
}

/** Sent daily to strategy subscribers when picks are published */
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
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;border-radius:10px;overflow:hidden;border-left:4px solid #10b981;background:#0f172a;">
      <tr>
        <td style="padding:16px;">
          <!-- Pick number + league -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
            <tr>
              <td>
                <span style="background:#10b981;color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;">PICK ${i + 1}</span>
              </td>
              <td style="text-align:right;">
                <span style="color:#475569;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">${p.league}</span>
              </td>
            </tr>
          </table>
          <!-- Teams VS layout -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
            <tr>
              <td style="width:42%;text-align:center;">
                <div style="color:#f1f5f9;font-size:15px;font-weight:700;line-height:1.3;">${p.homeTeam}</div>
                <div style="color:#475569;font-size:10px;margin-top:3px;">HOME</div>
              </td>
              <td style="width:16%;text-align:center;">
                <div style="color:#334155;font-size:13px;font-weight:900;background:#1e293b;border-radius:6px;padding:6px 4px;">VS</div>
              </td>
              <td style="width:42%;text-align:center;">
                <div style="color:#f1f5f9;font-size:15px;font-weight:700;line-height:1.3;">${p.awayTeam}</div>
                <div style="color:#475569;font-size:10px;margin-top:3px;">AWAY</div>
              </td>
            </tr>
          </table>
          <!-- Bet recommendation -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="text-align:center;">
                <span style="display:inline-block;background:#7c3aed;color:#fff;font-size:12px;font-weight:700;padding:5px 14px;border-radius:6px;margin-right:8px;">${p.pick}</span>
                <span style="color:#64748b;font-size:12px;">${p.market} · Odds: <strong style="color:#f59e0b;font-size:14px;">${p.odds}</strong></span>
              </td>
            </tr>
          </table>
          ${p.reasoning ? `
          <div style="margin-top:12px;padding-top:10px;border-top:1px solid #1e293b;">
            <p style="margin:0;color:#64748b;font-size:11px;line-height:1.6;font-style:italic;">${p.reasoning}</p>
          </div>` : ''}
        </td>
      </tr>
    </table>
  `).join('');

  // Day progress dots
  const dots = Array.from({ length: 7 }, (_, i) => {
    const d = i + 1;
    if (d < opts.day) return `<td style="text-align:center;padding:0 3px;"><div style="width:28px;height:28px;background:#10b981;border-radius:50%;line-height:28px;text-align:center;font-size:11px;color:#fff;font-weight:700;display:inline-block;">${d}</div></td>`;
    if (d === opts.day) return `<td style="text-align:center;padding:0 3px;"><div style="width:28px;height:28px;background:#7c3aed;border-radius:50%;line-height:28px;text-align:center;font-size:11px;color:#fff;font-weight:800;display:inline-block;">${d}</div></td>`;
    return `<td style="text-align:center;padding:0 3px;"><div style="width:28px;height:28px;background:#1e293b;border-radius:50%;line-height:28px;text-align:center;font-size:11px;color:#475569;font-weight:600;display:inline-block;">${d}</div></td>`;
  }).join('');

  const html = baseLayout(`
    <!-- Title -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td>
          <h2 style="margin:0 0 4px;color:#f1f5f9;font-size:22px;font-weight:800;">Day ${opts.day} Picks Are Ready! 🎯</h2>
          <p style="margin:0;color:#64748b;font-size:13px;">${opts.date} &nbsp;·&nbsp; 3 Daily Odds Winning Strategy</p>
        </td>
      </tr>
    </table>

    <!-- Greeting -->
    <p style="margin:0 0 20px;color:#94a3b8;font-size:14px;line-height:1.6;">
      Hi <strong style="color:#f1f5f9;">${opts.subscriberName}</strong> 👋, here are your picks for today.
      Follow the plan, stay disciplined, and let compounding work for you.
    </p>

    <!-- Stats row -->
    <table width="100%" cellpadding="6" cellspacing="6" style="margin-bottom:24px;">
      <tr>
        ${statBox('Day', `${opts.day} of 7`, '#7c3aed')}
        ${statBox('Today\'s Stake', `KES ${opts.stake.toLocaleString()}`, '#10b981')}
        ${statBox('Combined Odds', `${opts.combinedOdds}×`, '#f59e0b')}
      </tr>
    </table>

    <!-- Pick cards -->
    <div style="margin-bottom:8px;">
      <p style="margin:0 0 14px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Today's Picks</p>
      ${pickCards}
    </div>

    <!-- Potential return banner -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border-radius:10px;overflow:hidden;background:#064e3b;">
      <tr>
        <td style="padding:20px;text-align:center;">
          <div style="color:#6ee7b7;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:8px;">💰 Potential Return If All Win</div>
          <div style="color:#fff;font-size:32px;font-weight:800;margin-bottom:4px;">KES ${opts.targetWin.toLocaleString()}</div>
          <div style="color:#a7f3d0;font-size:12px;">KES ${opts.stake.toLocaleString()} stake &times; ${opts.combinedOdds} combined odds</div>
        </td>
      </tr>
    </table>

    <!-- Week progress -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:14px;background:#0f172a;border-radius:8px;">
          <div style="color:#475569;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;text-align:center;">Week Progress</div>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>${dots}</tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="${BASE_URL}/3-daily-odds-strategy"
             style="display:inline-block;background:#10b981;color:#fff;font-weight:700;font-size:15px;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:-0.2px;">
            View Full Strategy &amp; Plan →
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:20px 0 0;color:#475569;font-size:11px;text-align:center;line-height:1.6;">
      These picks are for entertainment and educational purposes.<br/>
      Always bet within your means. Odds can change at kick-off.
    </p>
  `, `Day ${opts.day} picks: ${opts.picks.map(p => `${p.homeTeam} vs ${p.awayTeam}`).join(', ')}`);

  const pickLines = opts.picks.map(p =>
    `• ${p.homeTeam} vs ${p.awayTeam} — ${p.pick} (${p.market}) @ ${p.odds}`
  ).join('\n');

  const text = `Hi ${opts.subscriberName},\n\nDay ${opts.day} picks for 3 Daily Odds Strategy:\n\n${pickLines}\n\nCombined odds: ${opts.combinedOdds}\nStake: KES ${opts.stake.toLocaleString()} → Target: KES ${opts.targetWin.toLocaleString()}\n\nView: ${BASE_URL}/3-daily-odds-strategy\n\nBet responsibly. 18+ only.`;

  return {
    subject: `🎯 Day ${opts.day} Picks Ready — ${opts.combinedOdds}x odds — Betcheza`,
    html,
    text,
  };
}

// ─── Bookmaker Partnership Emails ────────────────────────────────────────────

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

function partnershipLayout(content: string, preheader = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Betcheza Partnership Proposal</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  ${preheader ? `<span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#7c3aed 100%);padding:32px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">⚽ Betcheza</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:13px;letter-spacing:0.5px;">PARTNERSHIP PROPOSAL · ${new Date().getFullYear()}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;color:#64748b;font-size:12px;line-height:1.7;">
                      <strong style="color:#334155;">Betcheza</strong> · Kenya's #1 Sports Betting Tipster Community<br/>
                      📧 <a href="mailto:ads@betcheza.co.ke" style="color:#7c3aed;text-decoration:none;">ads@betcheza.co.ke</a>
                      &nbsp;·&nbsp; 🌐 <a href="${BASE_URL}" style="color:#7c3aed;text-decoration:none;">betcheza.co.ke</a>
                    </p>
                  </td>
                  <td style="text-align:right;vertical-align:top;">
                    <p style="margin:0;color:#94a3b8;font-size:11px;">Confidential</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function statLight(label: string, value: string, color = '#7c3aed'): string {
  return `<td style="text-align:center;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
    <div style="color:${color};font-size:22px;font-weight:800;">${value}</div>
    <div style="color:#64748b;font-size:11px;margin-top:3px;text-transform:uppercase;letter-spacing:0.5px;">${label}</div>
  </td>`;
}

function featureList(items: string[]): string {
  return items.map(item => `
    <tr>
      <td style="padding:6px 0;">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:22px;vertical-align:top;padding-top:1px;">
              <div style="width:18px;height:18px;background:#10b981;border-radius:50%;text-align:center;line-height:18px;font-size:11px;color:#fff;font-weight:700;">✓</div>
            </td>
            <td style="padding-left:8px;color:#334155;font-size:13px;line-height:1.5;">${item}</td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');
}

export function bookmakerPartnershipEmail(opts: {
  bookmakerName: string;
  contactName?: string;
  tier: BookmakerTier;
  customNote?: string;
}): { subject: string; html: string; text: string } {
  const tier = TIER_DETAILS[opts.tier];
  const greeting = opts.contactName ? `Hi ${opts.contactName},` : `Hi ${opts.bookmakerName} Team,`;

  const html = partnershipLayout(`
    <!-- Greeting -->
    <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.7;">${greeting}</p>
    <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;font-weight:800;">Partner with Betcheza — Kenya's Fastest-Growing Betting Community</h2>
    <p style="margin:0 0 28px;color:#64748b;font-size:14px;line-height:1.7;">
      We are reaching out to offer <strong style="color:#0f172a;">${opts.bookmakerName}</strong> an exclusive advertising
      opportunity on <strong style="color:#7c3aed;">Betcheza.co.ke</strong> — Kenya's leading tipster platform where
      thousands of active sports bettors discover tips, compare odds, and place bets every day.
    </p>

    <!-- Traffic stats -->
    <div style="background:#0f172a;border-radius:10px;padding:24px;margin-bottom:28px;">
      <p style="margin:0 0 16px;color:#94a3b8;font-size:11px;text-align:center;text-transform:uppercase;letter-spacing:1px;">Our Audience — June 2026</p>
      <table width="100%" cellpadding="6" cellspacing="6">
        <tr>
          ${statLight('Monthly Visitors', '50,000+', '#10b981')}
          ${statLight('Registered Users', '5,000+', '#7c3aed')}
          ${statLight('Daily Active', '2,500+', '#f59e0b')}
          ${statLight('Email Subscribers', '1,200+', '#3b82f6')}
        </tr>
      </table>
    </div>

    <!-- Why Betcheza -->
    <h3 style="margin:0 0 12px;color:#0f172a;font-size:16px;font-weight:700;">Why Advertise on Betcheza?</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      ${featureList([
        '100% sports-betting audience — every visitor is actively betting or researching bets',
        'Kenya-first platform with dominant local reach including KPL fans',
        'AI-powered match predictions and tips drive daily return visits',
        'Integrated odds comparison — your odds appear directly in match listings',
        'Premium tipster community with subscription tiers and active engagement',
      ])}
    </table>

    <!-- Proposed package -->
    <div style="background:#faf5ff;border:2px solid #7c3aed;border-radius:10px;padding:24px;margin-bottom:28px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        <tr>
          <td>
            <h3 style="margin:0;color:#7c3aed;font-size:18px;font-weight:800;">${tier.title}</h3>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <div style="background:#7c3aed;color:#fff;font-size:13px;font-weight:700;padding:6px 14px;border-radius:20px;display:inline-block;">${tier.price}</div>
          </td>
        </tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${featureList(tier.features)}
      </table>
    </div>

    ${opts.customNote ? `
    <div style="background:#fff8e6;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:0 8px 8px 0;margin-bottom:28px;">
      <p style="margin:0;color:#78350f;font-size:13px;line-height:1.6;">${opts.customNote}</p>
    </div>` : ''}

    <!-- CTA -->
    <div style="background:#f8fafc;border-radius:10px;padding:24px;text-align:center;margin-bottom:8px;">
      <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;">
        Interested? Reply to this email or book a quick 15-minute call to discuss a custom package.
      </p>
      <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td style="padding-right:8px;">
            <a href="mailto:ads@betcheza.co.ke"
               style="display:inline-block;background:#7c3aed;color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;">
              Reply to Discuss →
            </a>
          </td>
          <td>
            <a href="${BASE_URL}/advertise"
               style="display:inline-block;background:#0f172a;color:#fff;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;">
              View Media Kit
            </a>
          </td>
        </tr>
      </table>
    </div>

    <p style="margin:20px 0 0;color:#94a3b8;font-size:12px;line-height:1.7;">
      This is a personalised proposal for <strong>${opts.bookmakerName}</strong>.
      Rates are negotiable for long-term or exclusive partnerships.
    </p>
  `, `Betcheza Partnership Proposal — ${tier.title}`);

  const featureText = tier.features.map(f => `  • ${f}`).join('\n');
  const text = `${greeting}\n\nPartner with Betcheza — Kenya's Fastest-Growing Betting Community\n\nWe'd like to offer ${opts.bookmakerName} an advertising opportunity on Betcheza.co.ke.\n\nOur audience:\n  • 50,000+ monthly visitors\n  • 5,000+ registered users\n  • 100% sports betting audience\n\n${tier.title} — ${tier.price}\n${featureText}\n\nReply to discuss: ads@betcheza.co.ke\nView more: ${BASE_URL}/advertise\n\nBest regards,\nThe Betcheza Team`;

  return {
    subject: `Partnership Opportunity — Advertise on Betcheza · ${opts.bookmakerName}`,
    html,
    text,
  };
}
