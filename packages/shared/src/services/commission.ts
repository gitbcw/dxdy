import type { CommissionRecord, WithdrawalRecord } from '../types/commission';
import { getSalespersons, setSalespersons } from './auth';

const delay = (ms = 200) => new Promise<void>(r => setTimeout(r, ms));

// 模拟提成记录
let commissionRecords: CommissionRecord[] = [
  {
    id: 'cmr_001',
    salespersonId: 'sp_001',
    orderId: 'ord_001',
    sourceType: 'order',
    amount: 420,
    balance: 420,
    description: '订单 ord_001 提成',
    createdAt: '2026-04-11',
  },
  {
    id: 'cmr_002',
    salespersonId: 'sp_001',
    orderId: 'ord_002',
    sourceType: 'order',
    amount: 580,
    balance: 1000,
    description: '订单 ord_002 提成（锁定中）',
    createdAt: '2026-04-14',
  },
  {
    id: 'cmr_003',
    salespersonId: 'sp_001',
    orderId: 'ord_005',
    sourceType: 'return_deduction',
    amount: -70,
    balance: 930,
    description: '退货扣减提成',
    createdAt: '2026-04-14',
  },
];

// 模拟提现记录
let withdrawalRecords: WithdrawalRecord[] = [
  {
    id: 'wd_001',
    salespersonId: 'sp_001',
    amount: 12000,
    bankCardId: 'bank_001',
    bankName: '招商银行',
    cardNo: '6225****8901',
    status: 'completed',
    reviewerId: 'admin_003',
    appliedAt: '2026-04-13',
    reviewedAt: '2026-04-13',
    completedAt: '2026-04-13',
  },
];

/** 获取业务员提成记录 */
export async function getCommissionRecords(salespersonId: string): Promise<CommissionRecord[]> {
  await delay();
  return commissionRecords.filter(r => r.salespersonId === salespersonId);
}

/** 获取业务员提现记录 */
export async function getWithdrawalRecords(salespersonId: string): Promise<WithdrawalRecord[]> {
  await delay();
  return withdrawalRecords.filter(r => r.salespersonId === salespersonId);
}

/** 申请提现 */
export async function requestWithdrawal(salespersonId: string, amount: number, bankCardId: string): Promise<WithdrawalRecord | null> {
  await delay();
  const salespersons = getSalespersons();
  const sp = salespersons.find(s => s.id === salespersonId);
  if (!sp || sp.commission.available < amount) return null;

  const bankCard = sp.bankCards.find(b => b.id === bankCardId);
  if (!bankCard) return null;

  sp.commission.available -= amount;
  sp.commission.withdrawn += amount;
  setSalespersons(salespersons);

  const record: WithdrawalRecord = {
    id: `wd_${Date.now().toString(36)}`,
    salespersonId,
    amount,
    bankCardId,
    bankName: bankCard.bankName,
    cardNo: bankCard.cardNo,
    status: 'pending_review',
    appliedAt: new Date().toISOString(),
  };
  withdrawalRecords.push(record);
  return record;
}

/** 获取全部提现记录（后台审核用） */
export async function getAllWithdrawals(): Promise<WithdrawalRecord[]> {
  await delay();
  return [...withdrawalRecords].sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
}

/** 审核提现 */
export async function reviewWithdrawal(id: string, approved: boolean, reviewerId: string): Promise<WithdrawalRecord | null> {
  await delay();
  const idx = withdrawalRecords.findIndex(w => w.id === id);
  if (idx === -1) return null;
  withdrawalRecords[idx].status = approved ? 'approved' : 'rejected';
  withdrawalRecords[idx].reviewerId = reviewerId;
  withdrawalRecords[idx].reviewedAt = new Date().toISOString();
  if (approved) withdrawalRecords[idx].completedAt = new Date().toISOString();
  return withdrawalRecords[idx];
}
