import { NextRequest, NextResponse } from 'next/server';
import { clearAdminSessionCookie, requireAdmin } from '@/lib/admin-api-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { response, user } = await requireAdmin(request);
  if (response) return response;
  return NextResponse.json({ user });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  clearAdminSessionCookie(response);
  return response;
}
