"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const icons = require('../../../services/icons');
const { getClerkOrderById, clerkShipOrder } = require('../../../services/index');
Page({
    data: {
        order: null,
        showExpressPanel: false,
        selectedCompany: '',
        expressNo: '',
        expressCompanies: ['顺丰速运', '中通快递', '圆通速递', '韵达快递', '申通快递', '中国邮政'],
        iconClock: icons.clock,
        iconRefresh: icons.refresh,
    },
    onLoad(e) {
        if (e.id)
            this.loadOrder(e.id);
    },
    async loadOrder(id) {
        const order = await getClerkOrderById(id);
        this.setData({ order });
    },
    onInputExpress() {
        this.setData({ showExpressPanel: true });
    },
    onSelectCompany(e) {
        this.setData({ selectedCompany: e.currentTarget.dataset.company });
    },
    onExpressNoInput(e) {
        this.setData({ expressNo: e.detail.value });
    },
    async onSubmitExpress() {
        if (!this.data.selectedCompany || !this.data.expressNo) {
            wx.showToast({ title: '请选择快递公司并填写单号', icon: 'none' });
            return;
        }
        wx.showLoading({ title: '提交中...' });
        try {
            await clerkShipOrder({
                orderId: this.data.order.id,
                expressCompany: this.data.selectedCompany,
                expressNo: this.data.expressNo,
            });
            wx.hideLoading();
            wx.showToast({ title: '提交成功' });
            this.setData({ showExpressPanel: false });
            this.loadOrder(this.data.order.id);
        }
        catch (e) {
            wx.hideLoading();
            wx.showToast({ title: '提交失败', icon: 'none' });
        }
    },
    async onScanTap() {
        try {
            const res = await wx.scanCode({ onlyFromCamera: true });
            if (res.result) {
                this.setData({ expressNo: res.result });
                wx.showToast({ title: '扫码成功', icon: 'success' });
            }
        }
        catch (e) {
            wx.showToast({ title: '扫码失败，请手动输入', icon: 'none' });
        }
    },
    onClosePanel() {
        this.setData({ showExpressPanel: false, selectedCompany: '', expressNo: '' });
    },
});
