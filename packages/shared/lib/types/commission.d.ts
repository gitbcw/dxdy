export type CommissionSourceType = 'order' | 'return_deduction' | 'exchange_adjustment' | 'price_modification';
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
export type WithdrawalStatus = 'pending_review' | 'approved' | 'rejected' | 'completed';
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
export interface CommissionSummary {
    total: number;
    available: number;
    withdrawn: number;
    pendingDeduction: number;
    pendingLock: number;
}
//# sourceMappingURL=commission.d.ts.map