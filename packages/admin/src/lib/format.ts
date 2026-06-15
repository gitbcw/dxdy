// ============================================================
// 业务工具函数 — 从 @dxdy/shared 迁移，仅保留 admin 后台所需
// ============================================================

function normalizeDateInput(date: string | Date): Date {
  if (date instanceof Date) return date;
  const normalized = date.includes('T') ? date : date.replace(' ', 'T');
  return new Date(normalized);
}

function getLiteralDateParts(date: string | Date) {
  if (typeof date !== 'string') return null;
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!match) return null;
  return {
    y: match[1],
    m: match[2],
    day: match[3],
    h: match[4],
    min: match[5],
  };
}

/** 格式化金额（保留两位小数，千分位逗号） */
export function formatMoney(amount: number): string {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 格式化日期为 YYYY-MM-DD */
export function formatDate(date: string | Date): string {
  const literal = getLiteralDateParts(date);
  if (literal) return `${literal.y}-${literal.m}-${literal.day}`;

  const d = normalizeDateInput(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 格式化日期时间为 YYYY-MM-DD HH:mm */
export function formatDateTime(date: string | Date): string {
  const literal = getLiteralDateParts(date);
  if (literal) return `${literal.y}-${literal.m}-${literal.day} ${literal.h}:${literal.min}`;

  const d = normalizeDateInput(date);
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)} ${h}:${min}`;
}

/** 手机号脱敏 138****1234 */
export function maskPhone(phone: string): string {
  if (phone.length !== 11) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(7);
}

// --- 默认系统配置 ---

import type { SystemConfig } from './types';

export const defaultSystemConfig: SystemConfig = {
  commissionRate: 0.2,
  commissionLockDays: 15,
  minWithdrawAmount: 100,
  withdrawReviewEnabled: true,
  paymentTimeoutMinutes: 30,
  autoReceiptDays: 7,
  returnDeadlineDays: 7,
  returnAddress: '广州市黄埔区科学城宠物医疗供应链中心A栋3层',
  reviewTimeoutHours: 24,
  stockWarningThreshold: 10,
  pointsRate: 1,
  pointsExpiryDays: 365,
  rechargeTiers: [
    { amount: 100, bonus: 5, label: '充100送5' },
    { amount: 300, bonus: 20, label: '充300送20' },
    { amount: 500, bonus: 40, label: '充500送40' },
    { amount: 1000, bonus: 100, label: '充1000送100' },
  ],
  referralRewardPoints: 500,
  bloodBookingConfig: {
    dogBloodTypes: [
      'DEA1.1阳性',
      'DEA1.1阴性',
      'DEA1.1阴性 + DEA7阴性',
      'DEA7阴性',
      '未检测，需协助配血',
    ],
    catBloodTypes: ['A型', 'B型', 'AB型', '未检测，需协助配血'],
    dogVolumeOptions: [100, 200, 300, 400, 500],
    catVolumeOptions: [50, 100, 150, 200],
    priceRules: [],
  },
};
