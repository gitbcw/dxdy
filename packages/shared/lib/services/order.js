"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrders = getOrders;
exports.getOrderById = getOrderById;
exports.createOrder = createOrder;
exports.adjustOrderPrice = adjustOrderPrice;
exports.updateOrderStatus = updateOrderStatus;
exports.updateOrderStatusWithLog = updateOrderStatusWithLog;
exports.cancelOrder = cancelOrder;
exports.shipOrder = shipOrder;
exports.confirmBooking = confirmBooking;
exports.getClerkOrders = getClerkOrders;
exports.getClerkOrderById = getClerkOrderById;
exports.clerkShipOrder = clerkShipOrder;
exports.setOrderReturnRecordId = setOrderReturnRecordId;
exports.getAllOrders = getAllOrders;
exports.assignOrderToClerk = assignOrderToClerk;
exports.assignOrderToClerkWithLog = assignOrderToClerkWithLog;
exports.createExchangeClerkOrder = createExchangeClerkOrder;
const index_1 = require("../mock/index");
const auth_1 = require("./auth");
const system_1 = require("./system");
let orders = [...index_1.mockOrders];
const delay = (ms = 200) => new Promise(r => setTimeout(r, ms));
/** 获取订单列表（按角色过滤） */
async function getOrders(options) {
    await delay();
    let result = orders;
    if (options?.customerId)
        result = result.filter(o => o.customerId === options.customerId);
    if (options?.salespersonId)
        result = result.filter(o => o.salespersonId === options.salespersonId);
    if (options?.clerkId)
        result = result.filter(o => o.clerkId === options.clerkId);
    if (options?.status)
        result = result.filter(o => o.status === options.status);
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
/** 获取订单详情 */
async function getOrderById(id) {
    await delay(100);
    return orders.find(o => o.id === id) ?? null;
}
/** 创建订单 */
async function createOrder(data) {
    await delay();
    const customers = (0, auth_1.getCustomers)();
    const customer = customers.find(c => c.id === data.customerId);
    const addr = customer?.addresses.find(a => a.isDefault);
    const shippingAddress = data.shippingAddress ?? (addr
        ? { name: addr.name, phone: addr.phone, full: `${addr.province}${addr.city}${addr.district}${addr.detail}` }
        : { name: '', phone: '', full: '' });
    const totalAmount = data.items.reduce((s, i) => s + i.totalPrice, 0);
    const order = {
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
async function adjustOrderPrice(orderId, newPrice, operatorId, operatorName, permissions) {
    await delay();
    // 权限校验
    if (permissions && permissions.order_price_adjust !== true) {
        return { success: false, error: '无改价权限' };
    }
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1)
        return { success: false, error: '订单不存在' };
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
    (0, system_1.addLog)({
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
async function updateOrderStatus(orderId, status) {
    await delay();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1)
        return null;
    orders[idx].status = status;
    orders[idx].updatedAt = new Date().toISOString();
    // 确认收货时触发提成锁定
    if (status === 'completed' && orders[idx].commission.status === 'pending') {
        orders[idx].commission.status = 'locked';
    }
    return orders[idx];
}
async function updateOrderStatusWithLog(orderId, status, operator) {
    const updated = await updateOrderStatus(orderId, status);
    if (!updated || !operator)
        return updated;
    const actionMap = {
        cancelled: '订单取消',
        confirmed: '预约确认',
        in_service: '预约开始服务',
        completed: updated.type === 'booking' ? '预约完成服务' : '订单完成',
        pending_receipt: '订单发货',
    };
    (0, system_1.addLog)({
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
async function cancelOrder(orderId) {
    return updateOrderStatus(orderId, 'cancelled');
}
/** 发货（制单员） */
async function shipOrder(orderId, trackingNo, company) {
    await delay();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1)
        return null;
    const order = orders[idx];
    order.shipping.trackingNo = trackingNo;
    order.shipping.company = company;
    order.shipping.logistics.push({ time: new Date().toISOString(), description: '已发货', location: '仓库' });
    order.status = order.type === 'booking' ? 'in_service' : 'pending_receipt';
    order.updatedAt = new Date().toISOString();
    return order;
}
/** 确认预约订单（制单员） */
async function confirmBooking(orderId) {
    return updateOrderStatus(orderId, 'confirmed');
}
// ========== 制单员订单服务 ==========
const clerk_orders_1 = require("../mock/clerk-orders");
/** 获取制单员订单列表 */
async function getClerkOrders(options) {
    await delay();
    if (!options?.status || options.status === 'all') {
        return [...clerk_orders_1.clerkPendingOrders, ...clerk_orders_1.clerkShippedOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    if (options.status === 'pending')
        return clerk_orders_1.clerkPendingOrders;
    return clerk_orders_1.clerkShippedOrders;
}
/** 获取制单员订单详情 */
async function getClerkOrderById(id) {
    await delay(100);
    return (clerk_orders_1.clerkPendingOrders.find(o => o.id === id) ??
        clerk_orders_1.clerkShippedOrders.find(o => o.id === id) ??
        null);
}
/** 制单员发货 — 同时更新制单员订单和主订单 */
async function clerkShipOrder(params) {
    await delay();
    const clerkOrder = clerk_orders_1.clerkPendingOrders.find(o => o.id === params.orderId);
    if (!clerkOrder)
        return { success: false };
    // 1. 更新制单员订单：移动到已发货列表
    const idx = clerk_orders_1.clerkPendingOrders.findIndex(o => o.id === params.orderId);
    if (idx !== -1) {
        const [shipped] = clerk_orders_1.clerkPendingOrders.splice(idx, 1);
        const updated = {
            ...shipped,
            status: 'shipped',
            shippedAt: new Date().toISOString(),
            expressCompany: params.expressCompany,
            expressNo: params.expressNo,
        };
        clerk_orders_1.clerkShippedOrders.push(updated);
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
function setOrderReturnRecordId(orderId, returnRecordId) {
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
        orders[idx] = { ...orders[idx], returnRecordId };
    }
}
/** 获取全部订单（后台用） */
async function getAllOrders() {
    await delay();
    return [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
/** 指派订单给制单员 — 同时在制单员待办列表创建条目 */
async function assignOrderToClerk(orderId, clerkId) {
    await delay();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1)
        return null;
    const order = orders[idx];
    // 普通订单状态：pending_shipment，预约订单状态：confirmed
    if (order.status !== 'pending_shipment' && order.status !== 'confirmed') {
        return null;
    }
    order.clerkId = clerkId;
    order.updatedAt = new Date().toISOString();
    // 同步创建制单员待办
    const existing = clerk_orders_1.clerkPendingOrders.find(c => c.mainOrderId === orderId);
    if (!existing) {
        const customer = (0, auth_1.getCustomers)().find(c => c.id === order.customerId);
        clerk_orders_1.clerkPendingOrders.push({
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
async function assignOrderToClerkWithLog(orderId, clerkId, operator) {
    const updated = await assignOrderToClerk(orderId, clerkId);
    if (!updated || !operator)
        return updated;
    (0, system_1.addLog)({
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
function createExchangeClerkOrder(params) {
    const existing = clerk_orders_1.clerkPendingOrders.find(c => c.mainOrderId === `exchange_${params.orderId}`);
    if (existing)
        return;
    clerk_orders_1.clerkPendingOrders.push({
        id: `clerk_exchange_${params.orderId}`,
        orderNo: `换货_${params.orderId}`,
        type: 'exchange',
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
//# sourceMappingURL=order.js.map