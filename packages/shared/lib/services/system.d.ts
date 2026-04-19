import type { SystemConfig, OperationLog, Notification } from '../types/system';
/** 获取系统配置 */
export declare function getSystemConfig(): Promise<SystemConfig>;
/** 更新系统配置 */
export declare function updateSystemConfig(updates: Partial<SystemConfig>): Promise<SystemConfig>;
/** 获取操作日志 */
export declare function getOperationLogs(options?: {
    limit?: number;
}): Promise<OperationLog[]>;
/** 添加操作日志 */
export declare function addLog(log: Omit<OperationLog, 'id' | 'createdAt'>): void;
/** 获取用户通知 */
export declare function getUserNotifications(userId: string): Promise<Notification[]>;
/** 标记通知已读 */
export declare function markNotificationRead(notificationId: string): Promise<void>;
/** 获取未读通知数 */
export declare function getUnreadCount(userId: string): Promise<number>;
//# sourceMappingURL=system.d.ts.map