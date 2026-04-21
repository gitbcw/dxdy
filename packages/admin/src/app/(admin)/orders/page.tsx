'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  getAllOrders,
  adjustOrderPrice,
  updateOrderStatusWithLog,
  assignOrderToClerkWithLog,
  getClerks,
  clerkPendingOrders,
} from '@dxdy/shared';
import { formatMoney, formatDateTime } from '@dxdy/shared';
import type { AdminUser, Clerk, Order, OrderStatus } from '@dxdy/shared';

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

const typeLabel: Record<'all' | 'normal' | 'booking', string> = {
  all: '全部类型',
  normal: '普通订单',
  booking: '预约订单',
};

const statusFilterLabel: Record<'all' | OrderStatus, string> = {
  all: '全部状态',
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

type OrderTab = 'all' | 'todo' | 'done';

const pendingStatuses: OrderStatus[] = [
  'pending_payment',
  'pending_shipment',
  'pending_confirmation',
  'confirmed',
  'in_service',
];

const doneStatuses: OrderStatus[] = [
  'pending_receipt',
  'completed',
  'cancelled',
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<OrderTab>('todo');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'normal' | 'booking'>('all');
  const [adjustOrder, setAdjustOrder] = useState<Order | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [assignOrder, setAssignOrder] = useState<Order | null>(null);
  const [clerks] = useState<Clerk[]>(() => getClerks());
  const [adminUser] = useState<AdminUser | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem('admin_user');
    if (!stored) return null;
    try {
      return JSON.parse(stored) as AdminUser;
    } catch {
      return null;
    }
  });
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    getAllOrders().then(setOrders);
  }, []);

  const tabFilteredOrders = orders.filter(order => {
    if (activeTab === 'todo') return pendingStatuses.includes(order.status);
    if (activeTab === 'done') return doneStatuses.includes(order.status);
    return true;
  });

  const filteredOrders = tabFilteredOrders.filter(order => {
    const matchesSearch =
      !search ||
      order.customerName.includes(search) ||
      order.id.includes(search);
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesType = typeFilter === 'all' || order.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const todoCount = orders.filter(order => pendingStatuses.includes(order.status)).length;
  const doneCount = orders.filter(order => doneStatuses.includes(order.status)).length;

  async function handleAdjustPrice() {
    if (!adjustOrder || !newPrice || !adminUser) return;
    const price = parseFloat(newPrice);
    if (Number.isNaN(price) || price <= 0) return;
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
      setOrders(prev => prev.map(order => (order.id === result.order!.id ? result.order! : order)));
      setErrorMsg('');
    } else {
      setErrorMsg(result.error || '改价失败');
    }
    setAdjustOrder(null);
    setNewPrice('');
  }

  async function handleCancel(orderId: string) {
    if (!adminUser) return;
    const updated = await updateOrderStatusWithLog(orderId, 'cancelled', {
      id: adminUser.id,
      name: adminUser.realName,
      role: adminUser.role,
    });
    if (updated) {
      setOrders(prev => prev.map(order => (order.id === updated.id ? updated : order)));
    }
  }

  async function handleConfirmBooking(orderId: string) {
    if (!adminUser) return;
    const updated = await updateOrderStatusWithLog(orderId, 'confirmed', {
      id: adminUser.id,
      name: adminUser.realName,
      role: adminUser.role,
    });
    if (updated) {
      setOrders(prev => prev.map(order => (order.id === updated.id ? updated : order)));
    }
  }

  async function handleAdvanceStatus(orderId: string, nextStatus: OrderStatus) {
    if (!adminUser) return;
    const updated = await updateOrderStatusWithLog(orderId, nextStatus, {
      id: adminUser.id,
      name: adminUser.realName,
      role: adminUser.role,
    });
    if (updated) {
      setOrders(prev => prev.map(order => (order.id === updated.id ? updated : order)));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold">订单管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            待处理
            {' '}
            <span className="font-medium text-foreground">{todoCount}</span>
            {' '}
            单，已处理
            {' '}
            <span className="font-medium text-foreground">{doneCount}</span>
            {' '}
            单
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="搜索订单号/客户名"
            className="w-full sm:w-72"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
          <Select
            items={typeLabel}
            value={typeFilter}
            onValueChange={value => setTypeFilter(value as 'all' | 'normal' | 'booking')}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="订单类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="normal">普通订单</SelectItem>
              <SelectItem value="booking">预约订单</SelectItem>
            </SelectContent>
          </Select>
          <Select
            items={statusFilterLabel}
            value={statusFilter}
            onValueChange={value => setStatusFilter(value as 'all' | OrderStatus)}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="订单状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {Object.entries(statusLabel).map(([status, label]) => (
                <SelectItem key={status} value={status}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={value => setActiveTab(value as OrderTab)}>
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="todo">待处理 ({todoCount})</TabsTrigger>
          <TabsTrigger value="done">已处理 ({doneCount})</TabsTrigger>
          <TabsTrigger value="all">全部订单 ({orders.length})</TabsTrigger>
        </TabsList>
      </Tabs>

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
              {filteredOrders.map(order => (
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
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(order.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-[220px] flex-wrap gap-2">
                      <Link href={`/orders/${order.id}`}>
                        <Button variant="outline" size="sm">详情</Button>
                      </Link>
                      {order.status === 'pending_payment' && adminUser?.permissions?.order_price_adjust && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAdjustOrder(order);
                              setNewPrice(String(order.pricing.actualAmount));
                              setErrorMsg('');
                            }}
                          >
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
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleAdvanceStatus(order.id, 'in_service')}
                        >
                          开始服务
                        </Button>
                      )}
                      {order.type === 'booking' && order.status === 'in_service' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleAdvanceStatus(order.id, 'completed')}
                        >
                          完成服务
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    没有符合当前筛选条件的订单
                  </TableCell>
                </TableRow>
              )}
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
              <Input
                id="newPrice"
                type="number"
                value={newPrice}
                onChange={event => setNewPrice(event.target.value)}
              />
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
                  const pendingCount = clerkPendingOrders.filter(order => order.assignedAt).length;
                  return (
                    <div
                      key={clerk.id}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent"
                      onClick={async () => {
                        if (!assignOrder || !adminUser) return;
                        const updated = await assignOrderToClerkWithLog(assignOrder.id, clerk.id, {
                          id: adminUser.id,
                          name: adminUser.realName,
                          role: adminUser.role,
                        });
                        if (updated) {
                          setOrders(prev => prev.map(order => (order.id === updated.id ? updated : order)));
                        }
                        setAssignOrder(null);
                      }}
                    >
                      <div>
                        <p className="font-medium">{clerk.realName || clerk.nickname}</p>
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
