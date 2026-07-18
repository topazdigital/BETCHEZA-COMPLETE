import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAccessAdmin } from '@/lib/permissions';
import { listEnquiries, markEnquiryRead, deleteEnquiry } from '@/lib/enquiry-store';

export const dynamic = 'force-dynamic';

async function guard() {
  try {
    const u = await getCurrentUser();
    if (!u || !canAccessAdmin(u.role)) return false;
    return true;
  } catch { return false; }
}

export async function GET() {
  if (!await guard()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ enquiries: listEnquiries() });
}

export async function PATCH(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await req.json();
  const ok = markEnquiryRead(id);
  return NextResponse.json({ ok });
}

export async function DELETE(req: NextRequest) {
  if (!await guard()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await req.json();
  const ok = deleteEnquiry(id);
  return NextResponse.json({ ok });
}
