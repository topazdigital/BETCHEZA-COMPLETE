import { NextResponse } from 'next/server'
import { generateMathChallenge, getPublicCaptchaConfig, rememberMathAnswer } from '@/lib/captcha'

export const dynamic = 'force-dynamic'

// GET /api/captcha/challenge
// Returns the captcha widget config the auth modal should render plus, when
// using the math fallback, a fresh question. The answer is stored server-side
// keyed by `id`; the client posts it back as `captchaToken` + `captchaId`
// during login/signup.
export async function GET() {
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
