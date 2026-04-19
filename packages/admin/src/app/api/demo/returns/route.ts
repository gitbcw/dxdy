import { NextResponse } from 'next/server';
import { createReturn, getReturns } from '@dxdy/shared';
import type { ReturnStatus } from '@dxdy/shared';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const returns = await getReturns({
    orderId: searchParams.get('orderId') || undefined,
    status: (searchParams.get('status') as ReturnStatus) || undefined,
  });

  return NextResponse.json({ data: returns });
}

export async function POST(request: Request) {
  const body = await request.json();

  if (!body?.orderId || !body?.type || !Array.isArray(body?.items)) {
    return NextResponse.json({ error: '退换货参数不完整' }, { status: 400 });
  }

  const record = await createReturn({
    orderId: body.orderId,
    type: body.type,
    reason: body.reason || '',
    items: body.items,
    exchangeItem: body.exchangeItem,
  });

  return NextResponse.json({ data: record });
}
