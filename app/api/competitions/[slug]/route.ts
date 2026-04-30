import { NextRequest, NextResponse } from 'next/server';
import { getCompetitionBySlug, getCompetitionById } from '@/lib/competitions-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const idNum = Number(slug);
  const comp = (Number.isFinite(idNum) && idNum > 0)
    ? getCompetitionById(idNum) ?? getCompetitionBySlug(slug)
    : getCompetitionBySlug(slug);
  if (!comp) {
    return NextResponse.json({ success: false, error: 'Competition not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, competition: comp });
}
