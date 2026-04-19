import type { Order, OrderStatus, NormalOrderStatus, BookingOrderStatus, OrderItem } from '../types/order';
import type { Customer } from '../types/user';
import { mockOrders } from '../mock/index';
import { getCustomers } from './auth';
import { addLog } from './system';

let orders = [...mockOrders];

const delay = (ms = 200) => new Promise<void>(r => setTimeout(r, ms));

/** 获取订单列表（按角色过滤） */
export async function getOrders(options?: {
  customerId?: string;
  salespersonId?: string;
  clerkId?: string;
  status?: OrderStatus;
}): Promise<Order[]> {
  await delay();
  let result = orders;
  if (options?.customerId) result = result.filter(o => o.customerId === options.customerId);
  if (options?.salespersonId) result = result.filter(o => o.salespersonId === options.salespersonId);
  if (options?.clerkId) result = result.filter(o => o.clerkId === options.clerkId);
  if (options?.status) result = result.filter(o => o.status === options.status);
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 获取订单详情 */
export async function getOrderById(id: string): Promise<Order | null> {
  await delay(100);
  return orders.find(o => o.id === id) ?? null;
}

/** 创建订单 */
export async function createOrder(data: {
  customerId: string;
  items: OrderItem[];
  type: 'normal' | 'booking';
  booking?: Order['booking'];
  shippingAddress?: Order['shipping']['address'];
  remark?: string;
}): Promise<Order> {
  await delay();
  const customers = getCustomers();
  const customer = customers.find(c => c.id === data.customerId);
  const addr = customer?.addresses.find(a => a.isDefault);
  const shippingAddress = data.shippingAddress ?? (
    addr
      ? { name: addr.name, phone: addr.phone, full: `${addr.province}${addr.city}${addr.district}${addr.detail}` }
      : { name: '', phone: '', full: '' }
  );
  const totalAmount = data.items.reduce((s, i) => s + i.totalPrice, 0);

  const order: Order = {
    id: `ord_${Date.now().toString(36)}`,
    type: data.type,
    status: 'pending_payment',
    customerId: data.customerId,
    customerName: customer?.nickname ?? '',
    salespersonId: customer?.boundSalespersonId ?? '',
    clerkId: null,
    items: data.items,
    pricing: { originalAmount: totalAmount, actualAmount: totalAmount, priceLog: [] },
    shipping: {
      address: shippingAddress,
      trackingNo: null,
      company: null,
      logistics: [],
    },
    booking: data.booking,
    returnRecordId: null,
    commission: { status: 'pending', amount: Math.round(totalAmount * 0.2 * 100) / 100, settledAt: null },
    remark: data.remark,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  orders.push(order);
  return order;
}

/** 改价（客服）- 带权限校验 */
export async function adjustOrderPrice(
  orderId: string,
  newPrice: number,
  operatorId: string,
  operatorName: string,
  permissions?: Record<string, boolean>,
): Promise<{ success: boolean; order?: Order; error?: string }> {
  await delay();

  // 权限校验
  if (permissions && permissions.order_price_adjust !== true) {
    return { success: false, error: '无改价权限' };
  }

  const idx = orders.findIndex(o => o.id === orderId);
  if (idx === -1) return { success: false, error: '订单不存在' };
  const order = orders[idx];

  // 价格校验：只能降价
  if (newPrice > order.pricing.actualAmount) {
    return { success: false, error: '改价只能低于原价' };
  }

  if (order.status !== 'pending_payment') {
    return { success: false, error: '仅待支付订单可改价' };
  }

  // 记录改价日志
  order.pricing.priceLog.push({
    originalPrice: order.pricing.actualAmount,
    modifiedPrice: newPrice,
    operatorId,
    operatorName,
    operatedAt: new Date().toISOString(),
  });
  order.pricing.actualAmount = newPrice;
  order.commission.amount = Math.round(newPrice * 0.2 * 100) / 100;
  order.updatedAt = new Date().toISOString();

  addLog({
    operatorId,
    operatorName,
    operatorRole: '客服',
    action: '订单改价',
    target: `订单 ${orderId}`,
    detail: `¥${order.pricing.priceLog[order.pricing.priceLog.length - 1].originalPrice} → ¥${newPrice}`,
    result: 'success',
  });

  return { success: true, order };
}

/** 更新订单状态 */
export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order | null> {
  await delay();
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx === -1) return null;
  orders[idx].status = status;
  orders[idx].updatedAt = new Date().toISOString();

  // 确认收货时触发提成锁定
  if (status === 'completed' && orders[idx].commission.status === 'pending') {
    orders[idx].commission.status = 'locked';
  }

  return orders[idx];
}

export async function updateOrderStatusWithLog(
  orderId: string,
  status: OrderStatus,
  operator?: {
    id: string;
    name: string;
    role: string;
  },
): Promise<Order | null> {
  const updated = await updateOrderStatus(orderId, status);
  if (!updated || !operator) return updated;

  const actionMap: Partial<Record<OrderStatus, string>> = {
    cancelled: '订单取消',
    confirmed: '预约确认',
    in_service: '预约开始服务',
    completed: updated.type === 'booking' ? '预约完成服务' : '订单完成',
    pending_receipt: '订单发货',
  };

  addLog({
    operatorId: operator.id,
    operatorName: operator.name,
    operatorRole: operator.role,
    action: actionMap[status] ?? '订单状态更新',
    target: `订单 ${orderId}`,
    detail: `状态更新为「${status}」`,
    result: 'success',
  });

  return updated;
}

/** 取消订单 */
export async function cancelOrder(orderId: string): Promise<Order | null> {
  return updateOrderStatus(orderId, 'cancelled');
}

/** 发货（制单员） */
export async function shipOrder(orderId: string, trackingNo: string, company: string): Promise<Order | null> {
  await delay();
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx === -1) return null;
  const order = orders[idx];
  order.shipping.trackingNo = trackingNo;
  order.shipping.company = company;
  order.shipping.logistics.push({ time: new Date().toISOString(), description: '已发货', location: '仓库' });
  order.status = order.type === 'booking' ? 'in_service' : 'pending_receipt';
  order.updatedAt = new Date().toISOString();
  return order;
}

