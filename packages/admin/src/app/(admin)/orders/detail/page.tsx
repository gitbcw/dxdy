'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { fetchOrders } from '@/lib/services/database';
import { adjustOrderPrice, updateOrderStatus } from '@/lib/services/functions';
import { formatDateTime, formatMoney } from '@/lib/format';
import type { Order, OrderStatus } from '@/lib/types';

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

const commissionStatusLabel: Record<string, string> = {
  pending: '待核算',
  locked: '冻结中',
  settled: '已入账',
  adjusted: '已调整',
  deducted: '已扣减',
  none: '无提成',
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

export default function OrderDetailPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id') || '';
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function loadOrder(id: string) {
    setLoading(true);
    setErrorMsg('');
    try {
      const docs = await fetchOrders(id, user?.id);
      setOrder(docs[0] || null);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '读取订单详情失败');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!orderId) return;
    loadOrder(orderId);
  }, [authLoading, orderId, user?.id]);

  function getOperator() {
    return {
      operatorId: user?.id || 'admin_001',
      operatorName: user?.realName || user?.username || '后台管理员',
    };
  }

  async function submitOrderAction(params: {
    action: 'adjust_price' | 'status';
    status?: OrderStatus;
    newPrice?: number;
  }) {
    if (!order) return false;
    setSubmitting(true);
    setErrorMsg('');
    const op = getOperator();
    try {
      let result: { success?: boolean; error?: string };
      if (params.action === 'adjust_price' && params.newPrice !== undefined) {
        result = await adjustOrderPrice({ orderId: order.id, newPrice: params.newPrice, ...op });
      } else if (params.action === 'status' && params.status) {
        result = await updateOrderStatus({ orderId: order.id, status: params.status, ...op });
      } else {
        throw new Error('无效的操作参数');
      }
      if (!result.success) throw new Error(result.error || '订单处理失败');
      // Reload to get fresh data
      await loadOrder(order.id);
      return true;
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '订单处理失败');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdjustPrice() {
    if (!order || !newPrice || !user) return;
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) return;
    if (price > order.pricing.actualAmount) {
      setErrorMsg('改价只能低于原价');
      return;
    }

    const ok = await submitOrderAction({ action: 'adjust_price', newPrice: price });
    if (ok) {
      setAdjustOpen(false);
      setNewPrice('');
      setErrorMsg('');
      return;
    }
  }

  async function handleStatusChange(nextStatus: OrderStatus) {
    if (!order || !user) return;
    await submitOrderAction({ action: 'status', status: nextStatus });
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">加载订单详情中...</div>;
  }

  if (!order) {
    return <div className="text-sm text-muted-foreground">订单不存在或已删除。</div>;
  }

  const canAdjust = order.status === 'pending_payment' && user?.permissions?.order_price_adjust;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="px-0" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            返回订单列表
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">订单详情</h1>
            <Badge variant={statusVariant[order.status] ?? 'default'}>
              {statusLabel[order.status] ?? order.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {order.orderNo || order.id} · {order.customerName} · {order.type === 'booking' ? '预约订单' : '普通订单'}
          </p>
        </div>
        {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Link href="/orders">
            <Button variant="outline">返回列表</Button>
          </Link>
          {canAdjust && (
            <Button
              variant="outline"
              onClick={() => {
                setAdjustOpen(true);
                setNewPrice(String(order.pricing.actualAmount));
                setErrorMsg('');
              }}
            >
              改价
            </Button>
          )}
          {order.type === 'booking' && order.status === 'pending_confirmation' && (
            <Button onClick={() => handleStatusChange('confirmed')} disabled={submitting}>确认预约</Button>
          )}
          {order.type === 'booking' && order.status === 'confirmed' && (
            <Button onClick={() => handleStatusChange('in_service')} disabled={submitting}>开始服务</Button>
          )}
          {order.type === 'booking' && order.status === 'in_service' && (
            <Button onClick={() => handleStatusChange('completed')} disabled={submitting}>完成服务</Button>
          )}
          {order.status === 'pending_payment' && (
            <Button variant="destructive" onClick={() => handleStatusChange('cancelled')} disabled={submitting}>
              取消订单
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>商品明细</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {order.items.map(item => (
              <div key={`${item.productId}-${item.spec}`} className="flex items-start justify-between rounded-lg border p-4">
                <div className="space-y-1">
                  <p className="font-medium">{item.productName}</p>
                  <p className="text-sm text-muted-foreground">{item.spec}</p>
                  <p className="text-sm text-muted-foreground">数量 x {item.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">¥{formatMoney(item.totalPrice)}</p>
                  <p className="text-sm text-muted-foreground">单价 ¥{formatMoney(item.unitPrice)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>金额与提成</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">原价</span>
              <span>¥{formatMoney(order.pricing.originalAmount)}</span>
            </div>
            {(order.pricing as any).coupon && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">优惠券</span>
                <span className="text-green-600">-¥{formatMoney((order.pricing as any).coupon.discountAmount)} ({(order.pricing as any).coupon.couponName})</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">成交价</span>
              <span className="font-medium">¥{formatMoney(order.pricing.actualAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">提成状态</span>
              <span>{commissionStatusLabel[order.commission.status] || order.commission.status}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">提成金额</span>
              <span>¥{formatMoney(order.commission.amount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">退换货记录</span>
              <span>{order.returnRecordId ?? '无'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>收货与预约信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">收货人</p>
              <p>{order.shipping.address.name} · {order.shipping.address.phone}</p>
            </div>
            <div>
              <p className="text-muted-foreground">地址</p>
              <p>{order.shipping.address.full || '未填写'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">物流</p>
              <p>{order.shipping.company && order.shipping.trackingNo ? `${order.shipping.company} ${order.shipping.trackingNo}` : '未发货'}</p>
            </div>
            {order.shipping.abnormal?.flagged && (
              <div>
                <p className="text-muted-foreground">异常标记</p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    异常发货
                  </span>
                  <span className="text-sm text-muted-foreground">{order.shipping.abnormal.reason}</span>
                </div>
              </div>
            )}
            {order.shipping.urgent && (
              <div>
                <p className="text-muted-foreground">配送类型</p>
                <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                  加急配送
                </span>
              </div>
            )}
            {order.booking && (
              <>
                <div>
                  <p className="text-muted-foreground">预约时间</p>
                  <p>{order.booking.date}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">预约地点</p>
                  <p>{order.booking.location}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">预约联系人</p>
                  <p>{order.booking.contactName} · {order.booking.contactPhone}</p>
                </div>
              </>
            )}
            {order.remark && (
              <div>
                <p className="text-muted-foreground">备注</p>
                <p>{order.remark}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>时间线</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-muted-foreground">创建时间</p>
              <p>{formatDateTime(order.createdAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">最近更新时间</p>
              <p>{formatDateTime(order.updatedAt)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground">改价记录</p>
              {order.pricing.priceLog.length === 0 && <p>暂无改价记录</p>}
              {order.pricing.priceLog.map((log, index) => (
                <div key={`${log.operatedAt}-${index}`} className="rounded-lg border p-3">
                  <p>{log.operatorName} 将价格从 ¥{formatMoney(log.originalPrice)} 调整为 ¥{formatMoney(log.modifiedPrice)}</p>
                  <p className="text-muted-foreground">{formatDateTime(log.operatedAt)}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground">物流轨迹</p>
              {order.shipping.logistics.length === 0 && <p>暂无物流更新</p>}
              {order.shipping.logistics.map((log, index) => (
                <div key={`${log.time}-${index}`} className="rounded-lg border p-3">
                  <p>{log.description}</p>
                  <p className="text-muted-foreground">{formatDateTime(log.time)}{log.location ? ` · ${log.location}` : ''}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改订单价格</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>订单号</Label>
              <p className="text-sm font-mono">{order.orderNo || order.id}</p>
            </div>
            <div className="space-y-2">
              <Label>当前价格</Label>
              <p className="text-sm">¥{formatMoney(order.pricing.actualAmount)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="detailNewPrice">新价格</Label>
              <Input
                id="detailNewPrice"
                type="number"
                value={newPrice}
                onChange={e => setNewPrice(e.target.value)}
              />
            </div>
            {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>取消</Button>
            <Button onClick={handleAdjustPrice} disabled={submitting}>确认改价</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
