"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProducts = getProducts;
exports.getProductById = getProductById;
exports.getCategories = getCategories;
exports.updateProduct = updateProduct;
exports.createProduct = createProduct;
exports.getAllProducts = getAllProducts;
const index_1 = require("../mock/index");
const system_1 = require("./system");
let products = [...index_1.mockProducts];
let categories = [...index_1.mockCategories];
const delay = (ms = 200) => new Promise(r => setTimeout(r, ms));
/** 获取商品列表（可按可见性过滤） */
async function getProducts(options) {
    await delay();
    let result = products.filter(p => p.status === 'on_sale');
    if (options?.visibility && options.visibility !== 'all') {
        result = result.filter(p => p.visibility === options.visibility || p.visibility === 'all');
    }
    if (options?.categoryId) {
        result = result.filter(p => p.category === options.categoryId);
    }
    if (options?.keyword) {
        const kw = options.keyword.toLowerCase();
        result = result.filter(p => p.name.toLowerCase().includes(kw));
    }
    return result;
}
/** 获取商品详情 */
async function getProductById(id) {
    await delay(100);
    return products.find(p => p.id === id) ?? null;
}
/** 获取分类列表 */
async function getCategories() {
    await delay(100);
    return categories;
}
/** 更新商品（后台管理） */
async function updateProduct(id, updates) {
    await delay();
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1)
        return null;
    const old = products[idx];
    products[idx] = { ...products[idx], ...updates };
    const updated = products[idx];
    // 上下架操作记录日志
    if (updates.status && updates.status !== old.status) {
        (0, system_1.addLog)({
            operatorId: 'admin',
            operatorName: '商品管理员',
            operatorRole: '商品管理员',
            action: updates.status === 'on_sale' ? '商品上架' : '商品下架',
            target: `商品 ${updated.name} (${id})`,
            detail: `${old.status} → ${updates.status}`,
            result: 'success',
        });
    }
    return updated;
}
/** 创建商品（后台管理） */
async function createProduct(product) {
    await delay();
    products.push(product);
    (0, system_1.addLog)({
        operatorId: 'admin',
        operatorName: '商品管理员',
        operatorRole: '商品管理员',
        action: '商品创建',
        target: `商品 ${product.name} (${product.id})`,
        detail: `库存 ${product.stock}`,
        result: 'success',
    });
    return product;
}
/** 获取全部商品（含已下架，后台用） */
async function getAllProducts() {
    await delay();
    return products;
}
//# sourceMappingURL=product.js.map