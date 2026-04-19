import type { CommissionRecord, WithdrawalRecord } from '../types/commission';
/** 获取业务员提成记录 */
export declare function getCommissionRecords(salespersonId: string): Promise<CommissionRecord[]>;
/** 获取业务员提现记录 */
export declare function getWithdrawalRecords(salespersonId: string): Promise<WithdrawalRecord[]>;
/** 申请提现 */
export declare function requestWithdrawal(salespersonId: string, amount: number, bankCardId: string): Promise<WithdrawalRecord | null>;
/** 获取全部提现记录（后台审核用） */
export declare function getAllWithdrawals(): Promise<WithdrawalRecord[]>;
/** 审核提现 */
export declare function reviewWithdrawal(id: string, approved: boolean, reviewerId: string): Promise<WithdrawalRecord | null>;
import type { CommissionSummary } from '../types/commission';
/** 业务员客户项 */
export interface SalesmanCustomer {
    id: string;
    nickname: string;
    type: 'personal' | 'institution';
    phone: string;
    orderCount: number;
    totalAmount: number;
    exchangeCount: number;
    boundAt: string;
}
/** 获取业务员客户列表 */
export declare function getSalesmanCustomers(): Promise<SalesmanCustomer[]>;
/** 获取佣金汇总 */
export declare function getCommissionSummary(): Promise<CommissionSummary>;
/** 申请提现（小程序简化版，不依赖 salespersonId） */
export declare function requestWithdrawalByAmount(params: {
    amount: number;
}): Promise<{
    success: boolean;
}>;
//# sourceMappingURL=commission.d.ts.map