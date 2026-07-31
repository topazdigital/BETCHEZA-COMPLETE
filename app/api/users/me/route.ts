import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { updateProfile, getProfile } from '@/lib/user-profile-store';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const patchSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  username: z.string().min(2).max(50).regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores').optional(),
  phone: z.string().max(30).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const profile = await getProfile(user.userId);
  return NextResponse.json({ profile });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 });
  }

  const profile = await updateProfile(user.userId, parsed.data);
  return NextResponse.json({ success: true, profile });
}
