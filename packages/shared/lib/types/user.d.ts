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
export interface RechargeRecord {
    id: string;
    amount: number;
    bonus: number;
    createdAt: string;
}
export interface PointsRecord {
    id: string;
    change: number;
    balance: number;
    reason: string;
    createdAt: string;
}
export interface BankCard {
    id: string;
    bankName: string;
    cardNo: string;
    holderName: string;
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
    wallet: {
        balance: number;
        rechargeHistory: RechargeRecord[];
    };
    points: {
        balance: number;
        history: PointsRecord[];
    };
    addresses: Address[];
}
export interface Salesperson extends User {
    role: 'salesperson';
    verificationStatus: VerificationStatus;
    verificationInfo: {
        realName: string;
        idCard: string;
        rejectReason?: string;
    };
    commission: {
        total: number;
        available: number;
        withdrawn: number;
        pendingDeduction: number;
    };
    bankCards: BankCard[];
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
//# sourceMappingURL=user.d.ts.map