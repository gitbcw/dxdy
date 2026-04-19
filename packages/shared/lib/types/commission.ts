// 提成来源类型
export type CommissionSourceType =
  | 'order'
  | 'return_deduction'
  | 'exchange_adjustment'
  | 'price_modification';

// 提成记录
export interface CommissionRecord {
  id: string;
  salespersonId: string;
  orderId: string;
  sourceType: CommissionSourceType;
  amount: number;
  balance: number;
  description: string;
  createdAt: string;
}

// 提现状态
export type WithdrawalStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'completed';

// 提现记录
export interface WithdrawalRecord {
  id: string;
  salespersonId: string;
  amount: number;
  bankCardId: string;
  bankName: string;
  cardNo: string;
  status: WithdrawalStatus;
  reviewerId?: string;
  reviewNote?: string;
  appliedAt: string;
  reviewedAt?: string;
  completedAt?: string;
}

// 提成汇总
export interface CommissionSummary {
  total: number;
  available: number;
  withdrawn: number;
  pendingDeduction: number;
  pendingLock: number;
}
