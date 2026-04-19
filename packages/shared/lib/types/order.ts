// 订单地址（自包含，不依赖外部类型）
export interface OrderAddress {
  name: string;
  phone: string;
  full: string;
}

// 普通订单状态
export type NormalOrderStatus =
  | 'pending_payment'
  | 'pending_shipment'
  | 'pending_receipt'
  | 'completed'
  | 'cancelled';

// 预约订单状态
export type BookingOrderStatus =
  | 'pending_payment'
  | 'pending_confirmation'
  | 'confirmed'
  | 'in_service'
  | 'completed'
  | 'cancelled';

// 订单类型
export type OrderType = 'normal' | 'booking';

// 订单状态（联合）
export type OrderStatus = NormalOrderStatus | BookingOrderStatus;

// 订单商品项
export interface OrderItem {
  productId: string;
  productName: string;
  productImage: string;
  spec: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

// 改价记录
export interface PriceLog {
  originalPrice: number;
  modifiedPrice: number;
  operatorId: string;
  operatorName: string;
  operatedAt: string;
}

// 物流信息
export interface LogisticsInfo {
  time: string;
  description: string;
  location?: string;
}

// 预约信息
export interface BookingInfo {
  date: string;
  location: string;
  contactName: string;
  contactPhone: string;
}

// 订单定价
export interface OrderPricing {
  originalAmount: number;
  actualAmount: number;
  priceLog: PriceLog[];
}

// 订单物流
export interface OrderShipping {
  address: OrderAddress;
  trackingNo: string | null;
  company: string | null;
  logistics: LogisticsInfo[];
}

// 提成状态
export type CommissionStatus =
  | 'pending'
  | 'locked'
  | 'settled'
  | 'adjusted'
  | 'deducted';

// 订单提成
export interface OrderCommission {
  status: CommissionStatus;
  amount: number;
  settledAt: string | null;
}

// 订单
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
