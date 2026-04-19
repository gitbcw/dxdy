"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calcCommission = calcCommission;
exports.calcRechargeBonus = calcRechargeBonus;
exports.calcPoints = calcPoints;
exports.calcOrderTotal = calcOrderTotal;
/** 计算提成金额 */
function calcCommission(amount, rate) {
    return Math.round(amount * rate * 100) / 100;
}
/** 计算充值赠送金额（匹配最高档位） */
function calcRechargeBonus(amount, tiers) {
    let bonus = 0;
    for (const tier of tiers) {
        if (amount >= tier.amount) {
            bonus = tier.bonus;
        }
    }
    return bonus;
}
/** 计算积分（按积分比例，1元 = N积分） */
function calcPoints(amount, pointsRate) {
    return Math.floor(amount * pointsRate);
}
/** 计算订单总金额 */
function calcOrderTotal(items) {
    return items.reduce((sum, item) => sum + item.totalPrice, 0);
}
//# sourceMappingURL=calc.js.map