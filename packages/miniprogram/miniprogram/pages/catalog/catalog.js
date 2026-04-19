"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { getCategories, getProducts, formatMoney } = require('../../services/index');
Page({
    data: {
        categories: [],
        allProducts: [],
        products: [],
        activeCategory: '',
        roleLabel: '个人客户',
        pageTitle: '今天先把要买的东西找出来',
        pageSubtitle: '把常购、机构专区和低库存提醒放在最前面，减少解释，直接开始采购。',
        summaryCards: [],
        quickFilters: [],
        activeQuickFilter: 'all',
        emptyText: '当前分类暂无商品',
    },
    onLoad() {
        this.loadCategories();
    },
    async loadCategories() {
        const cats = await getCategories();
        this.setData({ categories: cats });
        if (cats.length > 0) {
            this.setData({ activeCategory: cats[0].id });
            this.loadProducts();
        }
    },
    async loadProducts() {
        if (!this.data.activeCategory)
            return;
        const user = getApp().globalData.userInfo;
        const isInstitution = user?.customerType === 'institution';
        const visibility = isInstitution ? 'institution' : 'personal';
        const products = await getProducts({ visibility, categoryId: this.data.activeCategory });
        const mappedProducts = products.map((product) => ({
            ...product,
            priceText: formatMoney(isInstitution ? product.institutionPrice : (product.personalPrice || product.institutionPrice)),
            specText: product.specs?.[0]?.value || '标准规格',
            tagText: product.visibility === 'institution_only' ? '机构专属' : product.isBloodPack ? '预约服务' : '可采购',
            lowStock: product.stock <= 5,
            leadText: product.isBloodPack ? '适合直接发起预约' : product.stock <= 5 ? '库存偏低，建议尽快下单' : '可直接加入采购单',
        }));
        const quickFilters = this.getQuickFilters(mappedProducts, isInstitution);
        const activeQuickFilter = quickFilters.some((item) => item.key === this.data.activeQuickFilter)
            ? this.data.activeQuickFilter
            : 'all';
        this.setData({
            roleLabel: isInstitution ? '宠物医院客户' : '个人客户',
            pageTitle: isInstitution ? '先挑常购和机构价商品' : '先挑最常买的商品',
            pageSubtitle: isInstitution
                ? '机构客户可以直接看到机构价、血液制品和库存提醒，采购路径更短。'
                : '个人客户优先看到可直接购买的商品和库存状态，尽快完成下单。',
            summaryCards: [
                { value: String(mappedProducts.length), label: '当前分类商品', desc: '按身份过滤后的结果' },
                { value: String(mappedProducts.filter((item) => item.lowStock).length), label: '低库存提醒', desc: '建议优先采购' },
                { value: String(mappedProducts.filter((item) => item.isBloodPack).length), label: isInstitution ? '预约服务' : '服务商品', desc: isInstitution ? '可直接发起预约' : '登录机构后可见更多能力' },
            ],
            quickFilters,
            activeQuickFilter,
            allProducts: mappedProducts,
            products: this.filterProducts(mappedProducts, activeQuickFilter),
            emptyText: activeQuickFilter === 'blood' ? '当前分类暂无可预约服务' : '当前分类暂无商品',
        });
    },
    getQuickFilters(products, isInstitution) {
        const filters = [
            { key: 'all', label: '全部', count: products.length },
            { key: 'common', label: '常购', count: products.filter((item) => !item.isBloodPack).length },
            { key: 'low', label: '低库存', count: products.filter((item) => item.lowStock).length },
        ];
        if (isInstitution) {
            filters.splice(2, 0, {
                key: 'blood',
                label: '预约服务',
                count: products.filter((item) => item.isBloodPack).length,
            });
            filters.push({
                key: 'institution',
                label: '机构专区',
                count: products.filter((item) => item.visibility === 'institution_only').length,
            });
        }
        return filters;
    },
    filterProducts(products, filterKey) {
        if (filterKey === 'blood')
            return products.filter((item) => item.isBloodPack);
        if (filterKey === 'low')
            return products.filter((item) => item.lowStock);
        if (filterKey === 'institution')
            return products.filter((item) => item.visibility === 'institution_only');
        if (filterKey === 'common')
            return products.filter((item) => !item.isBloodPack);
        return products;
    },
    onCategoryTap(e) {
        this.setData({ activeCategory: e.currentTarget.dataset.id });
        this.loadProducts();
    },
    onQuickFilterTap(e) {
        const filterKey = e.currentTarget.dataset.key;
        this.setData({
            activeQuickFilter: filterKey,
            products: this.filterProducts(this.data.allProducts, filterKey),
            emptyText: filterKey === 'blood' ? '当前分类暂无可预约服务' : '当前分类暂无商品',
        });
    },
    onProductTap(e) {
        wx.navigateTo({ url: `/pages/orders/create/create?productId=${e.currentTarget.dataset.id}` });
    },
});
