import type { ReturnRecord, ReturnStatus } from '../types/system';
import { mockReturns } from '../mock';

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
  return record;
}

/** 更新退换货状态 */
export async function updateReturnStatus(id: string, status: ReturnStatus): Promise<ReturnRecord | null> {
  await delay();
  const idx = returns.findIndex(r => r.id === id);
  if (idx === -1) return null;
  returns[idx].status = status;
  returns[idx].updatedAt = new Date().toISOString();
  return returns[idx];
}

/** 获取全部退换货（后台用） */
export async function getAllReturns(): Promise<ReturnRecord[]> {
  await delay();
  return [...returns].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
