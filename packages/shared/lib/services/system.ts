import type { SystemConfig, OperationLog, Notification } from '../types/system';
import { defaultSystemConfig, mockLogs, mockNotifications } from '../mock/index';

let config = { ...defaultSystemConfig };
let logs = [...mockLogs];
let notifications = [...mockNotifications];

const delay = (ms = 200) => new Promise<void>(r => setTimeout(r, ms));

/** 获取系统配置 */
export async function getSystemConfig(): Promise<SystemConfig> {
  await delay(100);
  return { ...config };
}

/** 更新系统配置 */
export async function updateSystemConfig(updates: Partial<SystemConfig>): Promise<SystemConfig> {
  await delay();
  config = { ...config, ...updates };
  return { ...config };
}

/** 获取操作日志 */
export async function getOperationLogs(options?: { limit?: number }): Promise<OperationLog[]> {
  await delay();
  const result = [...logs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return options?.limit ? result.slice(0, options.limit) : result;
}

/** 添加操作日志 */
export function addLog(log: Omit<OperationLog, 'id' | 'createdAt'>): void {
  logs.push({
    ...log,
    id: `log_${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
  });
}

/** 获取用户通知 */
export async function getUserNotifications(userId: string): Promise<Notification[]> {
  await delay();
  return notifications.filter(n => n.targetUserId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 标记通知已读 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  await delay(100);
  const n = notifications.find(n => n.id === notificationId);
  if (n) n.isRead = true;
}

/** 获取未读通知数 */
export async function getUnreadCount(userId: string): Promise<number> {
  await delay(50);
  return notifications.filter(n => n.targetUserId === userId && !n.isRead).length;
}
