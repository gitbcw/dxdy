export declare const clerkPendingOrders: Array<{
    id: string;
    orderNo: string;
    type: 'normal' | 'exchange';
    originalOrderNo?: string;
    mainOrderId?: string;
    customerName: string;
    customerPhone: string;
    address: string;
    items: {
        name: string;
        quantity: number;
        specs: string;
    }[];
    createdAt: string;
    assignedAt: string;
    status: string;
}>;
export declare const clerkShippedOrders: Array<{
    id: string;
    orderNo: string;
    type: 'normal' | 'exchange';
    originalOrderNo?: string;
    mainOrderId?: string;
    customerName: string;
    customerPhone: string;
    address: string;
    items: {
        name: string;
        quantity: number;
        specs: string;
    }[];
    createdAt: string;
    assignedAt: string;
    shippedAt?: string;
    expressCompany?: string;
    expressNo?: string;
    status: string;
}>;
//# sourceMappingURL=clerk-orders.d.ts.map