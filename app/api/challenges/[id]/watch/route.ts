import { NextRequest, NextResponse } from 'next/server';
import { incrementWatchers } from '@/lib/challenges-store';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await incrementWatchers(Number(id));
  return NextResponse.json({ ok: true });
}
