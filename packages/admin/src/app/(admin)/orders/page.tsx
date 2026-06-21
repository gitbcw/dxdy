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
import { useAuth } from '@/hooks/use-auth';
import { fetchOrders, fetchClerks } from '@/lib/services/database';
import { adjustOrderPrice, assignOrderToClerk, clerkShipOrder, updateOrderStatus } from '@/lib/services/functions';
import { formatMoney, formatDateTime } from '@/lib/format';
import type { Clerk, Order, OrderStatus } from '@/lib/types';

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

const typeLabel: Record<'all' | 'normal' | 'booking' | 'recharge', string> = {
  all: '全部类型',
  normal: '普通订单',
  booking: '预约订单',
  recharge: '充值订单',
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

type ShippingWithColdChain = Order['shipping'] & {
  coldChain?: {
    packageType?: string;
    method?: string;
    weight?: string;
    boxTemperature?: string;
  };
};

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<OrderTab>('todo');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'normal' | 'booking' | 'recharge'>('all');
  const [adjustOrder, setAdjustOrder] = useState<Order | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [confirmBookingOrder, setConfirmBookingOrder] = useState<Order | null>(null);
  const [bookingAmount, setBookingAmount] = useState('');
  const [bookingUrgentFee, setBookingUrgentFee] = useState('');
  const [shipOrder, setShipOrder] = useState<Order | null>(null);
  const [shipCompany, setShipCompany] = useState('');
  const [shipTrackingNo, setShipTrackingNo] = useState('');
  const [shipPackageType, setShipPackageType] = useState('');
  const [shipColdChain, setShipColdChain] = useState('');
  const [shipWeight, setShipWeight] = useState('');
  const [shipTemp, setShipTemp] = useState('');
  const [shipModifyReason, setShipModifyReason] = useState('');
  const [shipAbnormal, setShipAbnormal] = useState(false);
  const [shipAbnormalType, setShipAbnormalType] = useState('');
  const [shipAbnormalReason, setShipAbnormalReason] = useState('');
  const [assignOrder, setAssignOrder] = useState<Order | null>(null);
  const [clerks, setClerks] = useState<Clerk[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (authLoading) return;
    loadOrders();
  }, [authLoading, user?.id]);

  async function loadOrders() {
    setLoading(true);
    setErrorMsg('');
    try {
      const [orderData, clerkData] = await Promise.all([
        fetchOrders(undefined, user?.id),
        user?.role === 'clerk' ? Promise.resolve([]) : fetchClerks(user?.id),
      ]);
      setOrders(orderData);
      setClerks(clerkData);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '读取订单数据失败');
    } finally {
      setLoading(false);
    }
  }

  function getOperator() {
    return {
      operatorId: user?.id || 'admin_001',
      operatorName: user?.realName || user?.username || '后台管理员',
    };
  }

  async function submitOrderAction(params: {
    orderId: string;
    action: 'adjust_price' | 'status' | 'assign' | 'ship';
    status?: OrderStatus;
    newPrice?: number;
    bookingAmount?: number;
    urgentFee?: number;
    clerkId?: string;
    company?: string;
    trackingNo?: string;
    packageType?: string;
    coldChainMethod?: string;
    packageWeight?: string;
    boxTemperature?: string;
    modifyReason?: string;
    abnormalFlag?: boolean;
    abnormalType?: string;
    abnormalReason?: string;
  }) {
    setSubmittingId(params.orderId);
    setErrorMsg('');
    const op = getOperator();
    try {
      let result: { success?: boolean; error?: string; order?: Order };
      if (params.action === 'adjust_price' && params.newPrice !== undefined) {
        result = await adjustOrderPrice({ orderId: params.orderId, newPrice: params.newPrice, ...op });
      } else if (params.action === 'assign' && params.clerkId) {
        result = await assignOrderToClerk({ orderId: params.orderId, clerkId: params.clerkId, ...op });
      } else if (params.action === 'ship' && params.company && params.trackingNo) {
        result = await clerkShipOrder({
          orderId: params.orderId, company: params.company, trackingNo: params.trackingNo,
          ...(params.packageType ? { packageType: params.packageType } : {}),
          ...(params.coldChainMethod ? { coldChainMethod: params.coldChainMethod } : {}),
          ...(params.packageWeight ? { packageWeight: params.packageWeight } : {}),
          ...(params.boxTemperature ? { boxTemperature: params.boxTemperature } : {}),
          ...(params.modifyReason ? { modifyReason: params.modifyReason } : {}),
          ...(params.abnormalFlag ? { abnormalFlag: true, abnormalType: params.abnormalType, abnormalReason: params.abnormalReason } : {}),
          ...op,
        });
      } else if (params.action === 'status' && params.status) {
        result = await updateOrderStatus({
          orderId: params.orderId,
          status: params.status,
          ...(params.bookingAmount !== undefined ? { bookingAmount: params.bookingAmount } : {}),
          ...(params.urgentFee !== undefined ? { urgentFee: params.urgentFee } : {}),
          ...op,
        });
      } else {
        throw new Error('无效的操作参数');
      }
      if (!result.success) throw new Error(result.error || '订单处理失败');
      // Reload to get fresh data after mutation
      await loadOrders();
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
      order.id.includes(search) ||
      (order.orderNo || '').includes(search);
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesType = typeFilter === 'all' || order.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const todoCount = orders.filter(order => pendingStatuses.includes(order.status)).length;
  const doneCount = orders.filter(order => doneStatuses.includes(order.status)).length;

  function getClerkName(order: Order) {
    if (!order.clerkId) return '-';
    const clerk = clerks.find(item => item.id === order.clerkId);
    const orderWithClerkName = order as Order & { clerkName?: string };
    return clerk?.realName || clerk?.nickname || orderWithClerkName.clerkName || order.clerkId;
  }

  function canAdjustOrderPrice() {
    if (user?.role === 'clerk') return false;
    return user?.role === 'system_admin' ||
      user?.role === 'service' ||
      user?.permissions?.manage_orders === true ||
      user?.permissions?.order_price_adjust === true;
  }

  function requiresColdChainShipping(order: Order | null) {
    if (!order || order.type === 'booking') return false;
    return (order.items || []).some(item => {
      const itemWithType = item as typeof item & { productType?: string; isBloodPack?: boolean };
      if (itemWithType.productType === 'blood_booking') return false;
      return itemWithType.isBloodPack === true || /血/.test(item.productName || '');
    });
  }

  function openShipDialog(order: Order) {
    const shipping = (order.shipping || {}) as ShippingWithColdChain;
    setShipOrder(order);
    setShipCompany(shipping.company || '');
    setShipTrackingNo(shipping.trackingNo || '');
    setShipPackageType(shipping.coldChain?.packageType || '');
    setShipColdChain(shipping.coldChain?.method || '');
    setShipWeight(shipping.coldChain?.weight || '');
    setShipTemp(shipping.coldChain?.boxTemperature || '');
    setShipModifyReason('');
    setShipAbnormal(false);
    setShipAbnormalType('');
    setShipAbnormalReason('');
    setErrorMsg('');
  }

  async function handleAdjustPrice() {
    if (!adjustOrder || !newPrice || !user) return;
    const price = parseFloat(newPrice);
    if (Number.isNaN(price) || price <= 0) return;
    if (Math.round(price * 100) === Math.round(adjustOrder.pricing.actualAmount * 100)) {
      setErrorMsg('改价只能低于原价');
      setErrorMsg('新价格不能和当前价格相同');
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

  function openConfirmBooking(order: Order) {
    setConfirmBookingOrder(order);
    setBookingAmount(order.pricing.actualAmount > 0 ? String(order.pricing.actualAmount) : '');
    setBookingUrgentFee(String(order.pricing.urgentFee || 0));
    setErrorMsg('');
  }

  async function handleConfirmBooking() {
    if (!confirmBookingOrder) return;
    const amount = Number(bookingAmount);
    const urgentFee = Number(bookingUrgentFee || 0);
    const isUrgent = !!(confirmBookingOrder.booking?.urgent || confirmBookingOrder.shipping?.urgent);
    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMsg('请输入订单金额');
      return;
    }
    if (isUrgent && (!Number.isFinite(urgentFee) || urgentFee < 0)) {
      setErrorMsg('请输入有效的加急费用');
      return;
    }
    const ok = await submitOrderAction({
      orderId: confirmBookingOrder.id,
      action: 'status',
      status: 'confirmed',
      bookingAmount: amount,
      urgentFee: isUrgent ? urgentFee : 0,
    });
    if (ok) {
      setConfirmBookingOrder(null);
      setBookingAmount('');
      setBookingUrgentFee('');
    }
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
    if (requiresColdChainShipping(shipOrder) && (!shipPackageType || !shipColdChain || !shipTemp)) {
      setErrorMsg('血包订单请补全冷链信息（包装类型、冷链方式、箱内温度）');
      return;
    }
    const alreadyShipped = shipOrder.status === 'pending_receipt' || !!(shipOrder.shipping?.trackingNo);
    if (alreadyShipped && !shipModifyReason.trim()) {
      setErrorMsg('修改已发货订单物流请填写修改原因');
      return;
    }
    if (shipAbnormal && (!shipAbnormalType || !shipAbnormalReason.trim())) {
      setErrorMsg('请选择异常类型并填写异常原因');
      return;
    }
    const ok = await submitOrderAction({
      orderId: shipOrder.id,
      action: 'ship',
      company: shipCompany,
      trackingNo: shipTrackingNo,
      packageType: shipPackageType,
      coldChainMethod: shipColdChain,
      packageWeight: shipWeight,
      boxTemperature: shipTemp,
      modifyReason: shipModifyReason.trim(),
      ...(shipAbnormal ? { abnormalFlag: true, abnormalType: shipAbnormalType, abnormalReason: shipAbnormalReason.trim() } : {}),
    });
    if (ok) {
      setShipOrder(null);
      setShipCompany('');
      setShipTrackingNo('');
      setShipPackageType('');
      setShipColdChain('');
      setShipWeight('');
      setShipTemp('');
      setShipModifyReason('');
      setShipAbnormal(false);
      setShipAbnormalType('');
      setShipAbnormalReason('');
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
            value={typeFilter}
            onValueChange={value => setTypeFilter((value ?? 'all') as 'all' | 'normal' | 'booking' | 'recharge')}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue>{typeLabel[typeFilter]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="normal">普通订单</SelectItem>
              <SelectItem value="booking">预约订单</SelectItem>
              <SelectItem value="recharge">充值订单</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={value => setStatusFilter((value ?? 'all') as 'all' | OrderStatus)}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue>{statusFilterLabel[statusFilter]}</SelectValue>
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
                <TableHead>制单员</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    加载订单数据中...
                  </TableCell>
                </TableRow>
              )}
              {!loading && filteredOrders.map(order => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-sm">{order.orderNo || order.id}</TableCell>
                  <TableCell>{order.customerName}</TableCell>
                  <TableCell>{order.type === 'booking' ? '预约' : '普通'}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[order.status] ?? 'default'}>
                      {statusLabel[order.status] ?? order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{getClerkName(order)}</TableCell>
                  <TableCell>¥{formatMoney(order.pricing.actualAmount)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(order.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-[220px] flex-wrap gap-2">
                      <Link href={`/orders/detail/?id=${encodeURIComponent(order.id)}`}>
                        <Button variant="outline" size="sm">详情</Button>
                      </Link>
                      {order.status === 'pending_payment' && canAdjustOrderPrice() && (
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
                      {order.status === 'pending_payment' && !canAdjustOrderPrice() && (
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
                      {(order.status === 'pending_shipment' || order.status === 'confirmed') && !(order.type === 'booking' && (order.booking?.urgent || order.shipping?.urgent)) && (
                        <Button
                          variant="default"
                          size="sm"
                          disabled={submittingId === order.id}
                          onClick={() => openShipDialog(order)}
                        >
                          发货
                        </Button>
                      )}
                      {order.type === 'booking' && order.status === 'pending_confirmation' && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            if (order.payment?.status === 'paid' && order.pricing.actualAmount > 0) {
                              handleAdvanceStatus(order.id, 'confirmed');
                              return;
                            }
                            openConfirmBooking(order);
                          }}
                          disabled={submittingId === order.id}
                        >
                          确认预约
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filteredOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
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
              <p className="text-sm font-mono">{adjustOrder?.orderNo || adjustOrder?.id}</p>
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
              <p className="text-sm font-mono">{assignOrder?.orderNo || assignOrder?.id}</p>
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

      <Dialog open={!!confirmBookingOrder} onOpenChange={() => setConfirmBookingOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认预约并录入金额</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">订单号</p>
                <p className="font-mono">{confirmBookingOrder?.orderNo || confirmBookingOrder?.id}</p>
              </div>
              <div>
                <p className="text-muted-foreground">客户</p>
                <p>{confirmBookingOrder?.customerName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">用血需求</p>
                <p>
                  {confirmBookingOrder?.booking?.speciesLabel || confirmBookingOrder?.items?.[0]?.productName || '预约'}
                  {' · '}
                  {confirmBookingOrder?.booking?.bloodType || confirmBookingOrder?.items?.[0]?.spec || '-'}
                  {confirmBookingOrder?.booking?.volumeMl ? ` · ${confirmBookingOrder.booking.volumeMl}ml` : ''}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">预约时间</p>
                <p>{confirmBookingOrder?.booking?.date || '-'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">收货地址</p>
                <p>{confirmBookingOrder?.shipping?.address?.full || confirmBookingOrder?.booking?.location || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">联系人</p>
                <p>{confirmBookingOrder?.booking?.contactName || confirmBookingOrder?.shipping?.address?.name || '-'} · {confirmBookingOrder?.booking?.contactPhone || confirmBookingOrder?.shipping?.address?.phone || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">加急</p>
                <p>{confirmBookingOrder?.booking?.urgent || confirmBookingOrder?.shipping?.urgent ? '是' : '否'}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bookingAmount">订单金额</Label>
              <Input
                id="bookingAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="请输入预约订单基础金额"
                value={bookingAmount}
                onChange={event => setBookingAmount(event.target.value)}
              />
            </div>
            {(confirmBookingOrder?.booking?.urgent || confirmBookingOrder?.shipping?.urgent) && (
              <div className="space-y-2">
                <Label htmlFor="bookingUrgentFee">加急费用</Label>
                <Input
                  id="bookingUrgentFee"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="请输入加急费用"
                  value={bookingUrgentFee}
                  onChange={event => setBookingUrgentFee(event.target.value)}
                />
              </div>
            )}
            {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBookingOrder(null)}>取消</Button>
            <Button onClick={handleConfirmBooking} disabled={!!confirmBookingOrder && submittingId === confirmBookingOrder.id}>
              确认预约
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!shipOrder} onOpenChange={() => setShipOrder(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>录入物流发货</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>订单号</Label>
              <p className="text-sm font-mono">{shipOrder?.orderNo || shipOrder?.id}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipCompany">物流公司</Label>
              <Input id="shipCompany" value={shipCompany} onChange={event => setShipCompany(event.target.value)} placeholder="如 顺丰速运" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipTrackingNo">物流单号</Label>
              <Input id="shipTrackingNo" value={shipTrackingNo} onChange={event => setShipTrackingNo(event.target.value)} placeholder="请输入物流单号" />
            </div>

            {/* 冷链信息 — 血包订单必填 */}
            {requiresColdChainShipping(shipOrder) && (
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-semibold">冷链信息（血包订单必填）</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">包装类型</Label>
                    <select className="w-full rounded-md border px-2 py-1.5 text-sm" value={shipPackageType} onChange={e => setShipPackageType(e.target.value)}>
                      <option value="">选择...</option>
                      <option value="冷藏箱">冷藏箱</option>
                      <option value="保温箱">保温箱</option>
                      <option value="普通箱">普通箱</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">冷链方式</Label>
                    <select className="w-full rounded-md border px-2 py-1.5 text-sm" value={shipColdChain} onChange={e => setShipColdChain(e.target.value)}>
                      <option value="">选择...</option>
                      <option value="冰袋（2-6°C）">冰袋（2-6°C）</option>
                      <option value="干冰">干冰</option>
                      <option value="常温">常温</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">包裹重量</Label>
                    <Input placeholder="如 5.80kg" value={shipWeight} onChange={e => setShipWeight(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">箱内温度</Label>
                    <Input placeholder="如 3.2" value={shipTemp} onChange={e => setShipTemp(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {/* 修改原因 — 重新发货时显示 */}
            {(shipOrder?.status === 'pending_receipt' || shipOrder?.shipping?.trackingNo) && (
              <div className="space-y-2">
                <Label htmlFor="shipModifyReason">修改原因 *</Label>
                <textarea id="shipModifyReason" className="w-full rounded-md border px-3 py-2 text-sm" rows={2} placeholder="请输入修改物流的原因" value={shipModifyReason} onChange={e => setShipModifyReason(e.target.value)} />
              </div>
            )}

            {/* 异常发货 */}
            <div className="space-y-3 rounded-lg border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={shipAbnormal} onChange={e => setShipAbnormal(e.target.checked)} />
                标记为异常发货
              </label>
              {shipAbnormal && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">异常类型 *</Label>
                    <select className="w-full rounded-md border px-2 py-1.5 text-sm" value={shipAbnormalType} onChange={e => setShipAbnormalType(e.target.value)}>
                      <option value="">选择...</option>
                      <option value="partial">部分发货</option>
                      <option value="damaged">商品破损</option>
                      <option value="address_changed">地址变更</option>
                      <option value="near_expiry">临期商品</option>
                      <option value="other">其他</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">异常原因 *</Label>
                    <textarea className="w-full rounded-md border px-3 py-2 text-sm" rows={2} placeholder="请描述异常情况" value={shipAbnormalReason} onChange={e => setShipAbnormalReason(e.target.value)} />
                  </div>
                </div>
              )}
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
