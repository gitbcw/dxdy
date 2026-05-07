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
import { cloudbaseFetch, cloudbaseJsonFetch } from '@/lib/admin-api-client';
import { formatMoney, formatDateTime } from '@/lib/format';
import type { AdminUser, Clerk, Order, OrderStatus } from '@/lib/types';

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
  const [shipOrder, setShipOrder] = useState<Order | null>(null);
  const [shipCompany, setShipCompany] = useState('');
  const [shipTrackingNo, setShipTrackingNo] = useState('');
  const [assignOrder, setAssignOrder] = useState<Order | null>(null);
  const [clerks, setClerks] = useState<Clerk[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState('');
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
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await cloudbaseFetch('/api/cloudbase/orders', { cache: 'no-store' });
      const data = await response.json() as { orders?: Order[]; clerks?: Clerk[]; error?: string };
      if (!response.ok) throw new Error(data.error || '读取订单数据失败');
      setOrders(data.orders || []);
      setClerks(data.clerks || []);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '读取订单数据失败');
    } finally {
      setLoading(false);
    }
  }

  function getOperator() {
    return {
      operatorId: adminUser?.id || 'admin_001',
      operatorName: adminUser?.realName || adminUser?.username || '后台管理员',
    };
  }

  function updateRecord(updated?: Order) {
    if (!updated) return;
    setOrders(prev => prev.map(order => (order.id === updated.id ? updated : order)));
  }

  async function submitOrderAction(params: {
    orderId: string;
    action: 'adjust_price' | 'status' | 'assign' | 'ship';
    status?: OrderStatus;
    newPrice?: number;
    clerkId?: string;
    company?: string;
    trackingNo?: string;
  }) {
    setSubmittingId(params.orderId);
    setErrorMsg('');
    try {
      const response = await cloudbaseJsonFetch('/api/cloudbase/orders', { ...params, ...getOperator() });
      const data = await response.json() as { order?: Order; error?: string };
      if (!response.ok) throw new Error(data.error || '订单处理失败');
      updateRecord(data.order);
      return true;
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '订单处理失败');
      return false;
    } finally {
      setSubmittingId('');
    }
  }

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
    const ok = await submitOrderAction({
      orderId: adjustOrder.id,
      action: 'adjust_price',
      newPrice: price,
    });
    if (ok) {
      setAdjustOrder(null);
      setNewPrice('');
    }
  }

  async function handleCancel(orderId: string) {
    await submitOrderAction({ orderId, action: 'status', status: 'cancelled' });
  }

  async function handleConfirmBooking(orderId: string) {
    await submitOrderAction({ orderId, action: 'status', status: 'confirmed' });
  }

  async function handleAdvanceStatus(orderId: string, nextStatus: OrderStatus) {
    await submitOrderAction({ orderId, action: 'status', status: nextStatus });
  }

  async function handleShipOrder() {
    if (!shipOrder) return;
    if (!shipCompany.trim() || !shipTrackingNo.trim()) {
      setErrorMsg('请填写物流公司和物流单号');
      return;
    }
    const ok = await submitOrderAction({
      orderId: shipOrder.id,
      action: 'ship',
      company: shipCompany,
      trackingNo: shipTrackingNo,
    });
    if (ok) {
      setShipOrder(null);
      setShipCompany('');
      setShipTrackingNo('');
    }
  }

  async function handleAssignOrder(clerkId: string) {
    if (!assignOrder) return;
    const ok = await submitOrderAction({
      orderId: assignOrder.id,
      action: 'assign',
      clerkId,
    });
    if (ok) setAssignOrder(null);
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
            onValueChange={value => setTypeFilter((value ?? 'all') as 'all' | 'normal' | 'booking')}
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
            onValueChange={value => setStatusFilter((value ?? 'all') as 'all' | OrderStatus)}
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
          {errorMsg && <div className="border-b px-4 py-3 text-sm text-destructive">{errorMsg}</div>}
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
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    加载订单数据中...
                  </TableCell>
                </TableRow>
              )}
              {!loading && filteredOrders.map(order => (
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
                            disabled={submittingId === order.id}
                            onClick={() => {
                              setAdjustOrder(order);
                              setNewPrice(String(order.pricing.actualAmount));
                              setErrorMsg('');
                            }}
                          >
                            改价
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleCancel(order.id)} disabled={submittingId === order.id}>
                            取消
                          </Button>
                        </>
                      )}
                      {order.status === 'pending_payment' && !adminUser?.permissions?.order_price_adjust && (
                        <Button variant="destructive" size="sm" onClick={() => handleCancel(order.id)} disabled={submittingId === order.id}>
                          取消
                        </Button>
                      )}
                      {(order.status === 'pending_shipment' || order.status === 'confirmed') && !order.clerkId && (
                        <Button
                          variant="default"
                          size="sm"
                          disabled={submittingId === order.id}
                          onClick={() => {
                            setAssignOrder(order);
                            setErrorMsg('');
                          }}
                        >
                          指派
                        </Button>
                      )}
                      {(order.status === 'pending_shipment' || order.status === 'confirmed') && order.clerkId && (
                        <Button
                          variant="default"
                          size="sm"
                          disabled={submittingId === order.id}
                          onClick={() => {
                            setShipOrder(order);
                            setShipCompany(order.shipping.company || '');
                            setShipTrackingNo(order.shipping.trackingNo || '');
                            setErrorMsg('');
                          }}
                        >
                          发货
                        </Button>
                      )}
                      {order.type === 'booking' && order.status === 'pending_confirmation' && (
                        <Button variant="default" size="sm" onClick={() => handleConfirmBooking(order.id)} disabled={submittingId === order.id}>
                          确认预约
                        </Button>
                      )}
                      {order.type === 'booking' && order.status === 'confirmed' && (
                        <Button
                          variant="default"
                          size="sm"
                          disabled={submittingId === order.id}
                          onClick={() => handleAdvanceStatus(order.id, 'in_service')}
                        >
                          开始服务
                        </Button>
                      )}
                      {order.type === 'booking' && order.status === 'in_service' && (
                        <Button
                          variant="default"
                          size="sm"
                          disabled={submittingId === order.id}
                          onClick={() => handleAdvanceStatus(order.id, 'completed')}
                        >
                          完成服务
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filteredOrders.length === 0 && (
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
            <Button onClick={handleAdjustPrice} disabled={!!adjustOrder && submittingId === adjustOrder.id}>确认改价</Button>
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
                {clerks.length === 0 && (
                  <p className="rounded-lg border p-3 text-sm text-muted-foreground">暂无可用制单员</p>
                )}
                {clerks.map(clerk => {
                  const pendingCount = orders.filter(order => order.clerkId === clerk.id && ['pending_shipment', 'confirmed'].includes(order.status)).length;
                  return (
                    <button
                      key={clerk.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent disabled:opacity-60"
                      disabled={!!assignOrder && submittingId === assignOrder.id}
                      onClick={() => handleAssignOrder(clerk.id)}
                    >
                      <div>
                        <p className="font-medium">{clerk.realName || clerk.nickname}</p>
                        <p className="text-sm text-muted-foreground">{clerk.phone}</p>
                      </div>
                      <Badge variant="secondary">{pendingCount} 待处理</Badge>
                    </button>
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

      <Dialog open={!!shipOrder} onOpenChange={() => setShipOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>录入物流发货</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>订单号</Label>
              <p className="text-sm font-mono">{shipOrder?.id}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipCompany">物流公司</Label>
              <Input id="shipCompany" value={shipCompany} onChange={event => setShipCompany(event.target.value)} placeholder="如 顺丰速运" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipTrackingNo">物流单号</Label>
              <Input id="shipTrackingNo" value={shipTrackingNo} onChange={event => setShipTrackingNo(event.target.value)} placeholder="请输入物流单号" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShipOrder(null)}>取消</Button>
            <Button onClick={handleShipOrder} disabled={!!shipOrder && submittingId === shipOrder.id}>确认发货</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
