"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { loginByPhone } = require('./services/index');
App({
    globalData: {
        userInfo: null,
        token: '',
        userRole: 'customer_institution',
    },
    onLaunch() {
        // 从本地存储恢复登录状态
        const userStr = wx.getStorageSync('current_user');
        const storedRole = wx.getStorageSync('demo_role');
        if (storedRole) {
            this.globalData.userRole = storedRole;
        }
        if (userStr) {
            try {
                this.globalData.userInfo = JSON.parse(userStr);
            }
            catch { /* ignore */ }
        }
        else {
            this.switchDemoRole?.('customer_institution');
        }
    },
    async switchDemoRole(role) {
        const phoneMap = {
            customer_institution: '13821003456',
            customer_personal: '13877005678',
            salesperson: '13811001234',
            clerk: '13833007890',
        };
        this.globalData.userRole = role;
        wx.setStorageSync('demo_role', role);
        const phone = phoneMap[role] || phoneMap.customer_institution;
        const result = await loginByPhone(phone);
        if (result.success && result.user) {
            this.globalData.userInfo = result.user;
            wx.setStorageSync('current_user', JSON.stringify(result.user));
        }
    },
});
