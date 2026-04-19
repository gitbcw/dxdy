"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCustomerById = getCustomerById;
exports.getSalespersonById = getSalespersonById;
exports.getSalespersonCustomers = getSalespersonCustomers;
exports.bindSalesperson = bindSalesperson;
exports.submitVerification = submitVerification;
exports.reviewVerification = reviewVerification;
exports.saveAddress = saveAddress;
exports.deleteAddress = deleteAddress;
exports.getAllUsers = getAllUsers;
const auth_1 = require("./auth");
const index_1 = require("../mock/index");
const system_1 = require("./system");
const delay = (ms = 200) => new Promise(r => setTimeout(r, ms));
/** 获取客户信息 */
async function getCustomerById(id) {
    await delay(100);
    return (0, auth_1.getCustomers)().find(c => c.id === id) ?? null;
}
/** 获取业务员信息 */
async function getSalespersonById(id) {
    await delay(100);
    return (0, auth_1.getSalespersons)().find(s => s.id === id) ?? null;
}
/** 获取业务员下的客户列表 */
async function getSalespersonCustomers(salespersonId) {
    await delay();
    return (0, auth_1.getCustomers)().filter(c => c.boundSalespersonId === salespersonId);
}
/** 绑定业务员 */
async function bindSalesperson(customerId, salespersonId) {
    await delay();
    const customers = (0, auth_1.getCustomers)();
    const idx = customers.findIndex(c => c.id === customerId);
    if (idx === -1)
        return null;
    customers[idx].boundSalespersonId = salespersonId;
    (0, auth_1.setCustomers)(customers);
    // 同步到业务员的 customers 列表
    const salespersons = (0, auth_1.getSalespersons)();
    const spIdx = salespersons.findIndex(s => s.id === salespersonId);
    if (spIdx !== -1 && !salespersons[spIdx].customers.includes(customerId)) {
        salespersons[spIdx].customers.push(customerId);
        (0, auth_1.setSalespersons)(salespersons);
    }
    return customers[idx];
}
/** 提交实名认证（客户） */
async function submitVerification(userId, info) {
    await delay();
    const customers = (0, auth_1.getCustomers)();
    const idx = customers.findIndex(c => c.id === userId);
    if (idx === -1)
        return null;
    customers[idx].verificationStatus = 'pending';
    customers[idx].verificationInfo = info;
    (0, auth_1.setCustomers)(customers);
    return customers[idx];
}
/** 审核实名认证（后台） */
async function reviewVerification(userId, approved, rejectReason) {
    await delay();
    // 尝试客户
    const customers = (0, auth_1.getCustomers)();
    const custIdx = customers.findIndex(c => c.id === userId);
    if (custIdx !== -1) {
        customers[custIdx].verificationStatus = approved ? 'approved' : 'rejected';
        if (!approved && rejectReason && customers[custIdx].verificationInfo) {
            customers[custIdx].verificationInfo.rejectReason = rejectReason;
        }
        (0, auth_1.setCustomers)(customers);
        (0, system_1.addLog)({
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
    const salespersons = (0, auth_1.getSalespersons)();
    const spIdx = salespersons.findIndex(s => s.id === userId);
    if (spIdx !== -1) {
        salespersons[spIdx].verificationStatus = approved ? 'approved' : 'rejected';
        if (!approved && rejectReason) {
            salespersons[spIdx].verificationInfo.rejectReason = rejectReason;
        }
        (0, auth_1.setSalespersons)(salespersons);
        (0, system_1.addLog)({
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
async function saveAddress(customerId, address) {
    await delay();
    const customers = (0, auth_1.getCustomers)();
    const idx = customers.findIndex(c => c.id === customerId);
    if (idx === -1)
        return null;
    const addrIdx = customers[idx].addresses.findIndex(a => a.id === address.id);
    if (addrIdx >= 0) {
        customers[idx].addresses[addrIdx] = address;
    }
    else {
        customers[idx].addresses.push(address);
    }
    // 如果设为默认，取消其他默认
    if (address.isDefault) {
        customers[idx].addresses.forEach(a => { if (a.id !== address.id)
            a.isDefault = false; });
    }
    (0, auth_1.setCustomers)(customers);
    return customers[idx];
}
/** 删除地址 */
async function deleteAddress(customerId, addressId) {
    await delay();
    const customers = (0, auth_1.getCustomers)();
    const idx = customers.findIndex(c => c.id === customerId);
    if (idx === -1)
        return false;
    customers[idx].addresses = customers[idx].addresses.filter(a => a.id !== addressId);
    (0, auth_1.setCustomers)(customers);
    return true;
}
/** 获取全部用户列表（后台用） */
async function getAllUsers() {
    await delay();
    return {
        customers: (0, auth_1.getCustomers)(),
        salespersons: (0, auth_1.getSalespersons)(),
        adminUsers: index_1.mockAdminUsers,
    };
}
//# sourceMappingURL=user.js.map