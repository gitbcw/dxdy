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
    businessLicenseUrl?: string;
    sitePhoto?: string;
    sitePhotoUrl?: string;
    hospitalName?: string;
    legalPerson?: string;
    region?: string;
    address?: string;
    submittedAt?: string;
    reviewedAt?: string;
    reviewerName?: string;
    contactName: string;
    contactPhone: string;
    rejectReason?: string;
  };
  boundSalespersonId: string | null;
  wallet: { balance: number; rechargeHistory: { id: string; amount: number; bonus: number; createdAt: string }[] };
  points: { balance: number; history: { id: string; change: number; balance: number; reason: string; createdAt: string }[] };
  addresses: Address[];
  referralCode?: string;
  referredBy?: string;
  referredAt?: string;
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

export type AdminRole = 'service' | 'product_manager' | 'system_admin' | 'clerk';

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
export type ProductVisibility = 'all' | 'institution_only';
export type ProductStatus = 'on_sale' | 'off_sale';
export type ProductType = 'physical' | 'blood_pack' | 'test_service' | 'card_voucher';

export interface ReturnPolicy {
  enabled: boolean;
  deadlineDays: number;
  note: string;
}

export interface BookingConfig {
  enabled: boolean; leadDays: number; locations: string[]
  requireInstitution: boolean; requireVerification: boolean
}

export interface PurchaseLimit {
  minQuantity: number; maxQuantityPerOrder: number; maxQuantityPerUser: number
}

export interface AgreementRequired {
  enabled: boolean; title: string; content: string
}

export interface UrgentConfig {
  enabled: boolean; extraFee: number; description: string
}

export interface DeliveryConfig {
  regions: string[]; coldChainRequired: boolean
}

export interface Product {
  id: string;
  name: string;
  description: string;
  images: string[];
  category: string;
  specs: ProductSpec[];
  institutionPrice: number;
  personalPrice?: number;
  pointsPrice?: number;
  exchangePoints?: number;
  visibility: ProductVisibility;
  stock: number;
  salesCount?: number;
  serviceTags?: string[];
  status: ProductStatus;
  returnPolicy: ReturnPolicy;
  isPrescription?: boolean;
  isBloodPack?: boolean;
  testInfoUrl?: string;
  productType?: ProductType;
  bookingConfig?: BookingConfig;
  urgentConfig?: UrgentConfig;
  purchaseLimit?: PurchaseLimit;
  agreementRequired?: AgreementRequired;
  salesCountEnabled?: boolean;
  deliveryConfig?: DeliveryConfig;
  visibleRegions?: string[];
  hiddenRegions?: string[];
  redeemableCategory?: string;
  validDays?: number;
  promotionPrice?: number;
  promotionStart?: string;
  promotionEnd?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  icon?: string;
  sort: number;
}

// --- 内容运营 ---

export type OfficialArticleStatus = 'active' | 'inactive';

