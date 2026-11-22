const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://betcheza.co.ke'
).replace(/\/+$/, '');

const LOGO_URL = `${SITE_URL}/betcheza-logo.png`;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

function responsiveStyles(): string {
  return `<style type="text/css">
    img { max-width: 100%; height: auto; }
    @media only screen and (max-width: 620px) {
      body { width: 100% !important; min-width: 0 !important; margin: 0 !important; }
      .betcheza-email-canvas { padding: 12px 6px !important; }
      .betcheza-email-card { width: 100% !important; max-width: 100% !important; border-radius: 10px !important; }
      .betcheza-email-header { padding: 16px 18px !important; }
      .betcheza-email-content { padding: 20px 16px !important; }
      .betcheza-email-footer { padding: 18px 16px !important; }
      .betcheza-email-content img { width: auto !important; max-width: 100% !important; height: auto !important; }
      table[width="600"], table[width="620"], table[width="640"] {
        width: 100% !important;
        max-width: 100% !important;
      }
      .betcheza-email-content table[width="600"],
      .betcheza-email-content table[width="620"],
      .betcheza-email-content table[width="640"] {
        width: 100% !important;
        max-width: 100% !important;
      }
      .betcheza-stat-row { display: block !important; width: 100% !important; }
      .betcheza-stat-row tbody, .betcheza-stat-row tr {
        display: block !important;
        width: 100% !important;
      }
      .betcheza-stat-cell {
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
        margin: 0 0 8px !important;
      }
      .betcheza-stat-spacer { display: none !important; }
      .betcheza-email-content a { overflow-wrap: anywhere; }
      .betcheza-email-content pre { white-space: pre-wrap !important; overflow-wrap: anywhere !important; }
      td[style*="padding:40px"], td[style*="padding: 40px"],
      td[style*="padding:36px"], td[style*="padding: 36px"],
      td[style*="padding:32px"], td[style*="padding: 32px"] {
        padding-left: 18px !important;
        padding-right: 18px !important;
      }
    }
  </style>`;
}

function addResponsiveSupport(html: string): string {
  const viewport = '<meta name="viewport" content="width=device-width, initial-scale=1.0" />';
  let result = html;

  if (!/<meta\b[^>]*name=["']viewport["']/i.test(result)) {
    if (/<head\b[^>]*>/i.test(result)) {
      result = result.replace(/(<head\b[^>]*>)/i, `$1\n${viewport}`);
    } else if (/<html\b[^>]*>/i.test(result)) {
      result = result.replace(/(<html\b[^>]*>)/i, `$1\n<head>${viewport}</head>`);
    }
  }

  if (/<\/head>/i.test(result)) {
    return result.replace(/<\/head>/i, `${responsiveStyles()}\n</head>`);
  }
  if (/<body\b[^>]*>/i.test(result)) {
    return result.replace(/<body\b[^>]*>/i, `$&\n${responsiveStyles()}`);
  }
  return result;
}

function extractEmailContent(html: string): { content: string; styles: string } {
  const styles = [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)]
    .map((match) => match[0])
    .join('\n');
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  const content = (body ?? html)
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<\/?html\b[^>]*>/gi, '')
    .replace(/<\/?body\b[^>]*>/gi, '')
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .trim();
  return { content, styles };
}

/**
 * Wraps plain email fragments in an email-client-safe Betcheza layout.
 * Full Betcheza templates that already use the official logo keep their own
 * layout, but still receive viewport and mobile-sizing rules.
 */
export function brandEmailHtml(subject: string, html?: string, text?: string): string {
  const source = html?.trim() || '';
  const isFullBrandedDocument =
    /<html\b/i.test(source) &&
    (/data-betcheza-email=["']branded["']/i.test(source) ||
      /betcheza-logo\.png/i.test(source));

  if (isFullBrandedDocument) return addResponsiveSupport(source);

  const { content: originalContent, styles } = extractEmailContent(source);
  const content = originalContent || escapeHtml(text || '').replace(/\r?\n/g, '<br />');
  const escapedSubject = escapeHtml(subject);
  const escapedSiteUrl = escapeHtml(SITE_URL);
  const escapedLogoUrl = escapeHtml(LOGO_URL);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapedSubject}</title>
  ${styles}
  ${responsiveStyles()}
</head>
<body data-betcheza-email="branded" style="margin:0;padding:0;width:100%;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapedSubject}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f1f5f9;">
    <tr>
      <td class="betcheza-email-canvas" align="center" style="padding:28px 12px;">
        <table class="betcheza-email-card" role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
          <tr>
            <td class="betcheza-email-header" style="padding:20px 28px;background:#0f172a;border-bottom:4px solid #1565c0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    <img src="${escapedLogoUrl}" width="42" height="42" alt="Betcheza" style="display:block;width:42px;height:42px;border:0;border-radius:50%;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <a href="${escapedSiteUrl}" style="color:#ffffff;font-size:20px;font-weight:800;line-height:1.2;text-decoration:none;">Betcheza</a>
                    <div style="margin-top:3px;color:#bfdbfe;font-size:10px;letter-spacing:1px;text-transform:uppercase;">Smart · Bets · Daily</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="betcheza-email-content" style="padding:30px 32px;background:#ffffff;color:#0f172a;overflow-wrap:anywhere;">
              <div class="betcheza-email-message" style="font-size:15px;line-height:1.6;">
                ${content}
              </div>
            </td>
          </tr>
          <tr>
            <td class="betcheza-email-footer" style="padding:20px 28px;background:#0f172a;text-align:center;">
              <p style="margin:0 0 6px;color:#cbd5e1;font-size:12px;line-height:1.6;">
                <a href="${escapedSiteUrl}" style="color:#64b5f6;font-weight:700;text-decoration:none;">betcheza.co.ke</a>
                &nbsp;·&nbsp;
                <a href="mailto:support@betcheza.co.ke" style="color:#cbd5e1;text-decoration:none;">support@betcheza.co.ke</a>
              </p>
              <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5;">
                © ${new Date().getFullYear()} Betcheza · Bet responsibly · 18+ only
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
