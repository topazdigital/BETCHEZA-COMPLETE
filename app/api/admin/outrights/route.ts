import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { clearOutrightCache, resetQuotaBackoff, isQuotaExhausted } from '@/lib/api/the-odds-api-outrights';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  return NextResponse.json({
    success: true,
    quotaExhausted: isQuotaExhausted(),
    message: isQuotaExhausted()
      ? 'Monthly quota exhausted. Use POST /api/admin/outrights to clear cache & reset backoff when quota refreshes.'
      : 'Outright odds feed is active.',
  });
}

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  const { action } = await req.json().catch(() => ({ action: 'refresh' }));

  if (action === 'reset-quota') {
    resetQuotaBackoff();
    clearOutrightCache();
    return NextResponse.json({ success: true, message: 'Quota backoff reset and outright cache cleared. Next page load will fetch live odds.' });
  }

  if (action === 'clear-cache') {
    clearOutrightCache();
    return NextResponse.json({ success: true, message: 'Outright cache cleared. Next page load will re-fetch from bookmaker API.' });
  }

  return NextResponse.json({ success: false, error: 'Unknown action. Use: reset-quota or clear-cache' }, { status: 400 });
}
