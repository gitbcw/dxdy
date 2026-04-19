import type { Customer, Salesperson, Clerk, AdminUser, AdminRole, UserRole } from '../types/user';
export interface LoginResult {
    success: boolean;
    user?: Customer | Salesperson | Clerk;
    error?: string;
}
export interface AdminLoginResult {
    success: boolean;
    user?: AdminUser;
    error?: string;
}
/** 模拟手机号登录（小程序端） */
export declare function loginByPhone(phone: string): Promise<LoginResult>;
/** 模拟管理员登录（Web 后台） */
export declare function adminLogin(username: string, password: string): Promise<AdminLoginResult>;
/** 获取当前用户 */
export declare function getCurrentUser(): {
    userId: string;
    role: UserRole;
} | null;
/** 退出登录 */
export declare function logout(): void;
/** 模拟注册（客户） */
export declare function registerCustomer(phone: string, nickname: string, customerType?: 'personal' | 'institution'): Promise<LoginResult>;
export declare function getCustomers(): Customer[];
export declare function getSalespersons(): Salesperson[];
export declare function getClerks(): Clerk[];
export declare function getAdminUsers(): AdminUser[];
export declare function setCustomers(list: Customer[]): void;
export declare function setSalespersons(list: Salesperson[]): void;
/** 创建后台账号 */
export declare function createAdminUser(data: {
    username: string;
    password: string;
    realName: string;
    phone: string;
    role: AdminRole;
}): Promise<AdminUser>;
/** 更新后台账号 */
export declare function updateAdminUser(id: string, data: Partial<{
    realName: string;
    phone: string;
    role: AdminRole;
    status: 'active' | 'disabled';
    password: string;
}>): Promise<AdminUser | null>;
/** 删除后台账号 */
export declare function deleteAdminUser(id: string): Promise<boolean>;
/** 更新角色权限（批量更新所有该角色的账号） */
export declare function updateRolePermissions(role: AdminRole, permissions: Record<string, boolean>): Promise<void>;
//# sourceMappingURL=auth.d.ts.map