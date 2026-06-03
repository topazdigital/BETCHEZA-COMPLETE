import { NextRequest, NextResponse } from 'next/server';
import { getBanners, saveBanners, Banner } from '@/lib/banner-store';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const banners = await getBanners();
  return NextResponse.json(banners);
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'Expected array' }, { status: 400 });
  }
  await saveBanners(body as Banner[]);
  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const banners = await getBanners();
  const newBanner: Banner = {
    id: `banner-${Date.now()}`,
    title: body.title || 'New Banner',
    description: body.description || '',
    imageUrl: body.imageUrl || '',
    linkUrl: body.linkUrl || '/',
    active: body.active ?? true,
    section: body.section || 'general',
    position: body.position || 'both',
    order: banners.length,
    gradient: body.gradient || 'from-blue-600 to-indigo-700',
    ctaText: body.ctaText || 'Learn More',
  };
  banners.push(newBanner);
  await saveBanners(banners);
  return NextResponse.json(newBanner, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const banners = await getBanners();
  await saveBanners(banners.filter((b) => b.id !== id));
  return NextResponse.json({ success: true });
}
