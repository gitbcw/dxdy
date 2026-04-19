import type { Product, ProductCategory } from '../types/product';
/** 获取商品列表（可按可见性过滤） */
export declare function getProducts(options?: {
    visibility?: string;
    categoryId?: string;
    keyword?: string;
}): Promise<Product[]>;
/** 获取商品详情 */
export declare function getProductById(id: string): Promise<Product | null>;
/** 获取分类列表 */
export declare function getCategories(): Promise<ProductCategory[]>;
/** 更新商品（后台管理） */
export declare function updateProduct(id: string, updates: Partial<Product>): Promise<Product | null>;
/** 创建商品（后台管理） */
export declare function createProduct(product: Product): Promise<Product>;
/** 获取全部商品（含已下架，后台用） */
export declare function getAllProducts(): Promise<Product[]>;
//# sourceMappingURL=product.d.ts.map