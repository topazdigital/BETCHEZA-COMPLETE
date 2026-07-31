import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, isAdmin } from '@/lib/auth';
import { getHistory, deleteEntry } from '@/lib/advertising-log';

export async function GET(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !isAdmin(me.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '100', 10);
  return NextResponse.json({ history: getHistory(limit) });
}

export async function DELETE(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me || !isAdmin(me.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const ok = deleteEntry(id);
  return NextResponse.json({ success: ok });
}
