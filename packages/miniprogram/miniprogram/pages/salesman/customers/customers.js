"use strict";
const { getSalesmanCustomers, formatMoney } = require('../../../services/index');
Page({
    data: {
        customers: [],
        visibleCustomers: [],
        totalAmount: '0.00',
        totalCount: 0,
        summaryCards: [],
        focusCustomers: [],
        filters: [],
        activeFilter: 'all',
    },
    onShow() {
        this.loadCustomers();
    },
    async loadCustomers() {
        const customers = await getSalesmanCustomers();
        const sortedCustomers = customers
            .map((customer) => ({
            ...customer,
            avatarText: customer.nickname.charAt(0),
            amountText: formatMoney(customer.totalAmount),
            priorityTag: customer.type === 'institution' ? '机构客户' : '个人客户',
            priorityText: customer.orderCount >= 3
                ? '适合推动复购'
                : customer.type === 'institution'
                    ? '适合继续经营'
                    : '适合补充服务说明',
        }))
            .sort((a, b) => b.totalAmount - a.totalAmount);
        const filters = [
            { key: 'all', label: '全部', count: sortedCustomers.length },
            { key: 'institution', label: '机构客户', count: sortedCustomers.filter((item) => item.type === 'institution').length },
            { key: 'active', label: '高活跃', count: sortedCustomers.filter((item) => item.orderCount >= 3).length },
            { key: 'afterSale', label: '售后关注', count: sortedCustomers.filter((item) => item.exchangeCount > 0).length },
        ];
        this.setData({
            customers: sortedCustomers,
            visibleCustomers: this.filterCustomers(sortedCustomers, this.data.activeFilter),
            totalAmount: formatMoney(sortedCustomers.reduce((sum, item) => sum + item.totalAmount, 0)),
            totalCount: sortedCustomers.length,
            summaryCards: [
                { value: String(sortedCustomers.length), label: '绑定客户', desc: '优先经营机构客户' },
                { value: `¥${formatMoney(sortedCustomers.reduce((sum, item) => sum + item.totalAmount, 0))}`, label: '累计采购', desc: '可作为跟进强度参考' },
                { value: String(sortedCustomers.filter((item) => item.exchangeCount > 0).length), label: '售后关注', desc: '先看会影响满意度的客户' },
            ],
            focusCustomers: sortedCustomers.slice(0, 3),
            filters,
        });
    },
    filterCustomers(customers, filterKey) {
        if (filterKey === 'institution')
            return customers.filter((item) => item.type === 'institution');
        if (filterKey === 'active')
            return customers.filter((item) => item.orderCount >= 3);
        if (filterKey === 'afterSale')
            return customers.filter((item) => item.exchangeCount > 0);
        return customers;
    },
    onFilterTap(e) {
        const filterKey = e.currentTarget.dataset.key;
        this.setData({
            activeFilter: filterKey,
            visibleCustomers: this.filterCustomers(this.data.customers, filterKey),
        });
    },
});
