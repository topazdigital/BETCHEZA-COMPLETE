// Email body builder for the post-registration verification email.
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
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#10b981 0%,#0ea5e9 100%);padding:28px 32px;color:#fff;">
          <h1 style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.4px;">Confirm your email, ${displayName} 👋</h1>
          <p style="margin:6px 0 0;font-size:14px;opacity:0.9;">One quick step to finish setting up your Betcheza account.</p>
        </td></tr>
        <tr><td style="padding:28px 32px;color:#0f172a;">
          <p style="margin:0 0 14px;font-size:15px;line-height:1.55;">Use the code below in the app, or click the verify button to confirm in one tap.</p>
          <div style="margin:18px 0;text-align:center;">
            <div style="display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.5em;font-size:30px;font-weight:800;color:#0f172a;background:#f1f5f9;border:1px solid #e2e8f0;padding:14px 28px;border-radius:10px;">
              ${code}
            </div>
          </div>
          <p style="margin:0 0 22px;text-align:center;">
            <a href="${verifyUrl}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:9999px;font-size:14px;">Verify my email</a>
          </p>
          <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;text-align:center;">
            This code expires in 24 hours.<br/>
            If you didn't sign up for Betcheza, you can safely ignore this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { text, html };
}
