import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getLikeCount, likeTip, unlikeTip } from '@/lib/tip-engagement-store';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const result = await getLikeCount(id, user?.userId ?? null);
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to like tips.' }, { status: 401 });
  const result = await likeTip(id, user.userId);
  return NextResponse.json({ ok: true, ...result });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const result = await unlikeTip(id, user.userId);
  return NextResponse.json({ ok: true, ...result });
}
