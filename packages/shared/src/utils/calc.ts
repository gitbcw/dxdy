import type { SystemConfig } from '../types/system';

/** 计算提成金额 */
export function calcCommission(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

/** 计算充值赠送金额（匹配最高档位） */
export function calcRechargeBonus(amount: number, tiers: SystemConfig['rechargeTiers']): number {
  let bonus = 0;
  for (const tier of tiers) {
    if (amount >= tier.amount) {
      bonus = tier.bonus;
    }
  }
  return bonus;
}

/** 计算积分（按积分比例，1元 = N积分） */
export function calcPoints(amount: number, pointsRate: number): number {
  return Math.floor(amount * pointsRate);
}

/** 计算订单总金额 */
export function calcOrderTotal(items: { totalPrice: number }[]): number {
  return items.reduce((sum, item) => sum + item.totalPrice, 0);
}
