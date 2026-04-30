import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  listTemplates,
  updateTemplate,
  resetTemplate,
  type EmailTemplateKey,
} from '@/lib/email-templates-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requireAdmin() {
  const u = await getCurrentUser();
  if (!u || u.role !== 'admin') return null;
  return u;
}

export async function GET() {
  const u = await requireAdmin();
  if (!u) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ templates: listTemplates() });
}

export async function PUT(req: NextRequest) {
  const u = await requireAdmin();
  if (!u) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { key: EmailTemplateKey; subject?: string; html?: string; text?: string; name?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (!body.key) return NextResponse.json({ error: 'Template key required' }, { status: 400 });

  const updated = updateTemplate(body.key, {
    subject: body.subject,
    html: body.html,
    text: body.text,
    name: body.name,
    description: body.description,
  });
  return NextResponse.json({ template: updated });
}

export async function DELETE(req: NextRequest) {
  const u = await requireAdmin();
  if (!u) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const key = url.searchParams.get('key') as EmailTemplateKey | null;
  if (!key) return NextResponse.json({ error: 'Template key required' }, { status: 400 });

  return NextResponse.json({ template: resetTemplate(key) });
}
