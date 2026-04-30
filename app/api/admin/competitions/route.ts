import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  addCompetition,
  updateCompetition,
  deleteCompetition,
  getCompetitions,
  type NewCompetitionInput,
} from '@/lib/competitions-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // Full payload (admin sees everything including participant details)
  return NextResponse.json({ competitions: getCompetitions() });
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let body: Partial<NewCompetitionInput> = {};
  try { body = await req.json(); } catch {}
  if (!body.name || !body.startDate || !body.endDate) {
    return NextResponse.json(
      { error: 'name, startDate, and endDate are required.' },
      { status: 400 },
    );
  }
  const comp = addCompetition({
    name: String(body.name),
    description: String(body.description || ''),
    type: (body.type as NewCompetitionInput['type']) || 'weekly',
    status: body.status,
    startDate: String(body.startDate),
    endDate: String(body.endDate),
    prizePool: Number(body.prizePool || 0),
    currency: body.currency || 'KES',
    entryFee: Number(body.entryFee || 0),
    maxParticipants: Number(body.maxParticipants || 100),
    prizes: body.prizes,
    rules: body.rules,
    sportFocus: String(body.sportFocus || 'multi-sport'),
  });
  return NextResponse.json({ success: true, competition: comp });
}

export async function PATCH(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  let body: { id?: number } & Partial<NewCompetitionInput> = {};
  try { body = await req.json(); } catch {}
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const updated = updateCompetition(Number(body.id), body);
  if (!updated) {
    return NextResponse.json(
      { error: 'Competition not found or is a built-in (not editable).' },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true, competition: updated });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = Number(req.nextUrl.searchParams.get('id') || 0);
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const ok = deleteCompetition(id);
  if (!ok) {
    return NextResponse.json(
      { error: 'Competition not found or is a built-in (cannot be deleted).' },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true });
}
