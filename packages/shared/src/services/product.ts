import type { Product, ProductCategory } from '../types/product';
import { mockProducts, mockCategories } from '../mock';
import { addLog } from './system';

let products = [...mockProducts];
let categories = [...mockCategories];

const delay = (ms = 200) => new Promise<void>(r => setTimeout(r, ms));

/** 获取商品列表（可按可见性过滤） */
export async function getProducts(options?: {
  visibility?: string;
  categoryId?: string;
  keyword?: string;
}): Promise<Product[]> {
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
export async function getProductById(id: string): Promise<Product | null> {
  await delay(100);
  return products.find(p => p.id === id) ?? null;
}

/** 获取分类列表 */
export async function getCategories(): Promise<ProductCategory[]> {
  await delay(100);
  return categories;
}

/** 更新商品（后台管理） */
export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product | null> {
  await delay();
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return null;
  const old = products[idx];
  products[idx] = { ...products[idx], ...updates };
  const updated = products[idx];

  // 上下架操作记录日志
  if (updates.status && updates.status !== old.status) {
    addLog({
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
export async function createProduct(product: Product): Promise<Product> {
  await delay();
  products.push(product);
  addLog({
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
export async function getAllProducts(): Promise<Product[]> {
  await delay();
  return products;
}
