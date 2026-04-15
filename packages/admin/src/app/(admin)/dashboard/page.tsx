'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAllOrders } from '@dxdy/shared';
import { getAllReturns } from '@dxdy/shared';
import { getAllProducts } from '@dxdy/shared';
import type { Order, ReturnRecord, Product } from '@dxdy/shared';

export default function DashboardPage() {
  const [stats, setStats] = useState({ orders: 0, pending: 0, returns: 0, products: 0 });

  useEffect(() => {
    async function load() {
      const [orders, returns, products] = await Promise.all([
        getAllOrders(),
        getAllReturns(),
        getAllProducts(),
      ]);
      setStats({
        orders: orders.length,
        pending: orders.filter(o => o.status === 'pending_payment' || o.status === 'pending_shipment').length,
        returns: returns.filter(r => r.status === 'pending_review').length,
        products: products.filter(p => p.status === 'on_sale').length,
      });
    }
    load();
  }, []);

  const cards = [
    { title: '总订单数', value: stats.orders, desc: '全部订单' },
    { title: '待处理', value: stats.pending, desc: '待付款/待发货' },
    { title: '退货待审', value: stats.returns, desc: '待审核退换货' },
    { title: '在售商品', value: stats.products, desc: '上架商品数' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">仪表盘</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map(card => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{card.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
