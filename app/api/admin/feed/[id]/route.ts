import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requireAdmin } from '@/lib/admin-auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const role = (user as unknown as { role?: string } | null)?.role;
  if (!user || (role && role !== 'admin' && role !== 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  if (process.env.DATABASE_URL) {
    try {
      await query(`DELETE FROM feed_post_likes WHERE post_id = $1`, [id]);
      await query(`DELETE FROM feed_comments WHERE post_id = $1`, [id]);
      await query(`DELETE FROM feed_posts WHERE id = $1`, [id]);
    } catch (e) { console.warn('[admin feed] delete failed', e); }
  }
  const g = globalThis as { __feedStore?: { posts: Map<string, unknown>; comments: Map<string, unknown[]>; likes: Map<string, Set<number>> } };
  if (g.__feedStore) {
    g.__feedStore.posts.delete(id);
    g.__feedStore.comments.delete(id);
    g.__feedStore.likes.delete(id);
  }
  return NextResponse.json({ success: true });
}
