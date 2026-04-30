import { NextResponse } from 'next/server';
import { getBookmakerBySlug, buildAffiliateLink } from '@/lib/bookmakers-store';
import { recordClick } from '@/lib/affiliate-clicks-store';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function detectDevice(userAgent: string): 'mobile' | 'tablet' | 'desktop' | 'unknown' {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua)) return 'tablet';
  if (/iphone|ipod|android.*mobile|blackberry|iemobile|opera mini/.test(ua)) return 'mobile';
  return 'desktop';
}

/**
 * Affiliate click tracker.
 *
 * Hit /r/bookmaker/<slug>?placement=odds-table&sport=football&league=premier-league
 *      &matchId=123&match=Arsenal+vs+Chelsea&market=1x2&selection=home
 * We record the click context, then 302 to the affiliate URL (or the supplied
 * native deeplink). Admins can see what placements actually convert at
 * /admin/affiliate-clicks.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const url = new URL(request.url);

  const book = getBookmakerBySlug(slug);
  if (!book) {
    return NextResponse.json({ error: 'Unknown bookmaker' }, { status: 404 });
  }

  const nativeLink = url.searchParams.get('to') || undefined;
  const target =
    buildAffiliateLink(book.slug, nativeLink) ||
    book.affiliateUrl ||
    nativeLink ||
    null;

  if (!target) {
    return NextResponse.json({ error: 'No destination configured' }, { status: 500 });
  }

  // Pull context from query string (set by the link that sent the user here)
  const placement = url.searchParams.get('placement') || 'unknown';
  const sport = url.searchParams.get('sport') || undefined;
  const league = url.searchParams.get('league') || undefined;
  const matchId = url.searchParams.get('matchId') || undefined;
  const matchLabel = url.searchParams.get('match') || undefined;
  const market = url.searchParams.get('market') || undefined;
  const selection = url.searchParams.get('selection') || undefined;

  const ua = request.headers.get('user-agent') || '';
  const country =
    request.headers.get('x-vercel-ip-country') ||
    request.headers.get('cf-ipcountry') ||
    request.headers.get('x-country') ||
    undefined;
  const referer = request.headers.get('referer') || undefined;

  // Best-effort user attribution — never block the redirect on this.
  let userId: number | undefined;
  try {
    const u = await getCurrentUser();
    if (u?.userId) userId = u.userId;
  } catch { /* ignore */ }

  let recordedClickId: number | undefined;
  try {
    const click = recordClick({
      bookmakerId: book.id,
      bookmakerSlug: book.slug,
      bookmakerName: book.name,
      placement,
      sport,
      league,
      matchId,
      matchLabel,
      market,
      selection,
      userId,
      country: country || undefined,
      device: detectDevice(ua),
      referer,
    });
    recordedClickId = click.id;
  } catch (e) {
    console.error('[affiliate-clicks] record failed:', e);
  }

  // Drop a 30-day attribution cookie so any signup/deposit that
  // happens later from this device rolls back into the bookmaker
  // funnel. Using a Response object lets us set the cookie and the
  // 302 redirect at the same time.
  const res = NextResponse.redirect(target, 302);
  try {
    const cookieValue = JSON.stringify({
      bid: book.id,
      slug: book.slug,
      name: book.name,
      cid: recordedClickId,
      ts: Date.now(),
    });
    res.cookies.set({
      name: 'bz_aff',
      value: cookieValue,
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
      sameSite: 'lax',
      httpOnly: false, // readable by client analytics if needed
    });
  } catch { /* never block redirect on cookie failures */ }
  return res;
}
