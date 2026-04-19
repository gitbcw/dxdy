import type { SystemConfig } from '../types/system';
/** 计算提成金额 */
export declare function calcCommission(amount: number, rate: number): number;
/** 计算充值赠送金额（匹配最高档位） */
export declare function calcRechargeBonus(amount: number, tiers: SystemConfig['rechargeTiers']): number;
/** 计算积分（按积分比例，1元 = N积分） */
export declare function calcPoints(amount: number, pointsRate: number): number;
/** 计算订单总金额 */
export declare function calcOrderTotal(items: {
    totalPrice: number;
}[]): number;
//# sourceMappingURL=calc.d.ts.map