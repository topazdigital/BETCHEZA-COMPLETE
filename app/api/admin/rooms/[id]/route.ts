import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/permissions';
import { upsertRoom, deleteRoom } from '@/lib/feed-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canAccessAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    name?: string; slug?: string; description?: string | null;
    icon?: string | null; color?: string | null; sortOrder?: number; isActive?: boolean;
  } | null;
  if (!body?.name || !body?.slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
  }
  await upsertRoom({ id: Number(id), name: body.name, slug: body.slug, description: body.description, icon: body.icon, color: body.color, sortOrder: body.sortOrder, isActive: body.isActive });
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canAccessAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  await deleteRoom(Number(id));
  return NextResponse.json({ success: true });
}