/** 确认预约订单（制单员） */
export async function confirmBooking(orderId: string): Promise<Order | null> {
  return updateOrderStatus(orderId, 'confirmed');
}

// ========== 制单员订单服务 ==========

import { clerkPendingOrders, clerkShippedOrders } from '../mock/clerk-orders';

/** 制单员订单项 */
export interface ClerkOrder {
  id: string;
  orderNo: string;
  type: 'normal' | 'exchange';
  originalOrderNo?: string;
  mainOrderId?: string;
  customerName: string;
  customerPhone: string;
  address: string;
  items: { name: string; quantity: number; specs: string }[];
  createdAt: string;
  assignedAt: string;
  shippedAt?: string;
  expressCompany?: string;
  expressNo?: string;
  status: 'pending' | 'shipped';
}

/** 获取制单员订单列表 */
export async function getClerkOrders(options?: {
  status?: 'pending' | 'shipped' | 'all';
}): Promise<ClerkOrder[]> {
  await delay();
  if (!options?.status || options.status === 'all') {
    return ([...clerkPendingOrders, ...clerkShippedOrders] as ClerkOrder[]).sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt)
    );
  }
  if (options.status === 'pending') return clerkPendingOrders as ClerkOrder[];
  return clerkShippedOrders as ClerkOrder[];
}

/** 获取制单员订单详情 */
export async function getClerkOrderById(id: string): Promise<ClerkOrder | null> {
  await delay(100);
  return (
    (clerkPendingOrders.find(o => o.id === id) as ClerkOrder | undefined) ??
    (clerkShippedOrders.find(o => o.id === id) as ClerkOrder | undefined) ??
    null
  );
}

