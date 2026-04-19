"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginByPhone = loginByPhone;
exports.adminLogin = adminLogin;
exports.getCurrentUser = getCurrentUser;
exports.logout = logout;
exports.registerCustomer = registerCustomer;
exports.getCustomers = getCustomers;
exports.getSalespersons = getSalespersons;
exports.getClerks = getClerks;
exports.getAdminUsers = getAdminUsers;
exports.setCustomers = setCustomers;
exports.setSalespersons = setSalespersons;
exports.createAdminUser = createAdminUser;
exports.updateAdminUser = updateAdminUser;
exports.deleteAdminUser = deleteAdminUser;
exports.updateRolePermissions = updateRolePermissions;
const index_1 = require("../mock/index");
// 内存数据副本
let customers = [...index_1.mockCustomers];
let salespersons = [...index_1.mockSalespersons];
let clerks = [...index_1.mockClerks];
let adminUsers = [...index_1.mockAdminUsers];
// 当前登录用户
let currentUser = null;
const delay = (ms = 200) => new Promise(r => setTimeout(r, ms));
/** 模拟手机号登录（小程序端） */
async function loginByPhone(phone) {
    await delay();
    const cust = customers.find(c => c.phone === phone);
    if (cust) {
        currentUser = { userId: cust.id, role: 'customer' };
        return { success: true, user: cust };
    }
    const sp = salespersons.find(s => s.phone === phone);
    if (sp) {
        currentUser = { userId: sp.id, role: 'salesperson' };
        return { success: true, user: sp };
    }
    const ck = clerks.find(c => c.phone === phone);
    if (ck) {
        currentUser = { userId: ck.id, role: 'clerk' };
        return { success: true, user: ck };
    }
    return { success: false, error: '用户不存在' };
}
/** 模拟管理员登录（Web 后台） */
async function adminLogin(username, password) {
    await delay();
    const admin = adminUsers.find(a => a.username === username && a.status === 'active');
    if (!admin)
        return { success: false, error: '用户名或密码错误' };
    // demo 不校验密码
    currentUser = { userId: admin.id, role: 'admin' };
    return { success: true, user: admin };
}
/** 获取当前用户 */
function getCurrentUser() {
    return currentUser;
}
/** 退出登录 */
function logout() {
    currentUser = null;
}
/** 模拟注册（客户） */
async function registerCustomer(phone, nickname, customerType = 'personal') {
    await delay();
    if (customers.find(c => c.phone === phone))
        return { success: false, error: '手机号已注册' };
    const newCustomer = {
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
function getCustomers() { return customers; }
function getSalespersons() { return salespersons; }
function getClerks() { return clerks; }
function getAdminUsers() { return adminUsers; }
function setCustomers(list) { customers = list; }
function setSalespersons(list) { salespersons = list; }
// ========================
// 后台账号管理
// ========================
/** 创建后台账号 */
async function createAdminUser(data) {
    await delay();
    // 检查 username 是否已存在
    if (adminUsers.find(a => a.username === data.username)) {
        throw new Error('用户名已存在');
    }
    const newUser = {
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
async function updateAdminUser(id, data) {
    await delay();
    const idx = adminUsers.findIndex(a => a.id === id);
    if (idx === -1)
        return null;
    const target = adminUsers[idx];
    const updated = {
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
async function deleteAdminUser(id) {
    await delay();
    const idx = adminUsers.findIndex(a => a.id === id);
    if (idx === -1)
        return false;
    adminUsers.splice(idx, 1);
    return true;
}
/** 更新角色权限（批量更新所有该角色的账号） */
async function updateRolePermissions(role, permissions) {
    await delay();
    for (let i = 0; i < adminUsers.length; i++) {
        if (adminUsers[i].role === role) {
            adminUsers[i] = { ...adminUsers[i], permissions };
        }
    }
}
//# sourceMappingURL=auth.js.map