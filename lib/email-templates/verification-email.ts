const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke').replace(/\/+$/, '');
const LOGO_URL = `${BASE_URL}/betcheza-logo.png`;

export function buildVerificationEmail(opts: {
  displayName: string;
  code: string;
  verifyUrl: string;
}) {
  const { displayName, code, verifyUrl } = opts;

  const text = `Welcome to Betcheza, ${displayName}!

Confirm your email so you can secure your account, get tip alerts and follow tipsters.

Your verification code: ${code}

Or just open this link to verify automatically:
${verifyUrl}

This code expires in 24 hours. If you didn't sign up for Betcheza, you can safely ignore this email.

— Team Betcheza`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirm your Betcheza account</title>
</head>
<body data-betcheza-email="branded" style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Confirm your email to start receiving tips and predictions — Betcheza</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.12);">

        <!-- ── HEADER ─────────────────────────────────────────── -->
        <tr>
          <td style="background:linear-gradient(135deg,#0f172a 0%,#1565c0 70%,#1d4ed8 100%);padding:36px 32px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:middle;padding-right:12px;">
                          <img src="${LOGO_URL}" width="44" height="44" alt="Betcheza" style="display:block;width:44px;height:44px;border:0;border-radius:50%;" />
                      </td>
                      <td style="vertical-align:middle;">
                        <div style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.3px;line-height:1;">Betcheza</div>
                        <div style="color:rgba(255,255,255,0.7);font-size:10px;letter-spacing:1px;text-transform:uppercase;margin-top:2px;">Kenya's #1 Tipster Community</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding-top:22px;">
                  <h1 style="margin:0 0 6px;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.4px;">Confirm your email, ${displayName} 👋</h1>
                  <p style="margin:0;color:rgba(255,255,255,0.78);font-size:14px;line-height:1.5;">One step away from tips, predictions &amp; more.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── ACCENT LINE ────────────────────────────────────── -->
        <tr>
          <td style="height:3px;background:linear-gradient(90deg,#f59e0b 0%,#1565c0 50%,#64b5f6 100%);"></td>
        </tr>

        <!-- ── BODY ───────────────────────────────────────────── -->
        <tr>
          <td style="background:#ffffff;padding:40px 36px 32px;">

            <p style="margin:0 0 24px;color:#334155;font-size:15px;line-height:1.65;">
              Enter the code below in the app, or tap the button to verify in one click.
            </p>

            <!-- OTP box -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <div style="display:inline-block;background:#f8fafc;border:2px solid #e2e8f0;border-radius:14px;padding:20px 40px;">
                    <div style="color:#64748b;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;">Your verification code</div>
                    <div style="font-family:ui-monospace,SFMono-Regular,Menlo,'Courier New',monospace;font-size:36px;font-weight:900;color:#0f172a;letter-spacing:0.45em;line-height:1;">${code}</div>
                    <div style="color:#94a3b8;font-size:11px;margin-top:10px;">Expires in 24 hours</div>
                  </div>
                </td>
              </tr>
            </table>

            <!-- Divider -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="border-top:1px solid #e2e8f0;width:44%;"></td>
                <td style="text-align:center;width:12%;color:#94a3b8;font-size:12px;padding:0 8px;white-space:nowrap;">or</td>
                <td style="border-top:1px solid #e2e8f0;width:44%;"></td>
              </tr>
            </table>

            <!-- CTA -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
              <tr>
                  <td style="background:#1565c0;border-radius:10px;">
                  <a href="${verifyUrl}" style="display:inline-block;padding:15px 40px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;letter-spacing:-0.2px;">✓ &nbsp;Verify my email</a>
                </td>
              </tr>
            </table>

            <!-- Security note -->
            <div style="background:#fafafa;border:1px solid #f1f5f9;border-radius:10px;padding:16px 20px;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
                🔒 &nbsp;If you didn't create a Betcheza account, you can safely ignore this email.<br/>
                Never share this code with anyone.
              </p>
            </div>

          </td>
        </tr>

        <!-- ── FOOTER ─────────────────────────────────────────── -->
        <tr>
          <td style="background:#0f172a;padding:24px 32px;text-align:center;">
            <p style="margin:0 0 6px;color:rgba(255,255,255,0.5);font-size:12px;">
              <a href="${BASE_URL}" style="color:#64b5f6;text-decoration:none;font-weight:600;">betcheza.co.ke</a>
              &nbsp;·&nbsp;
              <a href="mailto:support@betcheza.co.ke" style="color:rgba(255,255,255,0.4);text-decoration:none;">support@betcheza.co.ke</a>
            </p>
            <p style="margin:0;color:rgba(255,255,255,0.25);font-size:11px;">
              © ${new Date().getFullYear()} Betcheza &nbsp;·&nbsp; Bet responsibly &nbsp;·&nbsp; 18+ only
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;

  return { text, html };
}
