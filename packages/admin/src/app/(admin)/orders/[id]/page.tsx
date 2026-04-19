'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getOrderById, adjustOrderPrice, updateOrderStatusWithLog } from '@dxdy/shared';
import { formatDateTime, formatMoney } from '@dxdy/shared';
import type { AdminUser, Order, OrderStatus } from '@dxdy/shared';

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

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!params?.id) return;
    getOrderById(params.id).then(setOrder);
    const stored = localStorage.getItem('admin_user');
    if (stored) {
      try {
        setAdminUser(JSON.parse(stored) as AdminUser);
      } catch {
        // ignore parse failure
      }
    }
  }, [params?.id]);

  async function refreshOrder() {
    if (!params?.id) return;
    const latest = await getOrderById(params.id);
    setOrder(latest);
  }

  async function handleAdjustPrice() {
    if (!order || !newPrice || !adminUser) return;
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) return;
    if (price > order.pricing.actualAmount) {
      setErrorMsg('改价只能低于原价');
      return;
    }

    const result = await adjustOrderPrice(
      order.id,
      price,
      adminUser.id,
      adminUser.realName,
      adminUser.permissions,
    );

    if (result.success && result.order) {
      setOrder(result.order);
      setAdjustOpen(false);
      setNewPrice('');
      setErrorMsg('');
      return;
    }

    setErrorMsg(result.error || '改价失败');
  }

  async function handleStatusChange(nextStatus: OrderStatus) {
    if (!order || !adminUser) return;
    const updated = await updateOrderStatusWithLog(order.id, nextStatus, {
      id: adminUser.id,
      name: adminUser.realName,
      role: adminUser.role,
    });
    if (updated) {
      setOrder(updated);
    }
  }

  if (!order) {
    return <div className="text-sm text-muted-foreground">订单不存在或已删除。</div>;
  }

  const canAdjust = order.status === 'pending_payment' && adminUser?.permissions?.order_price_adjust;

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
            {order.id} · {order.customerName} · {order.type === 'booking' ? '预约订单' : '普通订单'}
          </p>
        </div>
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
            <Button onClick={() => handleStatusChange('confirmed')}>确认预约</Button>
          )}
          {order.type === 'booking' && order.status === 'confirmed' && (
            <Button onClick={() => handleStatusChange('in_service')}>开始服务</Button>
          )}
          {order.type === 'booking' && order.status === 'in_service' && (
            <Button onClick={() => handleStatusChange('completed')}>完成服务</Button>
          )}
          {order.status === 'pending_payment' && (
            <Button variant="destructive" onClick={() => handleStatusChange('cancelled')}>
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
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">成交价</span>
              <span className="font-medium">¥{formatMoney(order.pricing.actualAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">提成状态</span>
              <span>{order.commission.status}</span>
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
              <p className="text-sm font-mono">{order.id}</p>
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
            <Button onClick={handleAdjustPrice}>确认改价</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
