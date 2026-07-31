import { NextResponse } from 'next/server';
import { listAllComments, deleteComment } from '@/lib/feed-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const comments = await listAllComments(200);
  const stats = {
    total: comments.length,
    today: comments.filter(c => Date.now() - new Date(c.createdAt).getTime() < 86_400_000).length,
    week: comments.filter(c => Date.now() - new Date(c.createdAt).getTime() < 7 * 86_400_000).length,
  };
  return NextResponse.json({ comments, stats });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const ok = await deleteComment(id);
  return NextResponse.json({ ok });
}
