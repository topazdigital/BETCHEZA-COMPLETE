import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listStaticPages, saveStaticPage, STATIC_PAGE_SLUGS } from '@/lib/static-pages-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const pages = await listStaticPages();
  return NextResponse.json({ pages });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body?.slug || !body?.title || !body?.body) {
    return NextResponse.json({ error: 'slug, title and body required' }, { status: 400 });
  }
  if (!STATIC_PAGE_SLUGS.includes(body.slug)) {
    return NextResponse.json({ error: 'Invalid slug' }, { status: 400 });
  }
  const saved = await saveStaticPage({
    slug: body.slug,
    title: String(body.title).slice(0, 255),
    body: String(body.body),
    meta_description: body.meta_description ? String(body.meta_description).slice(0, 500) : undefined,
  });
  return NextResponse.json({ success: true, page: saved });
}
