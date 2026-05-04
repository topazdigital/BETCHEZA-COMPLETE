export interface JackpotAlertEmailOptions {
  bookmakerName: string;
  bookmakerColor: string;
  jackpotTitle: string;
  jackpotAmount?: string;
  currency?: string;
  deadline: string;
  gamesCount: number;
  topPicks: Array<{ home: string; away: string; pick: string }>;
  jackpotUrl: string;
  unsubscribeUrl: string;
  appUrl: string;
}

export function buildJackpotAlertEmail(opts: JackpotAlertEmailOptions) {
  const { bookmakerName, bookmakerColor, jackpotTitle, jackpotAmount, currency, deadline, gamesCount, topPicks, jackpotUrl, unsubscribeUrl, appUrl } = opts;
  const deadlineStr = new Date(deadline).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
  const amount = jackpotAmount ? `${currency || "KES"} ${jackpotAmount}` : "";
  const picksHtml = topPicks.slice(0, 5).map((p, i) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#555;font-size:13px;">${i+1}. ${p.home} vs ${p.away}</td><td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;"><span style="background:${bookmakerColor};color:#fff;padding:2px 10px;border-radius:12px;font-weight:700;font-size:13px;">${p.pick}</span></td></tr>`
  ).join("");
  const subject = `🏆 ${bookmakerName} Jackpot Tips — ${amount ? amount + " up for grabs!" : "Predictions ready!"}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
<tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);max-width:600px;width:100%;">
<tr><td style="background:${bookmakerColor};padding:28px 32px;text-align:center;">
<h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">🏆 ${bookmakerName} Jackpot Alert</h1>
${amount ? `<p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:28px;font-weight:900;">${amount}</p>` : ""}
<p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Deadline: ${deadlineStr}</p>
</td></tr>
<tr><td style="padding:24px 32px;">
<p style="color:#333;font-size:15px;margin:0 0 16px;">Our AI has analysed all <strong>${gamesCount} games</strong> in <strong>${jackpotTitle}</strong>. Here are the top picks:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;">
<thead><tr style="background:#f8f8f8;"><th style="padding:10px 12px;text-align:left;font-size:12px;color:#999;font-weight:600;text-transform:uppercase;">Match</th><th style="padding:10px 12px;text-align:center;font-size:12px;color:#999;font-weight:600;text-transform:uppercase;">Pick</th></tr></thead>
<tbody>${picksHtml}</tbody>
</table>
<div style="text-align:center;margin:24px 0;">
<a href="${jackpotUrl}" style="background:${bookmakerColor};color:#fff;text-decoration:none;padding:13px 32px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;">View Full Predictions →</a>
</div>
<p style="color:#888;font-size:12px;text-align:center;margin:0;">You're receiving this because you subscribed to jackpot alerts on <a href="${appUrl}" style="color:${bookmakerColor};">Betcheza</a>.<br><a href="${appUrl}${unsubscribeUrl}" style="color:#aaa;">Unsubscribe</a></p>
</td></tr>
</table></td></tr>
</table></body></html>`;
  const text = `${bookmakerName} Jackpot Alert\n${amount}\nDeadline: ${deadlineStr}\n\nTop Picks:\n${topPicks.slice(0,5).map((p,i)=>`${i+1}. ${p.home} vs ${p.away} → ${p.pick}`).join("\n")}\n\nFull predictions: ${jackpotUrl}\nUnsubscribe: ${appUrl}${unsubscribeUrl}`;
  return { subject, html, text };
}
