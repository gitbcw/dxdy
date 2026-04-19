"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatMoney = formatMoney;
exports.formatDate = formatDate;
exports.formatDateTime = formatDateTime;
exports.maskPhone = maskPhone;
function normalizeDateInput(date) {
    if (date instanceof Date)
        return date;
    // iOS WebView is strict about date parsing and rejects "YYYY-MM-DD HH:mm".
    const normalized = date.includes('T') ? date : date.replace(' ', 'T');
    return new Date(normalized);
}
/** 格式化金额（保留两位小数，千分位逗号） */
function formatMoney(amount) {
    return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
/** 格式化日期为 YYYY-MM-DD */
function formatDate(date) {
    const d = normalizeDateInput(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
/** 格式化日期时间为 YYYY-MM-DD HH:mm */
function formatDateTime(date) {
    const d = normalizeDateInput(date);
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${formatDate(d)} ${h}:${min}`;
}
/** 手机号脱敏 138****1234 */
function maskPhone(phone) {
    if (phone.length !== 11)
        return phone;
    return phone.slice(0, 3) + '****' + phone.slice(7);
}
//# sourceMappingURL=format.js.map