"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReturns = getReturns;
exports.getReturnById = getReturnById;
exports.createReturn = createReturn;
exports.reviewReturn = reviewReturn;
exports.updateReturnStatus = updateReturnStatus;
exports.submitReturnLogistics = submitReturnLogistics;
exports.getAllReturns = getAllReturns;
const index_1 = require("../mock/index");
const order_1 = require("./order");
const order_2 = require("./order");
const system_1 = require("./system");
let returns = [...index_1.mockReturns];
const delay = (ms = 200) => new Promise(r => setTimeout(r, ms));
/** 获取退换货列表 */
async function getReturns(options) {
    await delay();
    let result = returns;
    if (options?.orderId)
        result = result.filter(r => r.orderId === options.orderId);
    if (options?.status)
        result = result.filter(r => r.status === options.status);
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
/** 获取退换货详情 */
async function getReturnById(id) {
    await delay(100);
    return returns.find(r => r.id === id) ?? null;
}
/** 创建退换货申请 */
async function createReturn(data) {
    await delay();
    const record = {
        id: `ret_${Date.now().toString(36)}`,
        orderId: data.orderId,
        type: data.type,
        status: 'pending_review',
        reason: data.reason,
        items: data.items,
        refundAmount: data.type === 'return' ? data.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) : undefined,
        exchangeItem: data.exchangeItem,
        sendLogistics: null,
        receiveLogistics: null,
        verificationResult: 'pending',
        commissionAdjust: { amount: 0, reason: '' },
        reviewerId: null,
        reviewNote: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    returns.push(record);
    // 回写订单的 returnRecordId
    (0, order_1.setOrderReturnRecordId)(data.orderId, record.id);
    return record;
}
/** 审核退换货 */
async function reviewReturn(id, approved, reviewerId, note) {
    await delay();
    const idx = returns.findIndex(r => r.id === id);
    if (idx === -1)
        return null;
    const record = returns[idx];
    record.reviewerId = reviewerId;
    record.reviewNote = note;
    record.status = approved ? 'approved' : 'rejected';
    record.updatedAt = new Date().toISOString();
    (0, system_1.addLog)({
        operatorId: reviewerId,
        operatorName: '客服',
        operatorRole: '客服',
        action: approved
            ? (record.type === 'exchange' ? '换货审核通过' : '退货审核通过')
            : (record.type === 'exchange' ? '换货审核拒绝' : '退货审核拒绝'),
        target: `退换货 ${id}（订单 ${record.orderId}）`,
        detail: note || '',
        result: 'success',
    });
    return record;
}
/** 更新退换货状态 */
async function updateReturnStatus(id, status) {
    await delay();
    const idx = returns.findIndex(r => r.id === id);
    if (idx === -1)
        return null;
    const record = returns[idx];
    record.status = status;
    record.updatedAt = new Date().toISOString();
    // 换货发货时，为制单员创建换货发货待办
    if (status === 'exchange_shipping' && record.type === 'exchange' && record.exchangeItem) {
        const order = await (0, order_2.getOrderById)(record.orderId);
        (0, order_1.createExchangeClerkOrder)({
            orderId: record.orderId,
            customerName: order?.customerName ?? '',
            customerPhone: '',
            address: order?.shipping.address?.full ?? '',
            exchangeItem: {
                productName: record.exchangeItem.productName,
                quantity: record.exchangeItem.quantity,
                spec: record.exchangeItem.spec,
            },
        });
    }
    return record;
}
/** 提交退货物流信息并更新状态 */
async function submitReturnLogistics(id, company, trackingNo) {
    await delay();
    const idx = returns.findIndex(r => r.id === id);
    if (idx === -1)
        return null;
    returns[idx].sendLogistics = { company, trackingNo };
    returns[idx].status = 'returned';
    returns[idx].updatedAt = new Date().toISOString();
    return returns[idx];
}
/** 获取全部退换货（后台用） */
async function getAllReturns() {
    await delay();
    return [...returns].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
//# sourceMappingURL=return.js.map