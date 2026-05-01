import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { hasPermission } from '@/lib/permissions';
import {
  listAllBookmakers,
  upsertBookmaker,
  type BookmakerRow,
} from '@/lib/bookmakers-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const me = await getCurrentUser();
  if (!me || !hasPermission(me.role, 'admin.access')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return NextResponse.json({ bookmakers: listAllBookmakers() });
}

export async function POST(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !hasPermission(me.role, 'admin.settings.write')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const body = await request.json().catch(() => null) as Partial<BookmakerRow> | null;
  if (!body?.name || !body?.slug || !body?.affiliateUrl) {
    return NextResponse.json(
      { error: 'name, slug and affiliateUrl are required' },
      { status: 400 },
    );
  }
  const row = upsertBookmaker({
    ...body,
    name: body.name,
    slug: body.slug,
    affiliateUrl: body.affiliateUrl,
  });
  return NextResponse.json({ bookmaker: row });
}
