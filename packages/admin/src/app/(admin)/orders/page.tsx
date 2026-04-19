'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { getAllOrders, adjustOrderPrice, updateOrderStatus, assignOrderToClerk, getClerks, clerkPendingOrders } from '@dxdy/shared';
import { formatMoney, formatDateTime } from '@dxdy/shared';
import type { AdminUser } from '@dxdy/shared';
import type { Order, OrderStatus } from '@dxdy/shared';
import type { Clerk } from '@dxdy/shared';

const statusLabel: Record<string, string> = {
  pending_payment: '待付款',
  pending_shipment: '待发货',
  pending_receipt: '待收货',
  completed: '已完成',
  cancelled: '已取消',
  pending_confirmation: '待确认',
  confirmed: '已确认',
  in_service: '服务中',
};

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending_payment: 'outline',
  pending_shipment: 'secondary',
  pending_receipt: 'secondary',
  completed: 'default',
  cancelled: 'destructive',
  pending_confirmation: 'outline',
  confirmed: 'default',
  in_service: 'secondary',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [adjustOrder, setAdjustOrder] = useState<Order | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [assignOrder, setAssignOrder] = useState<Order | null>(null);
  const [clerks, setClerks] = useState<Clerk[]>([]);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    getAllOrders().then(setOrders);
    setClerks(getClerks());
    const stored = localStorage.getItem('admin_user');
    if (stored) {
      try {
        const user = JSON.parse(stored) as AdminUser;
        setAdminUser(user);
      } catch { /* ignore */ }
    }
  }, []);

  const filtered = orders.filter(o =>
    o.customerName.includes(search) || o.id.includes(search),
  );

  async function handleAdjustPrice() {
    if (!adjustOrder || !newPrice || !adminUser) return;
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) return;
    if (price > adjustOrder.pricing.actualAmount) {
      setErrorMsg('改价只能低于原价');
      return;
    }
    const result = await adjustOrderPrice(
      adjustOrder.id,
      price,
      adminUser.id,
      adminUser.realName,
      adminUser.permissions,
    );
    if (result.success && result.order) {
      setOrders(prev => prev.map(o => o.id === result.order!.id ? result.order! : o));
      setErrorMsg('');
    } else {
      setErrorMsg(result.error || '改价失败');
    }
    setAdjustOrder(null);
    setNewPrice('');
  }

  async function handleCancel(orderId: string) {
    const updated = await updateOrderStatus(orderId, 'cancelled');
    if (updated) {
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
    }
  }

  async function handleConfirmBooking(orderId: string) {
    const updated = await updateOrderStatus(orderId, 'confirmed');
    if (updated) {
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
    }
  }

  async function handleAdvanceStatus(orderId: string, nextStatus: OrderStatus) {
    const updated = await updateOrderStatus(orderId, nextStatus);
    if (updated) {
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">订单管理</h1>
        <Input
          placeholder="搜索订单号/客户名"
          className="w-64"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>订单号</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(order => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-sm">{order.id}</TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>{order.type === 'booking' ? '预约' : '普通'}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[order.status] ?? 'default'}>
                      {statusLabel[order.status] ?? order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>¥{formatMoney(order.pricing.actualAmount)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateTime(order.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Link href={`/orders/${order.id}`}>
                        <Button variant="outline" size="sm">详情</Button>
                      </Link>
                      {order.status === 'pending_payment' && adminUser?.permissions?.order_price_adjust && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => { setAdjustOrder(order); setNewPrice(String(order.pricing.actualAmount)); setErrorMsg(''); }}>
                            改价
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleCancel(order.id)}>
                            取消
                          </Button>
                        </>
                      )}
                      {order.status === 'pending_payment' && !adminUser?.permissions?.order_price_adjust && (
                        <Button variant="destructive" size="sm" onClick={() => handleCancel(order.id)}>
                          取消
                        </Button>
                      )}
                      {(order.status === 'pending_shipment' || order.status === 'confirmed') && !order.clerkId && (
                        <Button variant="default" size="sm" onClick={() => setAssignOrder(order)}>
                          指派
                        </Button>
                      )}
                      {order.type === 'booking' && order.status === 'pending_confirmation' && (
                        <Button variant="default" size="sm" onClick={() => handleConfirmBooking(order.id)}>
                          确认预约
                        </Button>
                      )}
                      {order.type === 'booking' && order.status === 'confirmed' && (
                        <Button variant="default" size="sm" onClick={() => handleAdvanceStatus(order.id, 'in_service')}>
                          开始服务
                        </Button>
                      )}
                      {order.type === 'booking' && order.status === 'in_service' && (
                        <Button variant="default" size="sm" onClick={() => handleAdvanceStatus(order.id, 'completed')}>
                          完成服务
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!adjustOrder} onOpenChange={() => setAdjustOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改订单价格</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>订单号</Label>
              <p className="text-sm font-mono">{adjustOrder?.id}</p>
            </div>
            <div className="space-y-2">
              <Label>原价</Label>
              <p className="text-sm">¥{formatMoney(adjustOrder?.pricing.actualAmount ?? 0)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPrice">新价格</Label>
              <Input id="newPrice" type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} />
            </div>
            {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOrder(null)}>取消</Button>
            <Button onClick={handleAdjustPrice}>确认改价</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignOrder} onOpenChange={() => setAssignOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>指派制单员</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>订单号</Label>
              <p className="text-sm font-mono">{assignOrder?.id}</p>
            </div>
            <div className="space-y-2">
              <Label>选择制单员</Label>
              <div className="space-y-2">
                {clerks.map(clerk => {
                  const pendingCount = clerkPendingOrders.filter(o => o.assignedAt).length;
                  return (
                    <div
                      key={clerk.id}
                      className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-accent"
                      onClick={async () => {
                        if (!assignOrder) return;
                        const updated = await assignOrderToClerk(assignOrder.id, clerk.id);
                        if (updated) {
                          setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
                        }
                        setAssignOrder(null);
                      }}
                    >
                      <div>
                        <p className="font-medium">{clerk.name}</p>
                        <p className="text-sm text-muted-foreground">{clerk.phone}</p>
                      </div>
                      <Badge variant="secondary">{pendingCount} 待处理</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOrder(null)}>取消</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
