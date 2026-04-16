import type { Order, OrderStatus, NormalOrderStatus, BookingOrderStatus, OrderItem } from '../types/order';
import type { Customer } from '../types/user';
import { mockOrders } from '../mock';
import { getCustomers } from './auth';

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
  remark?: string;
}): Promise<Order> {
  await delay();
  const customers = getCustomers();
  const customer = customers.find(c => c.id === data.customerId);
  const addr = customer?.addresses.find(a => a.isDefault);
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
      address: addr ? { name: addr.name, phone: addr.phone, full: `${addr.province}${addr.city}${addr.district}${addr.detail}` } : { name: '', phone: '', full: '' },
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

/** 改价（客服） */
export async function adjustOrderPrice(orderId: string, newPrice: number, operatorId: string, operatorName: string): Promise<Order | null> {
  await delay();
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx === -1) return null;
  const order = orders[idx];
  if (order.status !== 'pending_payment') return null;
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
  return order;
}

/** 更新订单状态 */
export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order | null> {
  await delay();
  const idx = orders.findIndex(o => o.id === orderId);
  if (idx === -1) return null;
  orders[idx].status = status;
  orders[idx].updatedAt = new Date().toISOString();
  return orders[idx];
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

/** 制单员发货（简化版） */
export async function clerkShipOrder(params: {
  orderId: string;
  expressCompany: string;
  expressNo: string;
}): Promise<{ success: boolean }> {
  await delay();
  const order = clerkPendingOrders.find(o => o.id === params.orderId);
  if (!order) return { success: false };
  // 移动到已发货列表
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
  return { success: true };
}

/** 获取全部订单（后台用） */
export async function getAllOrders(): Promise<Order[]> {
  await delay();
  return [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
