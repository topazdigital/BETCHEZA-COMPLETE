import { NextRequest, NextResponse } from 'next/server';
import { recordOpen, recordClick } from '@/lib/ad-analytics';

// 1×1 transparent GIF — returned for open-tracking pixels
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id   = searchParams.get('id') ?? '';
  const type = searchParams.get('t') ?? 'open';
  const dest = searchParams.get('url') ?? '';

  if (!id) {
    return new NextResponse(null, { status: 400 });
  }

  if (type === 'open') {
    recordOpen(id);
    return new NextResponse(PIXEL, {
      status: 200,
      headers: {
        'Content-Type':  'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma':        'no-cache',
      },
    });
  }

  if (type === 'click') {
    recordClick(id);
    const target = dest ? decodeURIComponent(dest) : 'https://betcheza.co.ke/partner';
    return NextResponse.redirect(target, 302);
  }

  return new NextResponse(null, { status: 400 });
}