/** 制单员发货 — 同时更新制单员订单和主订单 */
export async function clerkShipOrder(params: {
  orderId: string;
  expressCompany: string;
  expressNo: string;
}): Promise<{ success: boolean }> {
  await delay();
  const clerkOrder = clerkPendingOrders.find(o => o.id === params.orderId);
  if (!clerkOrder) return { success: false };

  // 1. 更新制单员订单：移动到已发货列表
  const idx = clerkPendingOrders.findIndex(o => o.id === params.orderId);
  if (idx !== -1) {
    const [shipped] = clerkPendingOrders.splice(idx, 1);
    const updated: ClerkOrder = {
      ...shipped,
      status: 'shipped',
      shippedAt: new Date().toISOString(),
      expressCompany: params.expressCompany,
      expressNo: params.expressNo,
    } as ClerkOrder;
    clerkShippedOrders.push(updated);
  }

  // 2. 同步更新主订单
  const mainId = clerkOrder.mainOrderId;
  if (mainId) {
    const mainIdx = orders.findIndex(o => o.id === mainId);
    if (mainIdx !== -1) {
      const mainOrder = orders[mainIdx];
      mainOrder.shipping.trackingNo = params.expressNo;
      mainOrder.shipping.company = params.expressCompany;
      mainOrder.shipping.logistics.push({
        time: new Date().toISOString(),
        description: '已发货',
        location: '仓库',
      });
      mainOrder.status = mainOrder.type === 'booking' ? 'in_service' : 'pending_receipt';
      mainOrder.updatedAt = new Date().toISOString();
    }
  }

  return { success: true };
}

/** 回写订单的退换货记录 ID（供 return 服务调用） */
export function setOrderReturnRecordId(orderId: string, returnRecordId: string): void {
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx !== -1) {
    orders[idx] = { ...orders[idx], returnRecordId };
  }
}

/** 获取全部订单（后台用） */
export async function getAllOrders(): Promise<Order[]> {
  await delay();
  return [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 指派订单给制单员 — 同时在制单员待办列表创建条目 */
export async function assignOrderToClerk(orderId: string, clerkId: string): Promise<Order | null> {
  await delay();
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx === -1) return null;
  const order = orders[idx];
  // 普通订单状态：pending_shipment，预约订单状态：confirmed
  if (order.status !== 'pending_shipment' && order.status !== 'confirmed') {
    return null;
  }
  order.clerkId = clerkId;
  order.updatedAt = new Date().toISOString();

  // 同步创建制单员待办
  const existing = clerkPendingOrders.find(c => c.mainOrderId === orderId);
  if (!existing) {
    const customer = getCustomers().find(c => c.id === order.customerId);
    clerkPendingOrders.push({
      id: `clerk_${orderId}`,
      orderNo: orderId,
      type: order.type === 'booking' ? 'normal' : 'normal',
      mainOrderId: orderId,
      customerName: order.customerName ?? customer?.nickname ?? '',
      customerPhone: customer?.phone ?? '',
      address: order.shipping.address
        ? `${order.shipping.address.full}`
        : '',
      items: order.items.map(i => ({
        name: i.productName,
        quantity: i.quantity,
        specs: i.spec,
      })),
      createdAt: order.createdAt,
      assignedAt: new Date().toISOString(),
      status: 'pending',
    });
  }

  return order;
}

export async function assignOrderToClerkWithLog(
  orderId: string,
  clerkId: string,
  operator?: {
    id: string;
    name: string;
    role: string;
  },
): Promise<Order | null> {
  const updated = await assignOrderToClerk(orderId, clerkId);
  if (!updated || !operator) return updated;

  addLog({
    operatorId: operator.id,
    operatorName: operator.name,
    operatorRole: operator.role,
    action: '订单指派制单员',
    target: `订单 ${orderId}`,
    detail: `指派给制单员 ${clerkId}`,
    result: 'success',
  });

  return updated;
}

/** 创建换货制单员待办（供 return 服务调用） */
export function createExchangeClerkOrder(params: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  exchangeItem: { productName: string; quantity: number; spec: string };
}): void {
  const existing = clerkPendingOrders.find(
    c => c.mainOrderId === `exchange_${params.orderId}`,
  );
  if (existing) return;
  clerkPendingOrders.push({
    id: `clerk_exchange_${params.orderId}`,
    orderNo: `换货_${params.orderId}`,
    type: 'exchange' as any,
    mainOrderId: `exchange_${params.orderId}`,
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    address: params.address,
    items: [{
      name: params.exchangeItem.productName,
      quantity: params.exchangeItem.quantity,
      specs: params.exchangeItem.spec,
    }],
    createdAt: new Date().toISOString(),
    assignedAt: new Date().toISOString(),
    status: 'pending',
  });
}
