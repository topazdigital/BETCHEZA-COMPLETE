import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requireAdmin } from '@/lib/admin-auth';
import { hasPermission } from '@/lib/permissions';
import {
  deleteBookmaker,
  getBookmakerById,
  upsertBookmaker,
  type BookmakerRow,
} from '@/lib/bookmakers-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Ctx { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const me = await getCurrentUser();
  if (!me || !hasPermission(me.role, 'admin.settings.write')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await ctx.params;
  const numId = Number(id);
  const existing = getBookmakerById(numId);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = await request.json().catch(() => ({})) as Partial<BookmakerRow>;
  const merged = upsertBookmaker({
    ...existing,
    ...body,
    id: numId,
    name: body.name ?? existing.name,
    slug: body.slug ?? existing.slug,
    affiliateUrl: body.affiliateUrl ?? existing.affiliateUrl,
  });
  return NextResponse.json({ bookmaker: merged });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const me = await getCurrentUser();
  if (!me || !hasPermission(me.role, 'admin.settings.write')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id } = await ctx.params;
  const ok = deleteBookmaker(Number(id));
  return NextResponse.json({ success: ok });
}
