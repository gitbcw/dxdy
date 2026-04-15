import type { Customer, Salesperson, Clerk, AdminUser, UserRole } from '../types/user';
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
export async function registerCustomer(phone: string, nickname: string): Promise<LoginResult> {
  await delay();
  if (customers.find(c => c.phone === phone)) return { success: false, error: '手机号已注册' };
  const newCustomer: Customer = {
    id: `cust_${Date.now().toString(36)}`,
    phone,
    nickname,
    avatar: '',
    role: 'customer',
    customerType: 'personal',
    verificationStatus: 'none',
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
