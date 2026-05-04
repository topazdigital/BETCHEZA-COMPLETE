import { NextRequest, NextResponse } from 'next/server';
import {
  getJackpots,
  getActiveJackpots,
  getActiveJackpotsByBookmaker,
  createJackpot,
  updateJackpot,
  deleteJackpot,
  getJackpotById,
} from '@/lib/jackpot-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('active') === 'true';
    const bookmaker = searchParams.get('bookmaker') || undefined;
    const byBookmaker = searchParams.get('byBookmaker') === 'true';
    const id = searchParams.get('id');

    if (id) {
      const jackpot = getJackpotById(id);
      if (!jackpot) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ jackpot });
    }

    if (byBookmaker) {
      const grouped = getActiveJackpotsByBookmaker();
      return NextResponse.json({ byBookmaker: grouped });
    }

    const jackpots = activeOnly ? getActiveJackpots(bookmaker) : getJackpots();
    return NextResponse.json({ jackpots });
  } catch (e) {
    console.error('[api/jackpot] GET error:', e);
    return NextResponse.json({ error: 'Internal error', jackpots: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const jackpot = createJackpot(body);
    return NextResponse.json({ jackpot }, { status: 201 });
  } catch (e) {
    console.error('[api/jackpot] POST error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...patch } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const updated = updateJackpot(id, patch);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ jackpot: updated });
  } catch (e) {
    console.error('[api/jackpot] PUT error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const ok = deleteJackpot(id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[api/jackpot] DELETE error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
