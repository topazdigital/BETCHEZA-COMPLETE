import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listAllRoomsAdmin, upsertRoom } from '@/lib/feed-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isAdmin(role?: string) {
  return role === 'admin' || role === 'super_admin';
}

export async function GET() {
  const user = await getCurrentUser();
  const role = (user as unknown as { role?: string } | null)?.role;
  if (!user || !isAdmin(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const rooms = await listAllRoomsAdmin();
  return NextResponse.json({ rooms });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const role = (user as unknown as { role?: string } | null)?.role;
  if (!user || !isAdmin(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json().catch(() => null) as {
    name?: string; slug?: string; description?: string | null;
    icon?: string | null; color?: string | null; sortOrder?: number;
  } | null;
  if (!body?.name || !body?.slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
  }
  await upsertRoom({ name: body.name, slug: body.slug, description: body.description, icon: body.icon, color: body.color, sortOrder: body.sortOrder });
  return NextResponse.json({ success: true });
}
