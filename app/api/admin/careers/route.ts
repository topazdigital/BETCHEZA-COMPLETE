import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { getCurrentUser, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.role)) return null;
  return user;
}

// GET /api/admin/careers — list applications
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const role   = searchParams.get('role');
  const limit  = Math.min(parseInt(searchParams.get('limit') || '200', 10), 500);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status) { conditions.push('status = ?'); params.push(status); }
  if (role)   { conditions.push('role = ?');   params.push(role);   }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query<{
    id: number; name: string; phone: string; email: string | null;
    role: string; location: string | null; network: string | null;
    message: string | null; status: string; notes: string | null;
    reviewed_at: string | null; created_at: string;
  }>(
    `SELECT id, name, phone, email, role, location, network, message, status, notes, reviewed_at, created_at
       FROM career_applications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const counts = await query<{ status: string; cnt: number }>(
    `SELECT status, COUNT(*) AS cnt FROM career_applications GROUP BY status`,
    [],
  );

  const totals = { pending: 0, approved: 0, rejected: 0, contacted: 0, total: 0 };
  for (const row of counts.rows) {
    const s = row.status as keyof typeof totals;
    if (s in totals) totals[s] = Number(row.cnt);
    totals.total += Number(row.cnt);
  }

  return NextResponse.json({ ok: true, applications: result.rows, totals });
}

// PATCH /api/admin/careers — update application status/notes
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { id, status, notes } = body;

  if (!id || !status) {
    return NextResponse.json({ ok: false, error: 'id and status required' }, { status: 400 });
  }

  const allowed = ['pending', 'approved', 'rejected', 'contacted'];
  if (!allowed.includes(status)) {
    return NextResponse.json({ ok: false, error: 'Invalid status' }, { status: 400 });
  }

  await execute(
    `UPDATE career_applications SET status = ?, notes = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP() WHERE id = ?`,
    [status, notes || null, admin.userId, id],
  );

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/careers — delete application
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  await execute(`DELETE FROM career_applications WHERE id = ?`, [id]);
  return NextResponse.json({ ok: true });
}
