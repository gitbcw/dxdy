import type { Customer, Salesperson, Clerk, AdminUser, AdminRole, UserRole } from '../types/user';
import { mockCustomers, mockSalespersons, mockClerks, mockAdminUsers } from '../mock';

// 内存数据副本
let customers = [...mockCustomers];
let salespersons = [...mockSalespersons];
let clerks = [...mockClerks];
let adminUsers = [...mockAdminUsers];

// 当前登录用户
let currentUser: { userId: string; role: UserRole } | null = null;

const delay = (ms = 200) => new Promise<void>(r => setTimeout(r, ms));

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
export async function loginByPhone(phone: string): Promise<LoginResult> {
  await delay();
  const cust = customers.find(c => c.phone === phone);
  if (cust) { currentUser = { userId: cust.id, role: 'customer' }; return { success: true, user: cust }; }
  const sp = salespersons.find(s => s.phone === phone);
  if (sp) { currentUser = { userId: sp.id, role: 'salesperson' }; return { success: true, user: sp }; }
  const ck = clerks.find(c => c.phone === phone);
  if (ck) { currentUser = { userId: ck.id, role: 'clerk' }; return { success: true, user: ck }; }
  return { success: false, error: '用户不存在' };
}

/** 模拟管理员登录（Web 后台） */
export async function adminLogin(username: string, password: string): Promise<AdminLoginResult> {
  await delay();
  const admin = adminUsers.find(a => a.username === username && a.status === 'active');
  if (!admin) return { success: false, error: '用户名或密码错误' };
  // demo 不校验密码
  currentUser = { userId: admin.id, role: 'admin' };
  return { success: true, user: admin };
}

/** 获取当前用户 */
export function getCurrentUser() {
  return currentUser;
}

/** 退出登录 */
export function logout() {
  currentUser = null;
}

/** 模拟注册（客户） */
export async function registerCustomer(phone: string, nickname: string, customerType: 'personal' | 'institution' = 'personal'): Promise<LoginResult> {
  await delay();
  if (customers.find(c => c.phone === phone)) return { success: false, error: '手机号已注册' };
  const newCustomer: Customer = {
    id: `cust_${Date.now().toString(36)}`,
    phone,
    nickname,
    avatar: '',
    role: 'customer',
    customerType,
    verificationStatus: customerType === 'institution' ? 'none' : 'none',
    boundSalespersonId: null,
    wallet: { balance: 0, rechargeHistory: [] },
    points: { balance: 0, history: [] },
    addresses: [],
    createdAt: new Date().toISOString(),
  };
  customers.push(newCustomer);
  currentUser = { userId: newCustomer.id, role: 'customer' };
  return { success: true, user: newCustomer };
}

// 导出数据访问（供其他服务使用）
export function getCustomers() { return customers; }
export function getSalespersons() { return salespersons; }
export function getClerks() { return clerks; }
export function getAdminUsers() { return adminUsers; }
export function setCustomers(list: Customer[]) { customers = list; }
export function setSalespersons(list: Salesperson[]) { salespersons = list; }

// ========================
// 后台账号管理
// ========================

/** 创建后台账号 */
export async function createAdminUser(data: {
  username: string;
  password: string;
  realName: string;
  phone: string;
  role: AdminRole;
}): Promise<AdminUser> {
  await delay();
  // 检查 username 是否已存在
  if (adminUsers.find(a => a.username === data.username)) {
    throw new Error('用户名已存在');
  }
  const newUser: AdminUser = {
    id: `admin_${Date.now().toString(36)}`,
    username: data.username,
    password: data.password,
    realName: data.realName,
    phone: data.phone,
    role: data.role,
    permissions: {},
    status: 'active',
  };
  adminUsers.push(newUser);
  return newUser;
}

/** 更新后台账号 */
export async function updateAdminUser(id: string, data: Partial<{
  realName: string;
  phone: string;
  role: AdminRole;
  status: 'active' | 'disabled';
  password: string;
}>): Promise<AdminUser | null> {
  await delay();
  const idx = adminUsers.findIndex(a => a.id === id);
  if (idx === -1) return null;
  const target = adminUsers[idx];
  const updated: AdminUser = {
    ...target,
    realName: data.realName ?? target.realName,
    phone: data.phone ?? target.phone,
    role: data.role ?? target.role,
    status: data.status ?? target.status,
    password: data.password ?? target.password,
  };
  adminUsers[idx] = updated;
  return updated;
}

/** 删除后台账号 */
export async function deleteAdminUser(id: string): Promise<boolean> {
  await delay();
  const idx = adminUsers.findIndex(a => a.id === id);
  if (idx === -1) return false;
  adminUsers.splice(idx, 1);
  return true;
}

/** 更新角色权限（批量更新所有该角色的账号） */
export async function updateRolePermissions(role: AdminRole, permissions: Record<string, boolean>): Promise<void> {
  await delay();
  for (let i = 0; i < adminUsers.length; i++) {
    if (adminUsers[i].role === role) {
      adminUsers[i] = { ...adminUsers[i], permissions };
    }
  }
}
