import { NextRequest, NextResponse } from 'next/server'
import { generateMathChallenge, getPublicCaptchaConfig, rememberMathAnswer } from '@/lib/captcha'

export const dynamic = 'force-dynamic'

// GET /api/captcha/challenge
// Returns the captcha widget config the auth modal should render plus, when
// using the math fallback, a fresh question. The answer is stored server-side
// keyed by `id`; the client posts it back as `captchaToken` + `captchaId`
// during login/signup.
//
// Pass ?math=1 to force a math challenge (used when Turnstile/reCAPTCHA fails
// to load — e.g. network error, domain mismatch, browser extension blocking).
export async function GET(req: NextRequest) {
  const forceMath = req.nextUrl.searchParams.get('math') === '1'

  if (forceMath) {
    const c = generateMathChallenge()
    rememberMathAnswer(c.id, c.answer)
    return NextResponse.json({
      provider: 'math',
      siteKey: null,
      math: { id: c.id, question: c.question },
    })
  }

  const cfg = await getPublicCaptchaConfig()
  if (cfg.provider === 'math') {
    const c = generateMathChallenge()
    rememberMathAnswer(c.id, c.answer)
    return NextResponse.json({
      provider: cfg.provider,
      siteKey: null,
      math: { id: c.id, question: c.question },
    })
  }
  return NextResponse.json({
    provider: cfg.provider,
    siteKey: cfg.siteKey,
    math: null,
  })
}
