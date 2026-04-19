import type { Customer, Salesperson, Address, VerificationStatus } from '../types/user';
import { getCustomers, getSalespersons, setCustomers, setSalespersons } from './auth';
import { mockAdminUsers } from '../mock';
import { addLog } from './system';

const delay = (ms = 200) => new Promise<void>(r => setTimeout(r, ms));

/** 获取客户信息 */
export async function getCustomerById(id: string): Promise<Customer | null> {
  await delay(100);
  return getCustomers().find(c => c.id === id) ?? null;
}

/** 获取业务员信息 */
export async function getSalespersonById(id: string): Promise<Salesperson | null> {
  await delay(100);
  return getSalespersons().find(s => s.id === id) ?? null;
}

/** 获取业务员下的客户列表 */
export async function getSalespersonCustomers(salespersonId: string): Promise<Customer[]> {
  await delay();
  return getCustomers().filter(c => c.boundSalespersonId === salespersonId);
}

/** 绑定业务员 */
export async function bindSalesperson(customerId: string, salespersonId: string): Promise<Customer | null> {
  await delay();
  const customers = getCustomers();
  const idx = customers.findIndex(c => c.id === customerId);
  if (idx === -1) return null;
  customers[idx].boundSalespersonId = salespersonId;
  setCustomers(customers);
  // 同步到业务员的 customers 列表
  const salespersons = getSalespersons();
  const spIdx = salespersons.findIndex(s => s.id === salespersonId);
  if (spIdx !== -1 && !salespersons[spIdx].customers.includes(customerId)) {
    salespersons[spIdx].customers.push(customerId);
    setSalespersons(salespersons);
  }
  return customers[idx];
}

/** 提交实名认证（客户） */
export async function submitVerification(
  userId: string,
  info: Customer['verificationInfo'],
): Promise<Customer | null> {
  await delay();
  const customers = getCustomers();
  const idx = customers.findIndex(c => c.id === userId);
  if (idx === -1) return null;
  customers[idx].verificationStatus = 'pending';
  customers[idx].verificationInfo = info;
  setCustomers(customers);
  return customers[idx];
}

/** 审核实名认证（后台） */
export async function reviewVerification(
  userId: string,
  approved: boolean,
  rejectReason?: string,
): Promise<Customer | Salesperson | null> {
  await delay();
  // 尝试客户
  const customers = getCustomers();
  const custIdx = customers.findIndex(c => c.id === userId);
  if (custIdx !== -1) {
    customers[custIdx].verificationStatus = approved ? 'approved' : 'rejected';
    if (!approved && rejectReason && customers[custIdx].verificationInfo) {
      customers[custIdx].verificationInfo!.rejectReason = rejectReason;
    }
    setCustomers(customers);
    addLog({
      operatorId: 'admin',
      operatorName: '系统管理员',
      operatorRole: '系统管理员',
      action: approved ? '实名认证通过' : '实名认证驳回',
      target: `客户 ${customers[custIdx].nickname} (${userId})`,
      detail: approved ? '' : (rejectReason ?? ''),
      result: 'success',
    });
    return customers[custIdx];
  }
  // 尝试业务员
  const salespersons = getSalespersons();
  const spIdx = salespersons.findIndex(s => s.id === userId);
  if (spIdx !== -1) {
    salespersons[spIdx].verificationStatus = approved ? 'approved' : 'rejected';
    if (!approved && rejectReason) {
      salespersons[spIdx].verificationInfo.rejectReason = rejectReason;
    }
    setSalespersons(salespersons);
    addLog({
      operatorId: 'admin',
      operatorName: '系统管理员',
      operatorRole: '系统管理员',
      action: approved ? '实名认证通过' : '实名认证驳回',
      target: `业务员 ${salespersons[spIdx].nickname} (${userId})`,
      detail: approved ? '' : (rejectReason ?? ''),
      result: 'success',
    });
    return salespersons[spIdx];
  }
  return null;
}

/** 添加/更新地址 */
export async function saveAddress(customerId: string, address: Address): Promise<Customer | null> {
  await delay();
  const customers = getCustomers();
  const idx = customers.findIndex(c => c.id === customerId);
  if (idx === -1) return null;
  const addrIdx = customers[idx].addresses.findIndex(a => a.id === address.id);
  if (addrIdx >= 0) {
    customers[idx].addresses[addrIdx] = address;
  } else {
    customers[idx].addresses.push(address);
  }
  // 如果设为默认，取消其他默认
  if (address.isDefault) {
    customers[idx].addresses.forEach(a => { if (a.id !== address.id) a.isDefault = false; });
  }
  setCustomers(customers);
  return customers[idx];
}

/** 删除地址 */
export async function deleteAddress(customerId: string, addressId: string): Promise<boolean> {
  await delay();
  const customers = getCustomers();
  const idx = customers.findIndex(c => c.id === customerId);
  if (idx === -1) return false;
  customers[idx].addresses = customers[idx].addresses.filter(a => a.id !== addressId);
  setCustomers(customers);
  return true;
}

/** 获取全部用户列表（后台用） */
export async function getAllUsers() {
  await delay();
  return {
    customers: getCustomers(),
    salespersons: getSalespersons(),
    adminUsers: mockAdminUsers,
  };
}
