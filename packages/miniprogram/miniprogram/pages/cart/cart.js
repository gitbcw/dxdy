"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToCart = addToCart;
exports.getCartItems = getCartItems;
exports.clearCart = clearCart;
const { formatMoney } = require('../../services/index');
const icons = require('../../services/icons');
const CART_KEY = 'cart_items';
function saveCart(items) {
    wx.setStorageSync(CART_KEY, items);
}
function loadCart() {
    try {
        const stored = wx.getStorageSync(CART_KEY);
        return stored ? JSON.parse(stored) : [];
    }
    catch {
        return [];
    }
}
const cartStore = loadCart();
Page({
    data: {
        items: [],
        total: '0.00',
        isEmpty: true,
        iconDelete: icons.delete,
        iconAdd: icons.add,
        iconMinus: icons.minus,
    },
    onShow() {
        this.refreshCart();
    },
    refreshCart() {
        const user = getApp().globalData.userInfo;
        const isInst = user?.customerType === 'institution';
        const total = cartStore.reduce((s, item) => {
            const price = isInst ? item.institutionPrice : (item.personalPrice || item.institutionPrice);
            return s + price * item.quantity;
        }, 0);
        const colors = ['orange', 'purple', 'mint', 'pink'];
        this.setData({
            items: cartStore.map((item, idx) => {
                const price = isInst ? item.institutionPrice : (item.personalPrice || item.institutionPrice);
                return {
                    ...item,
                    lineTotal: formatMoney(price * item.quantity),
                    unitPrice: price,
                    bgColor: item.bgColor || colors[idx % colors.length]
                };
            }),
            total: formatMoney(total),
            isEmpty: cartStore.length === 0,
        });
    },
    onQuantityChange(e) {
        const { index, delta } = e.currentTarget.dataset;
        const item = cartStore[index];
        if (!item)
            return;
        item.quantity = Math.max(1, item.quantity + delta);
        saveCart(cartStore);
        this.refreshCart();
    },
    onRemove(e) {
        cartStore.splice(e.currentTarget.dataset.index, 1);
        saveCart(cartStore);
        this.refreshCart();
    },
    onCheckout() {
        if (cartStore.length === 0)
            return;
        const user = getApp().globalData.userInfo;
        if (!user) {
            wx.navigateTo({ url: '/pages/login/login' });
            return;
        }
        wx.navigateTo({ url: '/pages/orders/create/create?fromCart=1' });
    },
    onClearCart() {
        if (cartStore.length === 0)
            return;
        wx.showModal({
            title: '清空购物车',
            content: '确定要清空购物车吗？',
            confirmColor: '#0A6E7C',
            success: (res) => {
                if (res.confirm) {
                    cartStore.length = 0;
                    saveCart(cartStore);
                    this.refreshCart();
                }
            }
        });
    },
    onShop() {
        wx.switchTab({ url: '/pages/home/home' });
    },
});
// 导出供其他页面添加商品
function addToCart(product, quantity = 1) {
    const existing = cartStore.find((i) => i.id === product.id);
    if (existing) {
        existing.quantity += quantity;
    }
    else {
        cartStore.push({ ...product, quantity });
    }
    saveCart(cartStore);
}
function getCartItems() {
    return [...cartStore];
}
function clearCart() {
    cartStore.length = 0;
    saveCart(cartStore);
}
