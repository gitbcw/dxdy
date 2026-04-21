'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  CreditCard,
  Handshake,
  PackageCheck,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getAllOrders,
  getAllProducts,
  getAllReturns,
  getCustomers,
  getSystemConfig,
  formatMoney,
} from '@dxdy/shared';
import type { AdminRole, AdminUser, Order, Product, ReturnRecord, SystemConfig } from '@dxdy/shared';

type DashboardState = {
  orders: Order[];
  products: Product[];
  returns: ReturnRecord[];
  config: SystemConfig | null;
};

type RolePanelItem = {
  title: string;
  badge: string;
  href: string;
};

function parseDateValue(value: string): Date | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`);
  }
  return new Date(value.replace(' ', 'T'));
}

function isSameDay(left: string, right: Date): boolean {
  const date = parseDateValue(left);
  if (!date) return false;
  return (
    date.getFullYear() === right.getFullYear() &&
    date.getMonth() === right.getMonth() &&
    date.getDate() === right.getDate()
  );
}

function isSameMonth(left: string, right: Date): boolean {
  const date = parseDateValue(left);
  if (!date) return false;
  return (
    date.getFullYear() === right.getFullYear() &&
    date.getMonth() === right.getMonth()
  );
}

function diffHours(from: string, to: Date): number {
  const date = parseDateValue(from);
  if (!date) return 0;
  return (to.getTime() - date.getTime()) / (1000 * 60 * 60);
}

function ratio(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export default function DashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<DashboardState>({
    orders: [],
    products: [],
    returns: [],
    config: null,
  });
  const [currentUser] = useState<AdminUser | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem('admin_user');
    if (!stored) return null;
    try {
      return JSON.parse(stored) as AdminUser;
    } catch {
      return null;
    }
  });

  const fallbackPath =
    currentUser?.role === 'product_manager'
      ? '/products'
      : '/orders';

  useEffect(() => {
    if (currentUser && currentUser.role !== 'system_admin') {
      router.replace(fallbackPath);
    }
  }, [currentUser, fallbackPath, router]);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'system_admin') return;

    async function load() {
      const [orders, returns, products, config] = await Promise.all([
        getAllOrders(),
        getAllReturns(),
        getAllProducts(),
        getSystemConfig(),
      ]);
      setState({ orders, returns, products, config });
    }

    load();
  }, [currentUser]);

  if (currentUser && currentUser.role !== 'system_admin') {
    return null;
  }

  const now = new Date();
  const customers = getCustomers();
  const customerMap = new Map(customers.map(customer => [customer.id, customer]));
  const stockWarningThreshold = state.config?.stockWarningThreshold ?? 10;

  const recognizedOrders = state.orders.filter(
    order => order.status !== 'pending_payment' && order.status !== 'cancelled',
  );
  const pendingPaymentOrders = state.orders.filter(order => order.status === 'pending_payment');
  const fulfillmentOrders = state.orders.filter(order =>
    ['pending_shipment', 'pending_receipt', 'pending_confirmation', 'confirmed', 'in_service'].includes(order.status),
  );
  const pendingShipmentOrders = state.orders.filter(order => order.status === 'pending_shipment');
  const pendingConfirmationOrders = state.orders.filter(
    order => order.type === 'booking' && order.status === 'pending_confirmation',
  );
  const priceAdjustedOrders = state.orders.filter(order => order.pricing.priceLog.length > 0);

  const institutionCustomers = customers.filter(customer => customer.customerType === 'institution');
  const personalCustomers = customers.filter(customer => customer.customerType === 'personal');
  const verifiedInstitutions = institutionCustomers.filter(
    customer => customer.verificationStatus === 'approved',
  );
  const pendingVerification = institutionCustomers.filter(
    customer => customer.verificationStatus === 'pending',
  );
  const rejectedVerification = institutionCustomers.filter(
    customer => customer.verificationStatus === 'rejected',
  );

  const lowStockProducts = state.products.filter(
    product => product.status === 'on_sale' && product.stock <= stockWarningThreshold,
  );
  const lowStockBloodProducts = lowStockProducts.filter(product => product.isBloodPack);
  const institutionOnlyProducts = state.products.filter(
    product => product.visibility === 'institution_only',
  );

  const openReturns = state.returns.filter(
    record => !['return_completed', 'exchange_completed', 'rejected'].includes(record.status),
  );
  const pendingReviewReturns = state.returns.filter(record => record.status === 'pending_review');
  const refundingAmount = openReturns.reduce((sum, record) => sum + (record.refundAmount ?? 0), 0);
  const refundAmountThisMonth = state.returns
    .filter(record => isSameMonth(record.updatedAt, now))
    .reduce((sum, record) => sum + (record.refundAmount ?? 0), 0);

  const todayRevenue = recognizedOrders
    .filter(order => isSameDay(order.createdAt, now))
    .reduce((sum, order) => sum + order.pricing.actualAmount, 0);
  const monthRevenue = recognizedOrders
    .filter(order => isSameMonth(order.createdAt, now))
    .reduce((sum, order) => sum + order.pricing.actualAmount, 0);
  const pendingPaymentAmount = pendingPaymentOrders.reduce(
    (sum, order) => sum + order.pricing.actualAmount,
    0,
  );
  const pendingCommissionOrders = state.orders.filter(order =>
    ['pending', 'locked'].includes(order.commission.status),
  );
  const pendingCommissionAmount = pendingCommissionOrders.reduce(
    (sum, order) => sum + order.commission.amount,
    0,
  );
  const overduePendingPaymentOrders = pendingPaymentOrders.filter(
    order =>
      diffHours(order.updatedAt || order.createdAt, now) >
      (state.config?.paymentTimeoutMinutes ?? 30) / 60,
  );
  const overdueFulfillmentOrders = fulfillmentOrders.filter(
    order => diffHours(order.updatedAt || order.createdAt, now) > 24,
  );
  const todayRecognizedOrders = recognizedOrders.filter(order => isSameDay(order.createdAt, now));

  const institutionRevenue = recognizedOrders
    .filter(order => customerMap.get(order.customerId)?.customerType === 'institution')
    .reduce((sum, order) => sum + order.pricing.actualAmount, 0);
  const personalRevenue = recognizedOrders
    .filter(order => customerMap.get(order.customerId)?.customerType === 'personal')
    .reduce((sum, order) => sum + order.pricing.actualAmount, 0);
  const totalRevenue = institutionRevenue + personalRevenue;

  const role: AdminRole | null = currentUser?.role ?? null;
  const roleTitle =
    role === 'service'
      ? '客服重点'
      : role === 'product_manager'
        ? '商品重点'
        : '今日重点';

  const rolePanelItems: RolePanelItem[] =
    role === 'service'
      ? [
          { title: '机构审核', badge: `${pendingVerification.length} 待审`, href: '/users' },
          { title: '改价跟进', badge: `${priceAdjustedOrders.length} 单`, href: '/orders' },
          { title: '售后处理', badge: `${pendingReviewReturns.length} 待审`, href: '/returns' },
        ]
      : role === 'product_manager'
        ? [
            { title: '库存预警', badge: `${lowStockProducts.length} 个`, href: '/products' },
            { title: '机构商品', badge: `${institutionOnlyProducts.length} 个`, href: '/products' },
            { title: '血液制品', badge: `${lowStockBloodProducts.length} 紧张`, href: '/products' },
          ]
        : [
            { title: '订单回款', badge: `${overduePendingPaymentOrders.length} 超时`, href: '/orders' },
            { title: '客户审核', badge: `${pendingVerification.length} 待审`, href: '/users' },
            { title: '售后风险', badge: `${openReturns.length} 条`, href: '/returns' },
          ];

  const kpis = [
    {
      title: '今日成交额',
      value: `¥${formatMoney(todayRevenue)}`,
      desc: `${todayRecognizedOrders.length} 单已进入成交或服务阶段`,
      icon: CreditCard,
    },
    {
      title: '本月成交额',
      value: `¥${formatMoney(monthRevenue)}`,
      desc: `机构 ¥${formatMoney(institutionRevenue)} / 个人 ¥${formatMoney(personalRevenue)}`,
      icon: Activity,
    },
    {
      title: '待支付金额',
      value: `¥${formatMoney(pendingPaymentAmount)}`,
      desc: `${pendingPaymentOrders.length} 单待支付，${overduePendingPaymentOrders.length} 单超时`,
      icon: ShoppingCart,
    },
    {
      title: '待结算提成',
      value: `¥${formatMoney(pendingCommissionAmount)}`,
      desc: `${pendingCommissionOrders.length} 单待锁定或结算`,
      icon: Handshake,
    },
  ];

  const topAttentionItems = [
    {
      title: '待支付回款',
      value: `¥${formatMoney(pendingPaymentAmount)}`,
      desc: `${pendingPaymentOrders.length} 单待支付，${overduePendingPaymentOrders.length} 单超支付时限`,
      href: '/orders',
      badge: '回款',
      icon: CreditCard,
    },
    {
      title: '履约积压',
      value: `${fulfillmentOrders.length} 单`,
      desc: `${pendingShipmentOrders.length} 单待发货，${pendingConfirmationOrders.length} 单预约待确认`,
      href: '/orders',
      badge: overdueFulfillmentOrders.length > 0 ? `${overdueFulfillmentOrders.length} 超时` : '履约',
      icon: Truck,
    },
    {
      title: '售后退款',
      value: `¥${formatMoney(refundingAmount)}`,
      desc: `${openReturns.length} 条处理中，本月退款 ¥${formatMoney(refundAmountThisMonth)}`,
      href: '/returns',
      badge: `${pendingReviewReturns.length} 待审`,
      icon: Handshake,
    },
    {
      title: '库存预警',
      value: `${lowStockProducts.length} 个`,
      desc: `${lowStockBloodProducts.length} 个血液制品预警，阈值 ${stockWarningThreshold}`,
      href: '/products',
      badge: '库存',
      icon: PackageCheck,
    },
  ];

  return (
    <div className="space-y-4 bg-[radial-gradient(circle_at_top_left,rgba(7,95,103,0.10),transparent_28%),linear-gradient(180deg,#f4faf9_0%,#ffffff_40%)]">
      <Card className="border-teal-950/10 bg-white/92 shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-teal-700/10 text-teal-900">今日经营摘要</Badge>
                <Badge variant="outline">{currentUser ? currentUser.realName : '未识别角色'}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                <span>
                  本月成交 <span className="font-semibold text-slate-950">¥{formatMoney(monthRevenue)}</span>
                </span>
                <span>
                  机构占比 <span className="font-semibold text-slate-950">{ratio(institutionRevenue, totalRevenue)}%</span>
                </span>
                <span>
                  履约中 <span className="font-semibold text-slate-950">{fulfillmentOrders.length}</span> 单
                </span>
                <span>
                  售后中 <span className="font-semibold text-slate-950">{openReturns.length}</span> 条
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">{roleTitle}</span>
              {rolePanelItems.map(item => (
                <Link
                  key={item.title}
                  href={item.href}
                  className="rounded-full border bg-slate-50 px-3 py-1.5 text-xs text-slate-700 transition hover:border-teal-700/30 hover:text-slate-950"
                >
                  {item.title} · {item.badge}
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">客户结构</p>
              <p className="mt-1.5 text-xl font-semibold">{customers.length}</p>
              <p className="mt-1 text-xs text-slate-600">
                机构 {institutionCustomers.length} 家 / 个人 {personalCustomers.length} 位
              </p>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">机构审核</p>
              <p className="mt-1.5 text-xl font-semibold">{verifiedInstitutions.length}</p>
              <p className="mt-1 text-xs text-slate-600">
                待审核 {pendingVerification.length} 家 / 驳回 {rejectedVerification.length} 家
              </p>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">库存风险</p>
              <p className="mt-1.5 text-xl font-semibold">{lowStockProducts.length}</p>
              <p className="mt-1 text-xs text-slate-600">
                血液制品 {lowStockBloodProducts.length} 个 / 预警阈值 {stockWarningThreshold}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map(item => (
          <Card key={item.title} className="border-teal-950/10 bg-white/90 shadow-sm">
            <CardContent className="flex items-start gap-3 p-4">
              <div className="rounded-2xl bg-teal-700/10 p-2.5 text-teal-800">
                <item.icon className="size-4" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{item.title}</p>
                <p className="mt-1 text-xl font-semibold tracking-tight">{item.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {topAttentionItems.map(item => (
          <Card key={item.title} className="border-teal-950/10 bg-white/95 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
                    <item.icon className="size-4" />
                  </div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </div>
                <Badge variant="outline">{item.badge}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Link href={item.href} className="block transition hover:text-teal-800">
                <p className="text-xl font-semibold tracking-tight">{item.value}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.desc}</p>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
