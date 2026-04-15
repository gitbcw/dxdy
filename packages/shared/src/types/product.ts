/** 商品规格 */
export interface ProductSpec {
  name: string;
  value: string;
}

/** 商品可见范围 */
export type ProductVisibility = 'all' | 'institution_only' | 'personal_only';

/** 商品状态 */
export type ProductStatus = 'on_sale' | 'off_sale';

/** 退换货规则 */
export interface ReturnPolicy {
  enabled: boolean;
  deadlineDays: number;
  note: string;
}

/** 商品 */
export interface Product {
  id: string;
  name: string;
  description: string;
  images: string[];
  category: string;
  specs: ProductSpec[];
  institutionPrice: number;
  personalPrice: number;
  pointsPrice?: number;
  visibility: ProductVisibility;
  stock: number;
  status: ProductStatus;
  returnPolicy: ReturnPolicy;
  isBloodPack: boolean;
  testInfoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/** 商品分类 */
export interface ProductCategory {
  id: string;
  name: string;
  icon?: string;
  sort: number;
}
