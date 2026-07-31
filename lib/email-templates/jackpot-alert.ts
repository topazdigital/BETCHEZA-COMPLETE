const BASE_URL_FALLBACK = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';

export interface JackpotAlertEmailOptions {
  bookmakerName: string; bookmakerColor: string; jackpotTitle: string;
  jackpotAmount?: string; currency?: string; deadline: string; gamesCount: number;
  topPicks: Array<{ home: string; away: string; pick: string }>;
  jackpotUrl: string; unsubscribeUrl: string; appUrl: string;
}

export function buildJackpotAlertEmail(opts: JackpotAlertEmailOptions) {
  const {
    bookmakerName, bookmakerColor, jackpotTitle, jackpotAmount,
    currency, deadline, gamesCount, topPicks, jackpotUrl, unsubscribeUrl, appUrl,
  } = opts;

  const deadlineStr = new Date(deadline).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
  const amount = jackpotAmount ? `${currency || 'KES'} ${jackpotAmount}` : '';
  const siteUrl = appUrl || BASE_URL_FALLBACK;

  const picksHtml = topPicks.slice(0, 5).map((p, i) => `
    <tr>
      <td style="padding:0;border-bottom:1px solid #f1f5f9;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:13px 16px;width:28px;color:#94a3b8;font-size:13px;font-weight:700;">${i + 1}</td>
            <td style="padding:13px 0;">
              <div style="color:#1e293b;font-size:13px;font-weight:600;">${p.home} <span style="color:#94a3b8;font-weight:400;">vs</span> ${p.away}</div>
            </td>
            <td style="padding:13px 16px;text-align:right;">
              <span style="display:inline-block;background:${bookmakerColor};color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;white-space:nowrap;">${p.pick}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  const subject = `🏆 ${bookmakerName} Jackpot Tips — ${amount ? amount + ' up for grabs!' : 'Predictions ready!'}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${bookmakerName} Jackpot Alert — Betcheza</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">🏆 ${bookmakerName} jackpot tips are ready — ${amount || 'huge prize pool'}. Check the top AI picks now.</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.12);">

        <!-- ── BETCHEZA TOP BAR ──────────────────────────────── -->
        <tr>
          <td style="background:#0f172a;padding:14px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="color:#ffffff;font-size:14px;font-weight:800;">⚽ Betcheza</span>
                  <span style="color:#475569;font-size:12px;margin-left:8px;">Expert Sports Predictions</span>
                </td>
                <td style="text-align:right;">
                  <a href="${siteUrl}" style="color:#10b981;font-size:11px;text-decoration:none;font-weight:600;">Visit site →</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── BOOKMAKER HEADER ──────────────────────────────── -->
        <tr>
          <td style="background:${bookmakerColor};padding:36px 32px;text-align:center;">
            <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px;margin-bottom:14px;">🏆</div>
            <h1 style="margin:0 0 8px;color:#ffffff;font-size:26px;font-weight:900;letter-spacing:-0.5px;">${bookmakerName} Jackpot Alert</h1>
            ${amount ? `<div style="color:rgba(255,255,255,0.95);font-size:32px;font-weight:900;letter-spacing:-0.5px;margin:8px 0 4px;">${amount}</div>` : ''}
            <div style="display:inline-block;background:rgba(0,0,0,0.18);border-radius:20px;padding:6px 18px;margin-top:4px;">
              <span style="color:rgba(255,255,255,0.9);font-size:12px;font-weight:600;">⏰ Deadline: ${deadlineStr}</span>
            </div>
          </td>
        </tr>

        <!-- ── ACCENT LINE ────────────────────────────────────── -->
        <tr>
          <td style="height:3px;background:linear-gradient(90deg,#f59e0b 0%,${bookmakerColor} 50%,#10b981 100%);"></td>
        </tr>

        <!-- ── BODY ───────────────────────────────────────────── -->
        <tr>
          <td style="background:#ffffff;padding:36px 32px;">

            <!-- Intro -->
            <p style="margin:0 0 24px;color:#334155;font-size:15px;line-height:1.65;">
              Our AI has analysed all <strong style="color:#0f172a;">${gamesCount} games</strong> in the <strong style="color:#0f172a;">${jackpotTitle}</strong> and selected the top picks most likely to deliver a jackpot win. Here are today's predictions:
            </p>

            <!-- Picks table label -->
            <p style="margin:0 0 12px;color:#94a3b8;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Top Picks</p>

            <!-- Picks list -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:32px;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:10px 16px;text-align:left;font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;width:28px;">#</th>
                  <th style="padding:10px 0;text-align:left;font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Match</th>
                  <th style="padding:10px 16px;text-align:right;font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Pick</th>
                </tr>
              </thead>
              <tbody>${picksHtml}</tbody>
            </table>

            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
              <tr>
                <td style="background:${bookmakerColor};border-radius:10px;">
                  <a href="${jackpotUrl}" style="display:inline-block;padding:15px 36px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:-0.2px;">View Full Predictions →</a>
                </td>
              </tr>
            </table>

            <!-- Disclaimer -->
            <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center;line-height:1.7;">
              These picks are AI-generated for entertainment purposes only.<br/>
              Always bet responsibly. 18+ only. Odds can change at kick-off.
            </p>

          </td>
        </tr>

        <!-- ── FOOTER ─────────────────────────────────────────── -->
        <tr>
          <td style="background:#0f172a;padding:24px 32px;text-align:center;">
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:12px;line-height:1.6;">
              You received this because you subscribed to jackpot alerts on
              <a href="${siteUrl}" style="color:#10b981;text-decoration:none;font-weight:600;">Betcheza</a>.
            </p>
            <p style="margin:0;font-size:11px;">
              <a href="${siteUrl}${unsubscribeUrl}" style="color:rgba(255,255,255,0.3);text-decoration:none;">Unsubscribe</a>
              &nbsp;·&nbsp;
              <a href="mailto:support@betcheza.co.ke" style="color:rgba(255,255,255,0.3);text-decoration:none;">support@betcheza.co.ke</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;

  const text = `${bookmakerName} Jackpot Alert\n${amount ? amount + '\n' : ''}Deadline: ${deadlineStr}\n\nTop Picks:\n${topPicks.slice(0, 5).map((p, i) => `${i + 1}. ${p.home} vs ${p.away} → ${p.pick}`).join('\n')}\n\nFull predictions: ${jackpotUrl}\n\nBet responsibly. 18+ only.\nUnsubscribe: ${siteUrl}${unsubscribeUrl}`;

  return { subject, html, text };
}
