import { NextRequest, NextResponse } from 'next/server';
import { GET as detailsGet } from './details/route';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Backward-compat: /api/matches/[id] now returns the same payload as /api/matches/[id]/details
export async function GET(request: NextRequest, context: RouteContext) {
  return detailsGet(request, context);
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
