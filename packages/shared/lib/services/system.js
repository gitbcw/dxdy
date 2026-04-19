"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSystemConfig = getSystemConfig;
exports.updateSystemConfig = updateSystemConfig;
exports.getOperationLogs = getOperationLogs;
exports.addLog = addLog;
exports.getUserNotifications = getUserNotifications;
exports.markNotificationRead = markNotificationRead;
exports.getUnreadCount = getUnreadCount;
const index_1 = require("../mock/index");
let config = { ...index_1.defaultSystemConfig };
let logs = [...index_1.mockLogs];
let notifications = [...index_1.mockNotifications];
const delay = (ms = 200) => new Promise(r => setTimeout(r, ms));
/** 获取系统配置 */
async function getSystemConfig() {
    await delay(100);
    return { ...config };
}
/** 更新系统配置 */
async function updateSystemConfig(updates) {
    await delay();
    config = { ...config, ...updates };
    return { ...config };
}
/** 获取操作日志 */
async function getOperationLogs(options) {
    await delay();
    const result = [...logs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return options?.limit ? result.slice(0, options.limit) : result;
}
/** 添加操作日志 */
function addLog(log) {
    logs.push({
        ...log,
        id: `log_${Date.now().toString(36)}`,
        createdAt: new Date().toISOString(),
    });
}
/** 获取用户通知 */
async function getUserNotifications(userId) {
    await delay();
    return notifications.filter(n => n.targetUserId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
/** 标记通知已读 */
async function markNotificationRead(notificationId) {
    await delay(100);
    const n = notifications.find(n => n.id === notificationId);
    if (n)
        n.isRead = true;
}
/** 获取未读通知数 */
async function getUnreadCount(userId) {
    await delay(50);
    return notifications.filter(n => n.targetUserId === userId && !n.isRead).length;
}
//# sourceMappingURL=system.js.map