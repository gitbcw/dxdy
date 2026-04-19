import type { Customer, Salesperson, Address } from '../types/user';
/** 获取客户信息 */
export declare function getCustomerById(id: string): Promise<Customer | null>;
/** 获取业务员信息 */
export declare function getSalespersonById(id: string): Promise<Salesperson | null>;
/** 获取业务员下的客户列表 */
export declare function getSalespersonCustomers(salespersonId: string): Promise<Customer[]>;
/** 绑定业务员 */
export declare function bindSalesperson(customerId: string, salespersonId: string): Promise<Customer | null>;
/** 提交实名认证（客户） */
export declare function submitVerification(userId: string, info: Customer['verificationInfo']): Promise<Customer | null>;
/** 审核实名认证（后台） */
export declare function reviewVerification(userId: string, approved: boolean, rejectReason?: string): Promise<Customer | Salesperson | null>;
/** 添加/更新地址 */
export declare function saveAddress(customerId: string, address: Address): Promise<Customer | null>;
/** 删除地址 */
export declare function deleteAddress(customerId: string, addressId: string): Promise<boolean>;
/** 获取全部用户列表（后台用） */
export declare function getAllUsers(): Promise<{
    customers: Customer[];
    salespersons: Salesperson[];
    adminUsers: import("../types/user").AdminUser[];
}>;
//# sourceMappingURL=user.d.ts.map