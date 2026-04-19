/** 充值优惠档位 */
export interface RechargeTier {
  amount: number;
  bonus: number;
  label?: string;
}

/** 系统配置 */
export interface SystemConfig {
  commissionRate: number; // 提成比例 (0-1)
  commissionLockDays: number; // 提成锁定天数
  minWithdrawAmount: number; // 最低提现金额
  withdrawReviewEnabled: boolean; // 提现审核开关
  paymentTimeoutMinutes: number; // 订单支付超时（分钟）
  returnDeadlineDays: number; // 退换货期限（天）
  returnAddress: string; // 退换货收货地址
  reviewTimeoutHours: number; // 审核超时提醒（小时）
  stockWarningThreshold: number; // 库存预警值
  pointsRate: number; // 积分获取比例（元:积分）
  pointsExpiryDays: number; // 积分有效期（天，0=永不过期）
  rechargeTiers: RechargeTier[]; // 充值优惠档位
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
export type NotificationType =
  | 'order'
  | 'return'
  | 'verification'
  | 'system'
  | 'commission';

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
export type ReturnStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'pending_return_ship'
  | 'returned'
  | 'verifying'
  | 'refunding'
  | 'return_completed'
  | 'exchange_shipping'
  | 'exchange_completed';

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
  sendLogistics: { trackingNo: string; company: string } | null;
  receiveLogistics: { trackingNo: string; company: string } | null;
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
