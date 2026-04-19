"use strict";
const { getCommissionSummary, requestWithdrawalByAmount, getCommissionRecords } = require('../../../services/index');
Page({
    data: {
        summary: null,
        canWithdraw: false,
        records: [],
    },
    onShow() {
        this.loadData();
    },
    async loadData() {
        const user = getApp().globalData.userInfo;
        const [summary, records] = await Promise.all([
            getCommissionSummary(),
            user?.id ? getCommissionRecords(user.id) : Promise.resolve([]),
        ]);
        // 格式化提成记录
        const formattedRecords = records.map((r) => ({
            ...r,
            amountText: r.amount >= 0 ? `+${r.amount.toFixed(2)}` : r.amount.toFixed(2),
            amountClass: r.amount >= 0 ? 'positive' : 'negative',
            sourceLabel: this.getSourceLabel(r.sourceType),
        }));
        this.setData({
            summary,
            canWithdraw: summary.withdrawable >= 100,
            records: formattedRecords,
        });
    },
    getSourceLabel(type) {
        const map = {
            order: '订单提成',
            return_deduction: '退货扣减',
            exchange_adjustment: '换货调整',
            price_modification: '改价调整',
        };
        return map[type] || type;
    },
    onWithdraw() {
        const { summary } = this.data;
        wx.showModal({
            title: '确认提现',
            content: `可提现金额：¥${summary.withdrawable}\n到账银行卡：****6789`,
            confirmText: '确认提现',
            success: async (res) => {
                if (res.confirm) {
                    wx.showLoading({ title: '提交中...' });
                    try {
                        await requestWithdrawalByAmount({ amount: summary.withdrawable });
                        wx.hideLoading();
                        wx.showToast({ title: '申请已提交，审核中' });
                        this.loadData();
                    }
                    catch (e) {
                        wx.hideLoading();
                        wx.showToast({ title: '提交失败', icon: 'none' });
                    }
                }
            },
        });
    },
});
