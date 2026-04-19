export interface OrderAddress {
    name: string;
    phone: string;
    full: string;
}
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
export interface PriceLog {
    originalPrice: number;
    modifiedPrice: number;
    operatorId: string;
    operatorName: string;
    operatedAt: string;
}
export interface LogisticsInfo {
    time: string;
    description: string;
    location?: string;
}
export interface BookingInfo {
    date: string;
    location: string;
    contactName: string;
    contactPhone: string;
}
export interface OrderPricing {
    originalAmount: number;
    actualAmount: number;
    priceLog: PriceLog[];
}
export interface OrderShipping {
    address: OrderAddress;
    trackingNo: string | null;
    company: string | null;
    logistics: LogisticsInfo[];
}
export type CommissionStatus = 'pending' | 'locked' | 'settled' | 'adjusted' | 'deducted';
export interface OrderCommission {
    status: CommissionStatus;
    amount: number;
    settledAt: string | null;
}
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
//# sourceMappingURL=order.d.ts.map