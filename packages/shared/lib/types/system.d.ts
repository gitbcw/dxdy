/** 充值优惠档位 */
export interface RechargeTier {
    amount: number;
    bonus: number;
    label?: string;
}
/** 系统配置 */
export interface SystemConfig {
    commissionRate: number;
    commissionLockDays: number;
    minWithdrawAmount: number;
    withdrawReviewEnabled: boolean;
    paymentTimeoutMinutes: number;
    returnDeadlineDays: number;
    returnAddress: string;
    reviewTimeoutHours: number;
    stockWarningThreshold: number;
    pointsRate: number;
    pointsExpiryDays: number;
    rechargeTiers: RechargeTier[];
}
/** 操作日志 */
export interface OperationLog {
    id: string;
    operatorId: string;
    operatorName: string;
    operatorRole: string;
    action: string;
    target: string;
    detail: string;
    result: 'success' | 'failure';
    ip?: string;
    createdAt: string;
}
/** 消息通知类型 */
export type NotificationType = 'order' | 'return' | 'verification' | 'system' | 'commission';
/** 消息通知 */
export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    content: string;
    targetUserId: string;
    isRead: boolean;
    relatedId?: string;
    createdAt: string;
}
/** 退换货类型 */
export type ReturnType = 'return' | 'exchange';
/** 退换货状态 */
export type ReturnStatus = 'pending_review' | 'approved' | 'rejected' | 'pending_return_ship' | 'returned' | 'verifying' | 'refunding' | 'return_completed' | 'exchange_shipping' | 'exchange_completed';
/** 退换货商品明细 */
export interface ReturnItem {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
}
/** 退换货记录 */
export interface ReturnRecord {
    id: string;
    orderId: string;
    type: ReturnType;
    status: ReturnStatus;
    reason: string;
    items: ReturnItem[];
    refundAmount?: number;
    exchangeItem?: {
        productId: string;
        productName: string;
        spec: string;
        quantity: number;
        unitPrice: number;
    };
    sendLogistics: {
        trackingNo: string;
        company: string;
    } | null;
    receiveLogistics: {
        trackingNo: string;
        company: string;
    } | null;
    verificationResult: 'pending' | 'qualified' | 'unqualified';
    commissionAdjust: {
        amount: number;
        reason: string;
    };
    reviewerId: string | null;
    reviewNote: string;
    createdAt: string;
    updatedAt: string;
}
//# sourceMappingURL=system.d.ts.map