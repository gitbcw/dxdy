import { NextResponse } from 'next/server';
import { getOrders } from '@dxdy/shared';
import type { OrderStatus } from '@dxdy/shared';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const orders = await getOrders({
    customerId: searchParams.get('customerId') || undefined,
    salespersonId: searchParams.get('salespersonId') || undefined,
    clerkId: searchParams.get('clerkId') || undefined,
    status: (searchParams.get('status') as OrderStatus) || undefined,
  });

  return NextResponse.json({ data: orders });
}
