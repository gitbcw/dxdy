// ============================================================
// 类型定义 — 从 @dxdy/shared 迁移，仅保留 admin 后台所需
// ============================================================

// --- 用户 ---

export type UserRole = 'customer' | 'salesperson' | 'clerk' | 'admin';
export type VerificationStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  phone: string;
  nickname: string;
  avatar: string;
  role: UserRole;
  createdAt: string;
}

export interface Address {
  id: string;
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  isDefault: boolean;
}

export interface Customer extends User {
  role: 'customer';
  customerType: 'institution' | 'personal';
  verificationStatus: VerificationStatus;
  verificationInfo?: {
    businessLicense: string;
    contactName: string;
    contactPhone: string;
    rejectReason?: string;
  };
  boundSalespersonId: string | null;
  wallet: { balance: number; rechargeHistory: { id: string; amount: number; bonus: number; createdAt: string }[] };
  points: { balance: number; history: { id: string; change: number; balance: number; reason: string; createdAt: string }[] };
  addresses: Address[];
}

export interface Salesperson extends User {
  role: 'salesperson';
  verificationStatus: VerificationStatus;
  verificationInfo: { realName: string; idCard: string; rejectReason?: string };
  commission: { total: number; available: number; withdrawn: number; pendingDeduction: number };
  bankCards: { id: string; bankName: string; cardNo: string; holderName: string }[];
  customers: string[];
}

export interface Clerk extends User {
  role: 'clerk';
  realName: string;
  assignedOrderIds: string[];
}

export type AdminRole = 'service' | 'product_manager' | 'system_admin';

export interface AdminUser {
  id: string;
  username: string;
  password: string;
  realName: string;
  phone: string;
  role: AdminRole;
  permissions: Record<string, boolean>;
  status: 'active' | 'disabled';
}

// --- 商品 ---

export interface ProductSpec { name: string; value: string; }
export type ProductVisibility = 'all' | 'institution_only' | 'personal_only';
export type ProductStatus = 'on_sale' | 'off_sale';

export interface ReturnPolicy {
  enabled: boolean;
  deadlineDays: number;
  note: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  images: string[];
  category: string;
  specs: ProductSpec[];
  institutionPrice: number;
  personalPrice: number;
  pointsPrice?: number;
  exchangePoints?: number;
  visibility: ProductVisibility;
  stock: number;
  status: ProductStatus;
  returnPolicy: ReturnPolicy;
  isPrescription?: boolean;
  isBloodPack?: boolean;
  testInfoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  icon?: string;
  sort: number;
}

// --- 订单 ---

export interface OrderAddress { name: string; phone: string; full: string; }

export type NormalOrderStatus = 'pending_payment' | 'pending_shipment' | 'pending_receipt' | 'completed' | 'cancelled';
export type BookingOrderStatus = 'pending_payment' | 'pending_confirmation' | 'confirmed' | 'in_service' | 'completed' | 'cancelled';
export type OrderType = 'normal' | 'booking';
export type OrderStatus = NormalOrderStatus | BookingOrderStatus;

export interface OrderItem {
  productId: string;
  productName: string;
  productImage: string;
  spec: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PriceLog { originalPrice: number; modifiedPrice: number; operatorId: string; operatorName: string; operatedAt: string; }
export interface LogisticsInfo { time: string; description: string; location?: string; }
export interface BookingInfo { date: string; location: string; contactName: string; contactPhone: string; }
export interface OrderPricing { originalAmount: number; actualAmount: number; priceLog: PriceLog[]; }
export interface OrderShipping { address: OrderAddress; trackingNo: string | null; company: string | null; logistics: LogisticsInfo[]; }

export type CommissionStatus = 'pending' | 'locked' | 'settled' | 'adjusted' | 'deducted';
export interface OrderCommission { status: CommissionStatus; amount: number; settledAt: string | null; }

export interface Order {
  id: string;
  type: OrderType;
  status: OrderStatus;
  customerId: string;
  customerName: string;
  salespersonId: string;
  clerkId: string | null;
  items: OrderItem[];
  pricing: OrderPricing;
  shipping: OrderShipping;
  booking?: BookingInfo;
  returnRecordId: string | null;
  commission: OrderCommission;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

// --- 系统 ---

export interface RechargeTier { amount: number; bonus: number; label?: string; }

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

// --- 售后 ---

export type ReturnType = 'return' | 'exchange';
export type ReturnStatus =
  | 'pending_review' | 'approved' | 'rejected'
  | 'pending_return_ship' | 'returned' | 'verifying'
  | 'customer_shipping' | 'received'
  | 'refunding' | 'return_completed'
  | 'exchange_shipping' | 'exchange_completed';

export interface ReturnItem { productId: string; productName: string; quantity: number; unitPrice: number; }

export interface ReturnRecord {
  id: string;
  orderId: string;
  type: ReturnType;
  status: ReturnStatus;
  reason: string;
  items: ReturnItem[];
  refundAmount?: number;
  exchangeItem?: { productId: string; productName: string; spec: string; quantity: number; unitPrice: number };
  sendLogistics: { trackingNo: string; company: string } | null;
  receiveLogistics: { trackingNo: string; company: string } | null;
  verificationResult: 'pending' | 'qualified' | 'unqualified';
  commissionAdjust: { amount: number; reason: string };
  reviewerId: string | null;
  reviewNote: string;
  createdAt: string;
  updatedAt: string;
}
