import type { Order, OrderStatus, OrderItem } from '../types/order';
/** 获取订单列表（按角色过滤） */
export declare function getOrders(options?: {
    customerId?: string;
    salespersonId?: string;
    clerkId?: string;
    status?: OrderStatus;
}): Promise<Order[]>;
/** 获取订单详情 */
export declare function getOrderById(id: string): Promise<Order | null>;
/** 创建订单 */
export declare function createOrder(data: {
    customerId: string;
    items: OrderItem[];
    type: 'normal' | 'booking';
    booking?: Order['booking'];
    shippingAddress?: Order['shipping']['address'];
    remark?: string;
}): Promise<Order>;
/** 改价（客服）- 带权限校验 */
export declare function adjustOrderPrice(orderId: string, newPrice: number, operatorId: string, operatorName: string, permissions?: Record<string, boolean>): Promise<{
    success: boolean;
    order?: Order;
    error?: string;
}>;
/** 更新订单状态 */
export declare function updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order | null>;
export declare function updateOrderStatusWithLog(orderId: string, status: OrderStatus, operator?: {
    id: string;
    name: string;
    role: string;
}): Promise<Order | null>;
/** 取消订单 */
export declare function cancelOrder(orderId: string): Promise<Order | null>;
/** 发货（制单员） */
export declare function shipOrder(orderId: string, trackingNo: string, company: string): Promise<Order | null>;
/** 确认预约订单（制单员） */
export declare function confirmBooking(orderId: string): Promise<Order | null>;
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
    items: {
        name: string;
        quantity: number;
        specs: string;
    }[];
    createdAt: string;
    assignedAt: string;
    shippedAt?: string;
    expressCompany?: string;
    expressNo?: string;
    status: 'pending' | 'shipped';
}
/** 获取制单员订单列表 */
export declare function getClerkOrders(options?: {
    status?: 'pending' | 'shipped' | 'all';
}): Promise<ClerkOrder[]>;
/** 获取制单员订单详情 */
export declare function getClerkOrderById(id: string): Promise<ClerkOrder | null>;
/** 制单员发货 — 同时更新制单员订单和主订单 */
export declare function clerkShipOrder(params: {
    orderId: string;
    expressCompany: string;
    expressNo: string;
}): Promise<{
    success: boolean;
}>;
/** 回写订单的退换货记录 ID（供 return 服务调用） */
export declare function setOrderReturnRecordId(orderId: string, returnRecordId: string): void;
/** 获取全部订单（后台用） */
export declare function getAllOrders(): Promise<Order[]>;
/** 指派订单给制单员 — 同时在制单员待办列表创建条目 */
export declare function assignOrderToClerk(orderId: string, clerkId: string): Promise<Order | null>;
export declare function assignOrderToClerkWithLog(orderId: string, clerkId: string, operator?: {
    id: string;
    name: string;
    role: string;
}): Promise<Order | null>;
/** 创建换货制单员待办（供 return 服务调用） */
export declare function createExchangeClerkOrder(params: {
    orderId: string;
    customerName: string;
    customerPhone: string;
    address: string;
    exchangeItem: {
        productName: string;
        quantity: number;
        spec: string;
    };
}): void;
//# sourceMappingURL=order.d.ts.map