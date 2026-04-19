import { NextResponse } from 'next/server';
import { reviewReturn } from '@dxdy/shared';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();

  const record = await reviewReturn(
    id,
    Boolean(body?.approved),
    body?.reviewerId || 'service_001',
    body?.note || '',
  );

  if (!record) {
    return NextResponse.json({ error: '退换货不存在' }, { status: 404 });
  }

  return NextResponse.json({ data: record });
}
