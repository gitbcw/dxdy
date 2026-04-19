'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  CreditCard,
  Handshake,
  PackageCheck,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getAllOrders,
  getAllProducts,
  getAllReturns,
  getCustomers,
  getOperationLogs,
  formatMoney,
} from '@dxdy/shared';
import type { OperationLog, Order, Product, ReturnRecord } from '@dxdy/shared';

type DashboardState = {
  orders: Order[];
  products: Product[];
  returns: ReturnRecord[];
  logs: OperationLog[];
};

const flowSteps = [
  { key: 'registered', label: '注册/认证', desc: '宠物医院身份与业务员绑定' },
  { key: 'priced', label: '分层选品', desc: '机构价、个人价、血液制品可见性' },
  { key: 'ordered', label: '下单/预约', desc: '普通药品采购与宠物用血预约' },
  { key: 'handled', label: '客服处理', desc: '改价、审核、指派制单员' },
  { key: 'fulfilled', label: '制单发货', desc: '录入快递与冷链物流同步' },
  { key: 'settled', label: '售后/提成', desc: '退换货影响提成自动调整' },
];

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState>({
    orders: [],
    products: [],
    returns: [],
    logs: [],
  });

  useEffect(() => {
    async function load() {
      const [orders, returns, products, logs] = await Promise.all([
        getAllOrders(),
        getAllReturns(),
        getAllProducts(),
        getOperationLogs({ limit: 6 }),
      ]);
      setState({ orders, returns, products, logs });
    }
    load();
  }, []);

  const customers = getCustomers();
  const institutionCount = customers.filter(c => c.customerType === 'institution').length;
  const personalCount = customers.filter(c => c.customerType === 'personal').length;
  const verifiedInstitutions = customers.filter(
    c => c.customerType === 'institution' && c.verificationStatus === 'approved',
  ).length;
  const pendingVerification = customers.filter(c => c.verificationStatus === 'pending').length;
  const pendingPayment = state.orders.filter(o => o.status === 'pending_payment').length;
  const pendingShipment = state.orders.filter(o => o.status === 'pending_shipment').length;
  const bookingTodo = state.orders.filter(o => o.type === 'booking' && o.status === 'pending_confirmation').length;
  const returnTodo = state.returns.filter(r => r.status === 'pending_review').length;
  const lowStock = state.products.filter(p => p.status === 'on_sale' && p.stock <= 10);
  const bloodProducts = state.products.filter(p => p.visibility === 'institution_only' && p.status === 'on_sale');
  const adjustedOrders = state.orders.filter(o => o.pricing.priceLog.length > 0);
  const revenue = state.orders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, order) => sum + order.pricing.actualAmount, 0);
  const commissionRisk = state.returns.reduce((sum, record) => sum + Math.abs(record.commissionAdjust.amount), 0);

  const kpis = [
    {
      title: '业务闭环订单',
      value: state.orders.length,
      desc: `${pendingPayment} 待支付 / ${pendingShipment} 待发货 / ${bookingTodo} 预约待确认`,
      icon: Activity,
    },
    {
      title: '宠物医院客户',
      value: institutionCount,
      desc: `${verifiedInstitutions} 家已认证，${pendingVerification} 家待审核`,
      icon: ShieldCheck,
    },
    {
      title: '可演示交易额',
      value: `¥${formatMoney(revenue)}`,
      desc: `含 ${personalCount} 位个人宠物客户和机构采购`,
      icon: CreditCard,
    },
    {
      title: '售后提成影响',
      value: `¥${formatMoney(commissionRisk)}`,
      desc: `${returnTodo} 条退换货待客服处理`,
      icon: Handshake,
    },
  ];

  const demoTasks = [
    {
      title: '待支付订单改价',
      desc: adjustedOrders[0]
        ? `${adjustedOrders[0].customerName} 已有改价记录，可演示通知与日志`
        : '客服可对待支付订单降价并重置支付倒计时',
      href: '/orders',
      badge: `${pendingPayment} 单`,
      icon: CreditCard,
    },
    {
      title: '宠物血液预约确认',
      desc: bloodProducts.length > 0
        ? `${bloodProducts.length} 个机构专属血液制品，仅认证医院可见`
        : '机构客户完成认证后解锁宠物血液制品',
      href: '/products',
      badge: '机构专属',
      icon: ClipboardCheck,
    },
    {
      title: '制单发货与冷链同步',
      desc: `${pendingShipment} 笔待发货订单可指派制单员，录入快递后同步客户小程序`,
      href: '/orders',
      badge: `${pendingShipment} 单`,
      icon: Truck,
    },
    {
      title: '退换货影响提成',
      desc: `售后审核后自动调整业务员提成，当前待处理 ${returnTodo} 条`,
      href: '/returns',
      badge: `¥${formatMoney(commissionRisk)}`,
      icon: PackageCheck,
    },
  ];

  return (
    <div className="min-h-[calc(100vh-6rem)] space-y-6 bg-[radial-gradient(circle_at_top_left,rgba(7,95,103,0.12),transparent_34%),linear-gradient(180deg,#f7fbfa_0%,#ffffff_42%)]">
      <section className="overflow-hidden rounded-[2rem] border border-teal-900/10 bg-slate-950 text-white shadow-2xl shadow-teal-950/20">
        <div className="grid gap-8 p-8 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-6">
            <Badge className="w-fit bg-teal-400/15 text-teal-100 ring-1 ring-teal-200/20">
              宠物医疗供应链 Demo 驾驶舱
            </Badge>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight">
                从宠物医院采购、用血预约到发货售后，一条业务线闭环演示。
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300">
                这个后台用于辅助老板看全局：客户是否完成认证、订单是否推进、宠物血液制品是否受控、退换货是否影响业务员提成。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button className="bg-teal-300 text-slate-950 hover:bg-teal-200" nativeButton={false} render={<Link href="/orders" />}>
                查看订单闭环 <ArrowRight />
              </Button>
              <Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10" nativeButton={false} render={<Link href="/products" />}>
                查看商品分层
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/8 p-5 backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-slate-300">今日演示重点</span>
              <Badge className="bg-amber-300 text-slate-950">老板视角</Badge>
            </div>
            <div className="space-y-3">
              {demoTasks.slice(0, 3).map(task => (
                <Link
                  key={task.title}
                  href={task.href}
                  className="flex items-start gap-3 rounded-2xl bg-white/10 p-3 transition hover:bg-white/15"
                >
                  <task.icon className="mt-1 size-4 text-teal-200" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{task.title}</p>
                      <span className="text-xs text-amber-200">{task.badge}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-300">{task.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map(item => (
          <Card key={item.title} className="border-teal-950/10 bg-white/90 shadow-sm">
            <CardContent className="flex items-start gap-4 p-5">
              <div className="rounded-2xl bg-teal-700/10 p-3 text-teal-800">
                <item.icon className="size-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{item.title}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">{item.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-teal-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-5 text-teal-700" />
              端到端业务流程
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              {flowSteps.map((step, index) => (
                <div key={step.key} className="relative rounded-2xl border bg-gradient-to-b from-white to-teal-50/50 p-4">
                  <div className="mb-3 flex size-8 items-center justify-center rounded-full bg-teal-800 text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <p className="font-medium">{step.label}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{step.desc}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-teal-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600" />
              需要老板关注的异常
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: '低库存商品', value: lowStock.length, desc: lowStock.slice(0, 2).map(p => p.name).join('、') || '暂无' },
              { label: '待审核机构', value: pendingVerification, desc: '影响机构价和宠物血液制品可见性' },
              { label: '待处理售后', value: returnTodo, desc: '处理结果会同步影响提成' },
            ].map(item => (
              <div key={item.label} className="rounded-2xl border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{item.label}</p>
                  <Badge variant={item.value > 0 ? 'default' : 'secondary'}>{item.value}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-teal-950/10">
          <CardHeader>
            <CardTitle>演示场景入口</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {demoTasks.map(task => (
              <Link key={task.title} href={task.href} className="rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5 hover:border-teal-700/40 hover:shadow-md">
                <div className="mb-4 flex items-center justify-between">
                  <div className="rounded-xl bg-teal-700/10 p-2 text-teal-800">
                    <task.icon className="size-4" />
                  </div>
                  <Badge variant="outline">{task.badge}</Badge>
                </div>
                <p className="font-medium">{task.title}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{task.desc}</p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border-teal-950/10">
          <CardHeader>
            <CardTitle>最近关键日志</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.logs.map(log => (
              <div key={log.id} className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{log.action}</p>
                  <span className="text-xs text-muted-foreground">{log.createdAt}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{log.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