export interface OfficialArticle {
  id: string;
  title: string;
  subtitle?: string;
  coverUrl: string;
  articleUrl: string;
  tag?: string;
  status: OfficialArticleStatus;
  sort: number;
  clickCount?: number;
  viewCount?: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
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
export interface BookingInfo {
  date: string; location: string; contactName: string; contactPhone: string
  bloodBooking?: boolean; species?: 'dog' | 'cat'; speciesLabel?: string
  bloodType?: string; volumeMl?: number; urgent?: boolean; address?: string
}
export interface OrderPricing {
  originalAmount: number; actualAmount: number; priceLog: PriceLog[]
  coupon?: { userCouponId: string; couponName: string; couponType: CouponType; discountAmount: number }
  shippingFee?: number; urgentFee?: number; pointsDeduction?: number; refundedAmount?: number
  breakdown?: { goodsAmount: number; couponDiscount: number; pointsDeduction: number; shippingFee: number; urgentFee: number; actualAmount: number }
}
export interface OrderShipping {
  address: OrderAddress; trackingNo: string | null; company: string | null; logistics: LogisticsInfo[]
  abnormal?: { flagged: boolean; type: string; reason: string; photos: string[]; flaggedAt: string; flaggedBy: string }
  urgent?: boolean
}

export type CommissionStatus = 'pending' | 'locked' | 'settled' | 'adjusted' | 'deducted';
export interface OrderCommission { status: CommissionStatus; amount: number; settledAt: string | null; }
export interface OrderPayment {
  status?: 'unpaid' | 'pending' | 'paid' | 'refunded' | string;
  method?: string;
  paidAt?: string;
  transactionId?: string;
  amount?: number;
}

export interface Order {
  id: string;
  orderNo?: string;
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
  payment?: OrderPayment;
  returnRecordId: string | null;
  commission: OrderCommission;
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

// --- 系统 ---

export interface RechargeTier { amount: number; bonus: number; label?: string; }

export interface CatalogBanner {
  id: string;
  title?: string;
  imageUrl: string;
  productId: string;
  enabled?: boolean;
  sortOrder?: number;
}

export interface BloodBookingPriceRule {
  species: 'dog' | 'cat';
  bloodType: string;
  volumeMl: number;
  price?: number;
  storePrice: number;
  retailPrice: number;
}

export interface BloodBookingConfig {
  dogBloodTypes: string[];
  catBloodTypes: string[];
  dogVolumeOptions: number[];
  catVolumeOptions: number[];
  volumeOptions?: number[];
  priceRules?: BloodBookingPriceRule[];
}

export interface SystemConfig {
  commissionRate: number;
  commissionLockDays: number;
  minWithdrawAmount: number;
  withdrawReviewEnabled: boolean;
  paymentTimeoutMinutes: number;
  autoReceiptDays: number;
  returnDeadlineDays: number;
  returnAddress: string;
  reviewTimeoutHours: number;
  stockWarningThreshold: number;
  pointsRate: number;
  pointsExpiryDays: number;
  rechargeTiers: RechargeTier[];
  referralRewardPoints: number;
  bloodBookingConfig: BloodBookingConfig;
  catalogBanners: CatalogBanner[];
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

// --- 优惠券 ---

export type CouponType = 'fixed' | 'discount' | 'full_reduction';
export type CouponScope = 'all' | 'products' | 'categories';
export type CouponDistributeMethod = 'admin' | 'user_claim' | 'auto_new_user';
export type CouponTemplateStatus = 'active' | 'disabled' | 'expired';
export type UserCouponStatus = 'available' | 'used' | 'expired' | 'disabled';
export type UserCouponSource = 'admin_grant' | 'user_claim' | 'auto_new_user';

export interface CouponTemplate {
  id: string; name: string; description: string
  type: CouponType; value: number; minAmount: number
  scope: CouponScope; scopeIds: string[]
  distributeMethod: CouponDistributeMethod
  totalQuota: number; claimedCount: number; perUserLimit: number
  validDaysAfterClaim: number; validFrom: string; validTo: string
  status: CouponTemplateStatus; createdAt: string; updatedAt: string
}

export interface UserCoupon {
  id: string; templateId: string; userId: string; userOpenid: string
  couponName: string; couponType: CouponType; couponValue: number
  minAmount: number; scope: CouponScope; scopeIds: string[]
  validFrom: string; validTo: string
  status: UserCouponStatus; usedAt: string; usedOrderId: string
  source: UserCouponSource; grantedBy: string
  createdAt: string; updatedAt: string
}

// --- 售后 ---

export type ReturnType = 'refund_return' | 'exchange';
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
  description?: string;
  items: ReturnItem[];
  vouchers?: string[];
  voucherUrls?: string[];
  refundAmount?: number;
  exchangeOrderId?: string;
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

// --- 卡券 ---

export type CardVoucherStatus =
  | 'ungifted' | 'gifted' | 'claimed'
  | 'redeemed' | 'verified' | 'expired' | 'voided';

export interface CardVoucher {
  id: string;
  cardNo: string;
  status: CardVoucherStatus;
  purchaseOrderId: string;
  purchaseOrderNo: string;
  productId: string;
  productName: string;
  productImage: string;
  redeemableCategory: string;
  purchaseAmount?: number;
  deductionAmount?: number;
  discountAmount?: number;
  validDays: number;
  expiresAt: string;
  purchaserId: string;
  purchaserName: string;
  purchaserOpenid: string;
  currentHolderId: string | null;
  currentHolderName: string;
  giftHistory: { fromUserId: string; fromUserName: string; toUserId: string; toUserName: string; at: string }[];
  redeemedOrderId: string;
  redeemedProductId: string;
  redeemedProductName: string;
  redeemedAt: string;
  verifiedAt: string;
  voidedAt: string;
  voidedBy: string;
  voidReason: string;
  createdAt: string;
  updatedAt: string;
}
