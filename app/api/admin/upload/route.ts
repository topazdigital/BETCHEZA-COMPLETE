import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form' }, { status: 400 });
  }
  const file = form.get('file');
  const folder = String(form.get('folder') || 'branding').replace(/[^a-z0-9_-]/gi, '');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024}MB)` }, { status: 413 });
  }

  const ext = (() => {
    const fromName = path.extname(file.name || '').toLowerCase();
    if (fromName) return fromName;
    if (file.type === 'image/svg+xml') return '.svg';
    if (file.type === 'image/png') return '.png';
    if (file.type === 'image/webp') return '.webp';
    return '.jpg';
  })();
  const safeBase = (file.name || 'upload')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .toLowerCase()
    .slice(0, 40) || 'upload';
  const filename = `${safeBase}-${Date.now()}${ext}`;

  const dir = path.join(process.cwd(), 'public', 'uploads', folder || 'branding');
  await mkdir(dir, { recursive: true });
  const filepath = path.join(dir, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, buf);

  const publicUrl = `/uploads/${folder || 'branding'}/${filename}`;
  return NextResponse.json({ success: true, url: publicUrl, size: file.size, type: file.type });
}
