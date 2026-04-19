// 用户角色
export type UserRole = 'customer' | 'salesperson' | 'clerk' | 'admin';

// 认证状态
export type VerificationStatus = 'none' | 'pending' | 'approved' | 'rejected';

// 基础用户
export interface User {
  id: string;
  phone: string;
  nickname: string;
  avatar: string;
  role: UserRole;
  createdAt: string;
}

// 收货地址
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

// 充值记录
export interface RechargeRecord {
  id: string;
  amount: number;
  bonus: number;
  createdAt: string;
}

// 积分记录
export interface PointsRecord {
  id: string;
  change: number;
  balance: number;
  reason: string;
  createdAt: string;
}

// 银行卡
export interface BankCard {
  id: string;
  bankName: string;
  cardNo: string;
  holderName: string;
}

// 客户（机构/个人）
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

// 业务员
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

// 制单员
export interface Clerk extends User {
  role: 'clerk';
  realName: string;
  assignedOrderIds: string[];
}

// 后台管理员角色
export type AdminRole = 'service' | 'product_manager' | 'system_admin';

// 后台管理员
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
