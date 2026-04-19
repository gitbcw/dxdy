import type { ReturnRecord, ReturnStatus } from '../types/system';
import { mockReturns } from '../mock';
import { setOrderReturnRecordId, createExchangeClerkOrder } from './order';
import { getOrderById } from './order';
import { addLog } from './system';

let returns = [...mockReturns];

const delay = (ms = 200) => new Promise<void>(r => setTimeout(r, ms));

/** 获取退换货列表 */
export async function getReturns(options?: { orderId?: string; status?: ReturnStatus }): Promise<ReturnRecord[]> {
  await delay();
  let result = returns;
  if (options?.orderId) result = result.filter(r => r.orderId === options.orderId);
  if (options?.status) result = result.filter(r => r.status === options.status);
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 获取退换货详情 */
export async function getReturnById(id: string): Promise<ReturnRecord | null> {
  await delay(100);
  return returns.find(r => r.id === id) ?? null;
}

/** 创建退换货申请 */
export async function createReturn(data: {
  orderId: string;
  type: 'return' | 'exchange';
  reason: string;
  items: { productId: string; productName: string; quantity: number; unitPrice: number }[];
  exchangeItem?: ReturnRecord['exchangeItem'];
}): Promise<ReturnRecord> {
  await delay();
  const record: ReturnRecord = {
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
  setOrderReturnRecordId(data.orderId, record.id);

  return record;
}

/** 审核退换货 */
export async function reviewReturn(
  id: string,
  approved: boolean,
  reviewerId: string,
  note: string,
): Promise<ReturnRecord | null> {
  await delay();
  const idx = returns.findIndex(r => r.id === id);
  if (idx === -1) return null;
  const record = returns[idx];
  record.reviewerId = reviewerId;
  record.reviewNote = note;
  record.status = approved ? 'approved' : 'rejected';
  record.updatedAt = new Date().toISOString();

  addLog({
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
export async function updateReturnStatus(id: string, status: ReturnStatus): Promise<ReturnRecord | null> {
  await delay();
  const idx = returns.findIndex(r => r.id === id);
  if (idx === -1) return null;
  const record = returns[idx];
  record.status = status;
  record.updatedAt = new Date().toISOString();

  // 换货发货时，为制单员创建换货发货待办
  if (status === 'exchange_shipping' && record.type === 'exchange' && record.exchangeItem) {
    const order = await getOrderById(record.orderId);
    createExchangeClerkOrder({
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
export async function submitReturnLogistics(
  id: string,
  company: string,
  trackingNo: string,
): Promise<ReturnRecord | null> {
  await delay();
  const idx = returns.findIndex(r => r.id === id);
  if (idx === -1) return null;
  returns[idx].sendLogistics = { company, trackingNo };
  returns[idx].status = 'returned';
  returns[idx].updatedAt = new Date().toISOString();
  return returns[idx];
}

/** 获取全部退换货（后台用） */
export async function getAllReturns(): Promise<ReturnRecord[]> {
  await delay();
  return [...returns].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
