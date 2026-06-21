'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CityMultiSelect } from '@/components/admin/city-multi-select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { uploadFileToCloudBase } from '@/lib/upload';
import {
  fetchProductsAndCategories,
  fetchProductById,
  fetchProductImagesByIds,
  createProduct,
  updateProduct,
  createProductCategory,
  updateProductCategory,
  deleteProductCategory,
  fetchSystemConfig,
  saveSystemConfig,
} from '@/lib/services/database';
import { manageProduct } from '@/lib/services/functions';
import { writeAdminLog } from '@/lib/admin-log';
import { formatMoney } from '@/lib/format';
import type { CatalogBanner, Product, ProductCategory, ProductVisibility, ProductType, SystemConfig } from '@/lib/types';

type ProductFormState = {
  name: string;
  description: string;
  category: string;
  institutionPrice: string;
  personalPrice: string;
  visibility: ProductVisibility;
  stock: string;
  salesCount: string;
  serviceTags: string;
  specs: string;
  images: string[];
  productType: ProductType;
  bookingEnabled: boolean;
  bookingLeadDays: string;
  bookingLocations: string;
  bookingRequireInstitution: boolean;
  bookingRequireVerification: boolean;
  purchaseMinQuantity: string;
  purchaseMaxPerOrder: string;
  purchaseMaxPerUser: string;
  agreementEnabled: boolean;
  agreementTitle: string;
  agreementContent: string;
  salesCountEnabled: boolean;
  urgentEnabled: boolean;
  urgentFee: string;
  urgentDescription: string;
  redeemableCategory: string;
  visibleRegions: string[];
  hiddenRegions: string[];
  validDays: string;
  promotionEnabled: boolean;
  promotionPrice: string;
  promotionStart: string;
  promotionEnd: string;
};

const visibilityLabel: Record<string, string> = {
  all: '全部可见',
  institution_only: '仅医院',
};

function formatRegionLabel(product: Product) {
  const visible = product.visibleRegions || []
  const hidden = product.hiddenRegions || []
  if (hidden.length) {
    return `禁 ${hidden.slice(0, 2).join('、')}${hidden.length > 2 ? ` 等${hidden.length}城` : ''}`
  }
  if (visible.length) {
    return `限 ${visible.slice(0, 2).join('、')}${visible.length > 2 ? ` 等${visible.length}城` : ''}`
  }
  return '全国'
}

const productStatusLabel: Record<'all' | Product['status'], string> = {
  all: '全部状态',
  on_sale: '在售',
  off_sale: '已下架',
};

type StockFilter = 'all' | 'warning' | 'healthy' | 'empty';

const stockFilterLabel: Record<StockFilter, string> = {
  all: '全部库存',
  warning: '库存预警',
  healthy: '库存正常',
  empty: '库存为 0',
};

const STOCK_WARNING_THRESHOLD = 10;
const MAX_PRODUCT_IMAGE_SIZE = 2 * 1024 * 1024;
const MAX_CATALOG_BANNER_IMAGE_SIZE = 700 * 1024;
const PRODUCT_IMAGE_PUBLIC_BASE_URL = 'https://636c-cloud1-d7g7ctn4m86bada89-1433980811.tcb.qcloud.la';
const PRODUCT_IMAGE_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DEFAULT_SERVICE_TAGS = ['冷链配送', '支持预约', '质量问题售后'];

function RequiredMark() {
  return <span className="ml-0.5 text-destructive">*</span>;
}

function toDateInputValue(value: string) {
  return value ? value.slice(0, 10) : '';
}

function DateTimePickerDisplay({
  value,
  onChange,
  placeholder,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (typeof input.showPicker === 'function') {
      input.showPicker();
    } else {
      input.click();
    }
  }

  return (
    <button
      type="button"
      className="relative flex h-8 w-full items-center rounded-lg border border-input bg-background px-2.5 py-1 text-left text-sm"
      onClick={openPicker}
    >
      <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
        {toDateInputValue(value) || placeholder}
      </span>
      <CalendarDays className="ml-auto size-4 text-muted-foreground" />
      <input
        ref={inputRef}
        type="date"
        className="pointer-events-none absolute inset-0 opacity-0"
        value={toDateInputValue(value)}
        required={required}
        onChange={event => onChange(toDateInputValue(event.target.value))}
        title={placeholder}
        tabIndex={-1}
      />
    </button>
  );
}

const emptyProductForm = (): ProductFormState => ({
  name: '',
  description: '',
  category: '',
  institutionPrice: '',
  personalPrice: '',
  visibility: 'all',
  stock: '',
  salesCount: '',
  serviceTags: DEFAULT_SERVICE_TAGS.join(','),
  specs: '',
  images: [],
  productType: 'physical',
  bookingEnabled: false,
  bookingLeadDays: '2',
  bookingLocations: '',
  bookingRequireInstitution: false,
  bookingRequireVerification: false,
  purchaseMinQuantity: '1',
  purchaseMaxPerOrder: '0',
  purchaseMaxPerUser: '0',
  agreementEnabled: false,
  agreementTitle: '',
  agreementContent: '',
  salesCountEnabled: false,
  urgentEnabled: false,
  urgentFee: '0',
  urgentDescription: '',
  redeemableCategory: '',
  visibleRegions: [],
  hiddenRegions: [],
  validDays: '365',
  promotionEnabled: false,
  promotionPrice: '',
  promotionStart: '',
  promotionEnd: '',
});

function productSpecsToText(specs: Product['specs']) {
  return specs.map(spec => spec.value).join(',');
}

function serviceTagsToText(tags?: string[]) {
  return Array.isArray(tags) ? tags.join(',') : DEFAULT_SERVICE_TAGS.join(',');
}

function parseServiceTags(value: string) {
  return value
    .split(/[,，]/)
    .map(tag => tag.trim())
    .filter(Boolean);
}

function getSafeImageFileName(file: File) {
  const name = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'image';
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  return `${name}.${ext}`;
}

async function uploadFileToStorage(file: File): Promise<string> {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const cloudPath = `products/${timestamp}-${random}-${getSafeImageFileName(file)}`;
  const uploadedPath = await uploadFileToCloudBase(file, cloudPath, {
    allowedTypes: PRODUCT_IMAGE_ALLOWED_TYPES,
    maxSize: MAX_PRODUCT_IMAGE_SIZE,
    maxWidth: 1000,
    maxHeight: 1000,
    quality: 0.72,
    outputType: 'image/jpeg',
  });
  return `${PRODUCT_IMAGE_PUBLIC_BASE_URL}/${uploadedPath}`;
}

async function uploadCatalogBannerToStorage(file: File): Promise<string> {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const cloudPath = `products/catalog-banners/${timestamp}-${random}-${getSafeImageFileName(file)}`;
  const uploadedPath = await uploadFileToCloudBase(file, cloudPath, {
    allowedTypes: PRODUCT_IMAGE_ALLOWED_TYPES,
    maxSize: MAX_CATALOG_BANNER_IMAGE_SIZE,
    maxWidth: 900,
    maxHeight: 360,
    quality: 0.68,
    outputType: 'image/jpeg',
  });
  return `${PRODUCT_IMAGE_PUBLIC_BASE_URL}/${uploadedPath}`;
}

async function processImageFiles(files: FileList | null): Promise<string[]> {
  if (!files || files.length === 0) return [];
  return Promise.all(Array.from(files).map(uploadFileToStorage));
}

function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML ?? '');
  }

  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap gap-2 border-b p-2">
        <Button type="button" variant="outline" size="sm" onClick={() => runCommand('bold')}>加粗</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => runCommand('italic')}>斜体</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => runCommand('underline')}>下划线</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => runCommand('formatBlock', 'h2')}>标题</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => runCommand('insertUnorderedList')}>列表</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => runCommand('removeFormat')}>清除格式</Button>
      </div>
      <div className="relative">
        {!value && (
          <div className="pointer-events-none absolute top-3 left-3 text-sm text-muted-foreground">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="min-h-48 p-3 text-sm outline-none"
          onInput={event => onChange(event.currentTarget.innerHTML)}
        />
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | Product['status']>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | ProductVisibility>('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<ProductFormState>(emptyProductForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ProductFormState>(emptyProductForm);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [categoryForm, setCategoryForm] = useState({ id: '', name: '', sort: '' });
  const [categoryConfigOpen, setCategoryConfigOpen] = useState(false);
  const [catalogBannerConfigOpen, setCatalogBannerConfigOpen] = useState(false);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [savingCatalogBanners, setSavingCatalogBanners] = useState(false);
  const [catalogBannerProductSearch, setCatalogBannerProductSearch] = useState<Record<string, string>>({});

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await fetchProductsAndCategories();
      const config = await fetchSystemConfig();
      setProducts(data.products);
      setCategories(data.categories);
      setSystemConfig(config);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '读取商品数据失败');
    } finally {
      setLoading(false);
    }
  }

  async function refreshProducts() {
    try {
      const data = await fetchProductsAndCategories();
      setProducts(data.products);
      setCategories(data.categories);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '读取商品数据失败');
    }
  }

  async function updateProductRemote(id: string, updates: Partial<Product>) {
    const updated = await updateProduct(id, updates);
    await writeAdminLog({ operator: user, action: 'update_product', target: id, detail: `更新商品 ${id}` });
    return updated;
  }

  async function createProductRemote(product: Product) {
    const created = await createProduct(product);
    await writeAdminLog({ operator: user, action: 'create_product', target: product.id, detail: `创建商品 ${product.name}` });
    return created;
  }

  function updateCatalogBanner(index: number, patch: Partial<CatalogBanner>) {
    if (!systemConfig) return;
    const catalogBanners = [...(systemConfig.catalogBanners || [])];
    catalogBanners[index] = { ...catalogBanners[index], ...patch };
    setSystemConfig({ ...systemConfig, catalogBanners });
  }

  async function handleCatalogBannerImageUpload(index: number, files: FileList | null) {
    try {
      const file = files?.[0];
      if (!file) return;
      const imageUrl = await uploadCatalogBannerToStorage(file);
      if (!imageUrl) return;
      updateCatalogBanner(index, { imageUrl });
      setErrorMsg('');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '上传轮播图失败');
    }
  }

  function addCatalogBanner() {
    if (!systemConfig) return;
    const now = Date.now();
    setSystemConfig({
      ...systemConfig,
      catalogBanners: [
        ...(systemConfig.catalogBanners || []),
        {
          id: `catalog-banner-${now}`,
          title: '',
          imageUrl: '',
          productId: '',
          enabled: true,
          sortOrder: (systemConfig.catalogBanners || []).length + 1,
        },
      ],
    });
  }

  function removeCatalogBanner(index: number) {
    if (!systemConfig) return;
    setSystemConfig({
      ...systemConfig,
      catalogBanners: (systemConfig.catalogBanners || []).filter((_, itemIndex) => itemIndex !== index),
    });
  }

  async function handleSaveCatalogBanners() {
    if (!systemConfig) return;
    setSavingCatalogBanners(true);
    setErrorMsg('');
    try {
      const saved = await saveSystemConfig(systemConfig);
      setSystemConfig(saved);
      await writeAdminLog({ operator: user, action: 'save_catalog_banners', target: 'system', detail: '保存分类页轮播配置' });
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '保存分类页轮播配置失败');
    } finally {
      setSavingCatalogBanners(false);
    }
  }

  function getCatalogBannerProductOptions(index: number) {
    const keyword = (catalogBannerProductSearch[String(index)] || '').trim().toLowerCase();
    if (!keyword) return products;
    return products.filter(product => {
      const text = `${product.name || ''} ${product.id || ''}`.toLowerCase();
      return text.includes(keyword);
    });
  }

  const catMap = Object.fromEntries(categories.map(category => [category.id, category.name]));
  const categoryFilterItems: Record<string, string> = { all: '全部分类', ...catMap };

  const filteredProducts = products.filter(product => {
    const matchesSearch =
      !search ||
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.id.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
    const matchesVisibility = visibilityFilter === 'all' || product.visibility === visibilityFilter;
    const matchesStock =
      stockFilter === 'all' ||
      (stockFilter === 'warning' && product.stock > 0 && product.stock <= STOCK_WARNING_THRESHOLD) ||
      (stockFilter === 'healthy' && product.stock > STOCK_WARNING_THRESHOLD) ||
      (stockFilter === 'empty' && product.stock === 0);

    return matchesSearch && matchesCategory && matchesStatus && matchesVisibility && matchesStock;
  });

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const pagedProductIds = pagedProducts.map(product => product.id).join('|');
  const allCurrentPageSelected =
    pagedProducts.length > 0 && pagedProducts.every(product => selectedIds.has(product.id));

  useEffect(() => {
    let cancelled = false;
    async function hydrateCurrentPageImages() {
      const ids = pagedProductIds ? pagedProductIds.split('|') : [];
      if (ids.length === 0) return;
      try {
        const imageRecords = await fetchProductImagesByIds(ids);
        if (cancelled || imageRecords.length === 0) return;
        const map = new Map(imageRecords.map(item => [item.id, item.images]));
        setProducts(prev => prev.map(product => {
          const images = map.get(product.id);
          return images ? { ...product, images } : product;
        }));
      } catch {
        // ignore hydration failures
      }
    }
    void hydrateCurrentPageImages();
    return () => { cancelled = true; };
  }, [pagedProductIds]);

  function resetToFirstPage() {
    setPage(1);
  }

  function startEdit(product: Product) {
    void (async () => {
      let target = product;
      try {
        const fullProduct = await fetchProductById(product.id);
        target = (fullProduct || product) as Product;
      } catch (error) {
        setErrorMsg(error instanceof Error ? error.message : '读取商品详情失败');
      }
      setEditProduct(target);
      const bc = target.bookingConfig;
      const pl = target.purchaseLimit;
      const ar = target.agreementRequired;
      setEditForm({
        name: target.name,
        description: target.description || '',
        category: target.category,
        institutionPrice: String(target.institutionPrice),
        personalPrice: String(target.personalPrice ?? target.institutionPrice ?? ''),
        visibility: String(target.visibility) === 'personal_only' ? 'all' : target.visibility,
        stock: String(target.stock),
        salesCount: String(target.salesCount ?? 0),
        serviceTags: serviceTagsToText(target.serviceTags),
        specs: productSpecsToText(target.specs || []),
        images: target.images ?? [],
        productType: 'physical',
        bookingEnabled: bc?.enabled || false,
        bookingLeadDays: String(bc?.leadDays || 2),
        bookingLocations: (bc?.locations || []).join(','),
        bookingRequireInstitution: bc?.requireInstitution || false,
        bookingRequireVerification: bc?.requireVerification || false,
        purchaseMinQuantity: String(pl?.minQuantity || 1),
        purchaseMaxPerOrder: String(pl?.maxQuantityPerOrder || 0),
        purchaseMaxPerUser: String(pl?.maxQuantityPerUser || 0),
        agreementEnabled: ar?.enabled || false,
        agreementTitle: ar?.title || '',
        agreementContent: ar?.content || '',
        salesCountEnabled: target.salesCountEnabled || false,
        urgentEnabled: target.urgentConfig?.enabled || false,
        urgentFee: String(target.urgentConfig?.extraFee || 0),
        urgentDescription: target.urgentConfig?.description || '',
        redeemableCategory: target.redeemableCategory || '',
        visibleRegions: target.visibleRegions ?? [],
        hiddenRegions: target.hiddenRegions ?? [],
        validDays: String(target.validDays || 365),
        promotionEnabled: !!((target.promotionPrice ?? 0) > 0 && target.promotionStart),
        promotionPrice: String(target.promotionPrice || ''),
        promotionStart: target.promotionStart || '',
        promotionEnd: target.promotionEnd || '',
      });
    })();
  }

  function buildExtendedFields(form: ProductFormState) {
    const productType: ProductType = 'physical';
    const isBloodPack = false;
    return {
      productType,
      isBloodPack,
      bookingConfig: (isBloodPack || form.bookingEnabled) ? {
        enabled: form.bookingEnabled,
        leadDays: parseInt(form.bookingLeadDays, 10) || 2,
        locations: form.bookingLocations ? form.bookingLocations.split(',').map(s => s.trim()).filter(Boolean) : [],
        requireInstitution: form.bookingRequireInstitution,
        requireVerification: form.bookingRequireVerification,
      } : undefined,
      purchaseLimit: {
        minQuantity: parseInt(form.purchaseMinQuantity, 10) || 1,
        maxQuantityPerOrder: parseInt(form.purchaseMaxPerOrder, 10) || 0,
        maxQuantityPerUser: parseInt(form.purchaseMaxPerUser, 10) || 0,
      },
      agreementRequired: form.agreementEnabled ? {
        enabled: true, title: form.agreementTitle, content: form.agreementContent,
      } : undefined,
      salesCountEnabled: form.salesCountEnabled,
      urgentConfig: (isBloodPack && form.urgentEnabled) ? {
        enabled: true,
        extraFee: parseFloat(form.urgentFee) || 0,
        description: form.urgentDescription,
      } : undefined,
      redeemableCategory: undefined,
      visibleRegions: form.visibleRegions,
      hiddenRegions: form.hiddenRegions,
      validDays: undefined,
      ...(form.promotionEnabled && form.promotionPrice ? {
        promotionPrice: parseFloat(form.promotionPrice) || 0,
        promotionStart: toDateInputValue(form.promotionStart),
        promotionEnd: toDateInputValue(form.promotionEnd),
      } : { promotionPrice: 0, promotionStart: '', promotionEnd: '' }),
    };
  }

  async function handleSave() {
    if (!editProduct) return;
    const specs = editForm.specs
      ? editForm.specs.split(',').map(value => ({ name: '规格', value: value.trim() })).filter(spec => spec.value)
      : [{ name: '默认', value: '默认' }];

    try {
      const updated = await updateProductRemote(editProduct.id, {
        name: editForm.name,
        description: editForm.description,
        category: editForm.category,
        institutionPrice: parseFloat(editForm.institutionPrice) || 0,
        personalPrice: parseFloat(editForm.personalPrice) || 0,
        visibility: editForm.visibility,
        stock: parseInt(editForm.stock, 10) || 0,
        salesCount: Math.max(0, parseInt(editForm.salesCount, 10) || 0),
        serviceTags: parseServiceTags(editForm.serviceTags),
        specs,
        images: editForm.images,
        ...buildExtendedFields(editForm),
      });
      if (updated) {
        setProducts(prev => prev.map(product => (product.id === updated.id ? { ...product, ...updated } as Product : product)));
      }
      setEditProduct(null);
      void refreshProducts();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '保存商品失败');
    }
  }

  async function toggleStatus(product: Product) {
    const newStatus = product.status === 'on_sale' ? 'off_sale' : 'on_sale';
    try {
      const result = await manageProduct({
        action: 'updateProductStatus',
        productId: product.id,
        status: newStatus,
        operatorId: user?.id || '',
        operatorName: user?.realName || user?.username || '',
      });
      if (!result?.success) {
        throw new Error(String(result?.error || '更新商品状态失败'));
      }
      const updatedAt = String(result.updatedAt || new Date().toISOString());
      setProducts(prev => prev.map(item => (
        item.id === product.id ? { ...item, status: newStatus, updatedAt } : item
      )));
      setErrorMsg('');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '更新商品状态失败');
    }
  }

  async function handleDeleteProduct(product: Product) {
    if (product.status !== 'off_sale') {
      setErrorMsg('仅已下架商品可以删除');
      return;
    }
    if (!window.confirm(`确认删除商品「${product.name}」？删除后无法恢复。`)) return;
    try {
      const result = await manageProduct({
        action: 'deleteProduct',
        productId: product.id,
        operatorId: user?.id || '',
        operatorName: user?.realName || user?.username || '',
      });
      if (!result?.success) {
        throw new Error(String(result?.error || '删除商品失败'));
      }
      setProducts(prev => prev.filter(item => item.id !== product.id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
      setErrorMsg('');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '删除商品失败');
    }
  }

  function toggleSelect(id: string) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  }

  function toggleSelectAllOnPage() {
    const newSet = new Set(selectedIds);
    if (allCurrentPageSelected) {
      pagedProducts.forEach(product => newSet.delete(product.id));
    } else {
      pagedProducts.forEach(product => newSet.add(product.id));
    }
    setSelectedIds(newSet);
  }

  async function handleCreate() {
    const requiredChecks = [
      { valid: createForm.name.trim(), message: '请填写商品名称' },
      { valid: createForm.category, message: '请选择分类' },
      { valid: createForm.institutionPrice.trim(), message: '请填写医院价' },
      { valid: createForm.personalPrice.trim(), message: '请填写未认证价' },
      { valid: createForm.stock.trim(), message: '请填写初始库存' },
      { valid: createForm.specs.trim(), message: '请填写规格' },
      { valid: createForm.images.length > 0, message: '请上传商品图片' },
      { valid: createForm.description.trim(), message: '请填写商品详情' },
      { valid: !createForm.promotionEnabled || createForm.promotionPrice.trim(), message: '请填写促销价' },
      { valid: !createForm.promotionEnabled || createForm.promotionStart, message: '请选择促销开始时间' },
      { valid: !createForm.promotionEnabled || createForm.promotionEnd, message: '请选择促销结束时间' },
    ];
    const invalid = requiredChecks.find(item => !item.valid);
    if (invalid) {
      alert(invalid.message);
      return;
    }

    const specs = createForm.specs
      ? createForm.specs.split(',').map(value => ({ name: '规格', value: value.trim() })).filter(spec => spec.value)
      : [{ name: '默认', value: '默认' }];

    const newProd = await createProductRemote({
      id: `prod_${Date.now().toString(36)}`,
      name: createForm.name,
      description: createForm.description,
      category: createForm.category,
      specs,
      institutionPrice: parseFloat(createForm.institutionPrice) || 0,
      personalPrice: parseFloat(createForm.personalPrice) || 0,
      visibility: createForm.visibility,
      stock: parseInt(createForm.stock, 10) || 0,
      serviceTags: parseServiceTags(createForm.serviceTags),
      status: 'on_sale',
      images: createForm.images,
      returnPolicy: { enabled: true, deadlineDays: 7, note: '' },
      isPrescription: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...buildExtendedFields(createForm),
    });

    if (newProd) {
      setProducts(prev => [newProd, ...prev]);
      setCreateOpen(false);
      setCreateForm(emptyProductForm());
      resetToFirstPage();
    }
  }

  async function handleCreateImageUpload(files: FileList | null) {
    try {
      const images = await processImageFiles(files);
      if (images.length === 0) return;
      setCreateForm(form => ({ ...form, images: [...form.images, ...images] }));
      setErrorMsg('');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '上传商品图片失败');
    }
  }

  async function handleEditImageUpload(files: FileList | null) {
    try {
      const images = await processImageFiles(files);
      if (images.length === 0) return;
      setEditForm(form => ({ ...form, images: [...form.images, ...images] }));
      setErrorMsg('');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '上传商品图片失败');
    }
  }

  function removeCreateImage(index: number) {
    setCreateForm(form => ({ ...form, images: form.images.filter((_, current) => current !== index) }));
  }

  function removeEditImage(index: number) {
    setEditForm(form => ({ ...form, images: form.images.filter((_, current) => current !== index) }));
  }

  async function handleBatchOffSale() {
    if (selectedIds.size === 0) return;
    try {
      for (const id of selectedIds) {
        const result = await manageProduct({
          action: 'updateProductStatus',
          productId: id,
          status: 'off_sale',
          operatorId: user?.id || '',
          operatorName: user?.realName || user?.username || '',
        });
        if (!result?.success) {
          throw new Error(String(result?.error || '批量下架失败'));
        }
      }
      const updatedAt = new Date().toISOString();
      setProducts(prev =>
        prev.map(product => (selectedIds.has(product.id) ? { ...product, status: 'off_sale', updatedAt } : product)),
      );
      setSelectedIds(new Set());
      setErrorMsg('');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '批量下架失败');
    }
  }

  async function handleSaveCategory() {
    const name = categoryForm.name.trim();
    if (!name) {
      setErrorMsg('请填写分类名称');
      return;
    }
    const id = (categoryForm.id.trim() || `cat_${Date.now().toString(36)}`).replace(/\s+/g, '_');
    const sort = parseInt(categoryForm.sort, 10) || categories.length + 1;
    try {
      const exists = categories.some(category => category.id === id);
      if (exists) {
        const updated = await updateProductCategory(id, { name, sort });
        setCategories(prev => prev.map(category => (category.id === id ? { ...category, ...updated } : category)).sort((a, b) => a.sort - b.sort));
        await writeAdminLog({ operator: user, action: 'update_category', target: id, detail: `更新商品分类 ${name}` });
      } else {
        const created = await createProductCategory({ id, name, sort });
        setCategories(prev => [...prev, created].sort((a, b) => a.sort - b.sort));
        await writeAdminLog({ operator: user, action: 'create_category', target: id, detail: `创建商品分类 ${name}` });
      }
      setCategoryForm({ id: '', name: '', sort: '' });
      setErrorMsg('');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '保存商品分类失败');
    }
  }

  async function handleDeleteCategory(category: ProductCategory) {
    const inUse = products.some(product => product.category === category.id);
    if (inUse) {
      setErrorMsg('该分类已有商品使用，无法删除');
      return;
    }
    try {
      await deleteProductCategory(category.id);
      setCategories(prev => prev.filter(item => item.id !== category.id));
      await writeAdminLog({ operator: user, action: 'delete_category', target: category.id, detail: `删除商品分类 ${category.name}` });
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '删除商品分类失败');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold">商品管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            当前共
            {' '}
            <span className="font-medium text-foreground">{filteredProducts.length}</span>
            {' '}
            个结果，已选中
            {' '}
            <span className="font-medium text-foreground">{selectedIds.size}</span>
            {' '}
            个商品
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreateOpen(true)}>新增商品</Button>
          <Button variant="outline" onClick={handleBatchOffSale} disabled={selectedIds.size === 0}>
            批量下架{selectedIds.size > 0 && ` (${selectedIds.size})`}
          </Button>
        </div>
      </div>
      {errorMsg && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMsg}
        </div>
      )}

      <Card>
        <CardContent className={categoryConfigOpen ? 'space-y-4 p-4' : 'p-3'}>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
            onClick={() => setCategoryConfigOpen(open => !open)}
            aria-expanded={categoryConfigOpen}
          >
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold">商品分类配置</h2>
              <p className="text-sm text-muted-foreground">分类保存后会同步用于小程序商品分类页和商品编辑表单。</p>
            </div>
            <span className="shrink-0 text-sm text-muted-foreground">
              {categoryConfigOpen ? '收起' : '展开'}
            </span>
          </button>
          {categoryConfigOpen && (
            <>
              <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
                <Input
                  placeholder="分类名称"
                  value={categoryForm.name}
                  onChange={event => setCategoryForm(form => ({ ...form, name: event.target.value }))}
                />
                <Input
                  placeholder="排序"
                  type="number"
                  value={categoryForm.sort}
                  onChange={event => setCategoryForm(form => ({ ...form, sort: event.target.value }))}
                />
                <Button onClick={handleSaveCategory}>保存分类</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {[...categories].sort((a, b) => a.sort - b.sort).map(category => (
                  <div key={category.id} className="flex items-center gap-2 rounded-md border px-3 text-sm">
                    <span className="font-medium">{category.name}</span>
                    <span className="text-xs text-muted-foreground">排序 {category.sort}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCategoryForm({ id: category.id, name: category.name, sort: String(category.sort) })}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCategory(category)}
                      disabled={products.some(product => product.category === category.id)}
                    >
                      删除
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className={catalogBannerConfigOpen ? 'space-y-4 p-4' : 'p-3'}>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
            onClick={() => setCatalogBannerConfigOpen(open => !open)}
            aria-expanded={catalogBannerConfigOpen}
          >
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold">分类页轮播配置</h2>
              <p className="text-sm text-muted-foreground">用于小程序商品分类页顶部轮播，点击图片会进入对应商品详情。</p>
            </div>
            <span className="shrink-0 text-sm text-muted-foreground">
              {catalogBannerConfigOpen ? '收起' : '展开'}
            </span>
          </button>
          {catalogBannerConfigOpen && (
            <div className="space-y-4">
              <div className="space-y-3">
                {(systemConfig?.catalogBanners || []).map((banner, index) => (
                  <div key={banner.id || index} className="grid gap-3 rounded-md border p-3 lg:grid-cols-[220px_1fr_120px_96px_auto]">
                    <div className="space-y-2">
                      <Label>轮播图片</Label>
                      {banner.imageUrl ? (
                        <div className="space-y-2">
                          <img src={banner.imageUrl} alt="分类页轮播图" className="h-24 w-full rounded-md border object-cover" />
                          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => updateCatalogBanner(index, { imageUrl: '' })}>
                            清除图片
                          </Button>
                        </div>
                      ) : (
                        <div className="flex h-24 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                          暂未上传
                        </div>
                      )}
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={async event => {
                          await handleCatalogBannerImageUpload(index, event.target.files);
                          event.target.value = '';
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>跳转商品</Label>
                      <Input
                        value={catalogBannerProductSearch[String(index)] || ''}
                        placeholder="搜索商品名 / ID"
                        onChange={event => setCatalogBannerProductSearch(prev => ({
                          ...prev,
                          [String(index)]: event.target.value,
                        }))}
                      />
                      <select
                        className="h-10 w-full rounded-md border px-3 text-sm"
                        value={banner.productId || ''}
                        onChange={event => updateCatalogBanner(index, { productId: event.target.value })}
                      >
                        <option value="">请选择商品</option>
                        {getCatalogBannerProductOptions(index).map(product => (
                          <option key={product.id} value={product.id}>{product.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>标题</Label>
                      <Input
                        value={banner.title || ''}
                        placeholder="可选"
                        onChange={event => updateCatalogBanner(index, { title: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>排序</Label>
                      <Input
                        type="number"
                        value={banner.sortOrder ?? index + 1}
                        onChange={event => updateCatalogBanner(index, { sortOrder: parseInt(event.target.value, 10) || 0 })}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <select
                        className="h-10 rounded-md border px-3 text-sm"
                        value={banner.enabled === false ? '0' : '1'}
                        onChange={event => updateCatalogBanner(index, { enabled: event.target.value === '1' })}
                      >
                        <option value="1">启用</option>
                        <option value="0">停用</option>
                      </select>
                      <Button variant="outline" size="sm" onClick={() => removeCatalogBanner(index)}>删除</Button>
                    </div>
                  </div>
                ))}
                {(systemConfig?.catalogBanners || []).length === 0 && (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    暂未配置轮播图，添加后保存即可在小程序分类页展示。
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={addCatalogBanner} disabled={!systemConfig}>添加轮播图</Button>
                <Button onClick={handleSaveCatalogBanners} disabled={!systemConfig || savingCatalogBanners}>
                  {savingCatalogBanners ? '保存中...' : '保存轮播配置'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Input
              placeholder="搜索商品名 / ID"
              value={search}
              onChange={event => {
                setSearch(event.target.value);
                resetToFirstPage();
              }}
            />
            <Select
              value={categoryFilter}
              onValueChange={value => {
                setCategoryFilter(value ?? 'all');
                resetToFirstPage();
              }}
            >
              <SelectTrigger>
                <SelectValue>{categoryFilterItems[categoryFilter]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={value => {
                setStatusFilter(value as 'all' | Product['status']);
                resetToFirstPage();
              }}
            >
              <SelectTrigger>
                <SelectValue>{productStatusLabel[statusFilter]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="on_sale">在售</SelectItem>
                <SelectItem value="off_sale">已下架</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={visibilityFilter}
              onValueChange={value => {
                setVisibilityFilter(value as 'all' | ProductVisibility);
                resetToFirstPage();
              }}
            >
              <SelectTrigger>
                <SelectValue>{visibilityLabel[visibilityFilter]}</SelectValue>
              </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部可见</SelectItem>
                  <SelectItem value="institution_only">仅医院</SelectItem>
                </SelectContent>
            </Select>
            <Select
              value={stockFilter}
              onValueChange={value => {
                setStockFilter(value as StockFilter);
                resetToFirstPage();
              }}
            >
              <SelectTrigger>
                <SelectValue>{stockFilterLabel[stockFilter]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部库存</SelectItem>
                <SelectItem value="warning">库存预警</SelectItem>
                <SelectItem value="healthy">库存正常</SelectItem>
                <SelectItem value="empty">库存为 0</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <input
                    type="checkbox"
                    checked={allCurrentPageSelected}
                    onChange={toggleSelectAllOnPage}
                  />
                </TableHead>
                <TableHead>图片</TableHead>
                <TableHead>商品名</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>医院价</TableHead>
                <TableHead>未认证价</TableHead>
                <TableHead>可见性</TableHead>
                <TableHead>区域限制</TableHead>
                <TableHead>库存</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                    加载商品数据中...
                  </TableCell>
                </TableRow>
              )}
              {!loading && pagedProducts.map(product => (
                <TableRow key={product.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(product.id)}
                      onChange={() => toggleSelect(product.id)}
                    />
                  </TableCell>
                  <TableCell>
                    {product.images?.[0] ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-md border object-cover"
                        />
                        <span className="text-xs text-muted-foreground">{product.images.length} 张</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">无图</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{catMap[product.category] ?? product.category}</TableCell>
                  <TableCell>¥{formatMoney(product.institutionPrice)}</TableCell>
                  <TableCell>¥{formatMoney(product.personalPrice ?? product.institutionPrice)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {visibilityLabel[product.visibility] ?? product.visibility}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground" title={formatRegionLabel(product)}>
                      {formatRegionLabel(product)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{product.stock}</span>
                      {product.stock === 0 && <Badge variant="destructive">无货</Badge>}
                      {product.stock > 0 && product.stock <= STOCK_WARNING_THRESHOLD && (
                        <Badge variant="secondary">预警</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.status === 'on_sale' ? 'default' : 'secondary'}>
                      {product.status === 'on_sale' ? '在售' : '已下架'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => startEdit(product)}>
                        编辑
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => toggleStatus(product)}>
                        {product.status === 'on_sale' ? '下架' : '上架'}
                      </Button>
                      {product.status === 'off_sale' && (
                        <Button variant="outline" size="sm" onClick={() => handleDeleteProduct(product)}>
                          删除
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && pagedProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                    没有符合当前筛选条件的商品
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              第
              {' '}
              <span className="font-medium text-foreground">{currentPage}</span>
              {' '}
              /
              {' '}
              <span className="font-medium text-foreground">{totalPages}</span>
              {' '}
              页，每页
              {' '}
              <span className="font-medium text-foreground">{pageSize}</span>
              {' '}
              条
              ，总商品数
              {' '}
              <span className="font-medium text-foreground">{products.length}</span>
              {' '}
              个
            </p>
            <div className="flex gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={value => {
                  setPageSize(parseInt(value ?? '10', 10));
                  resetToFirstPage();
                }}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / 页</SelectItem>
                  <SelectItem value="20">20 / 页</SelectItem>
                  <SelectItem value="50">50 / 页</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                下一页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editProduct} onOpenChange={() => setEditProduct(null)}>
        <DialogContent className="!w-[min(92vw,50rem)] !max-w-[min(92vw,50rem)]">
          <DialogHeader>
            <DialogTitle>编辑商品</DialogTitle>
          </DialogHeader>
          <div className="max-h-[80vh] space-y-4 overflow-y-auto py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="editName">商品名称</Label>
                <Input
                  id="editName"
                  value={editForm.name}
                  onChange={event => setEditForm(form => ({ ...form, name: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editCat">分类</Label>
                <Select
                  value={editForm.category}
                  onValueChange={value => setEditForm(form => ({ ...form, category: value ?? '' }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{catMap[editForm.category] ?? '选择分类'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="hidden">
                <Label>商品类型</Label>
                <Select
                  value={editForm.productType}
                  onValueChange={value => setEditForm(form => ({ ...form, productType: value as ProductType }))}
                >
                  <SelectTrigger><SelectValue>实体商品</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="physical">实体商品</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">购买限额（最少 / 单笔上限）</Label>
                <div className="flex gap-2">
                  <Input type="number" value={editForm.purchaseMinQuantity} onChange={e => setEditForm(form => ({ ...form, purchaseMinQuantity: e.target.value }))} />
                  <Input type="number" value={editForm.purchaseMaxPerOrder} onChange={e => setEditForm(form => ({ ...form, purchaseMaxPerOrder: e.target.value }))} />
                </div>
              </div>
            </div>
            {(editForm.productType === 'blood_pack' || editForm.bookingEnabled) && (
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">预约设置</Label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editForm.bookingEnabled} onChange={e => setEditForm(form => ({ ...form, bookingEnabled: e.target.checked }))} />
                    启用预约
                  </label>
                </div>
                {editForm.bookingEnabled && (
                  <div className="grid gap-3 grid-cols-2">
                    <div className="space-y-1"><Label className="text-xs">提前天数</Label><Input type="number" value={editForm.bookingLeadDays} onChange={e => setEditForm(form => ({ ...form, bookingLeadDays: e.target.value }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">预约地点</Label><Input value={editForm.bookingLocations} onChange={e => setEditForm(form => ({ ...form, bookingLocations: e.target.value }))} /></div>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={editForm.bookingRequireInstitution} onChange={e => setEditForm(form => ({ ...form, bookingRequireInstitution: e.target.checked }))} /> 仅限机构</label>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={editForm.bookingRequireVerification} onChange={e => setEditForm(form => ({ ...form, bookingRequireVerification: e.target.checked }))} /> 需医院认证</label>
                  </div>
                )}
              </div>
            )}
            {editForm.productType === 'blood_pack' && (
              <div className="space-y-3 rounded-md border p-3">
                <Label className="text-sm font-semibold">加急配送配置</Label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.urgentEnabled} onChange={e => setEditForm(form => ({ ...form, urgentEnabled: e.target.checked }))} /> 启用加急配送</label>
                {editForm.urgentEnabled && (
                  <div className="grid gap-3 grid-cols-2">
                    <div className="space-y-1"><Label className="text-xs">加急费用（元）</Label><Input type="number" value={editForm.urgentFee} onChange={e => setEditForm(form => ({ ...form, urgentFee: e.target.value }))} placeholder="0" /></div>
                    <div className="space-y-1"><Label className="text-xs">加急说明</Label><Input value={editForm.urgentDescription} onChange={e => setEditForm(form => ({ ...form, urgentDescription: e.target.value }))} placeholder="如：最快 1 小时送达" /></div>
                  </div>
                )}
              </div>
            )}
            {editForm.productType === 'card_voucher' && (
              <div className="space-y-3 rounded-md border p-3">
                <Label className="text-sm font-semibold">卡券配置</Label>
                <div className="grid gap-3 grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">可兑换分类</Label>
                    <Select value={editForm.redeemableCategory} onValueChange={v => setEditForm(form => ({ ...form, redeemableCategory: v ?? '' }))}>
                      <SelectTrigger><SelectValue>{editForm.redeemableCategory ? (catMap[editForm.redeemableCategory] ?? '选择分类') : '不限制'}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">不限制</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">有效天数</Label>
                    <Input type="number" value={editForm.validDays} onChange={e => setEditForm(form => ({ ...form, validDays: e.target.value }))} placeholder="365" />
                  </div>
                </div>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="editInst">医院价</Label>
                <Input
                  id="editInst"
                  type="number"
                  value={editForm.institutionPrice}
                  onChange={event => setEditForm(form => ({ ...form, institutionPrice: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPersonal">未认证价</Label>
                <Input
                  id="editPersonal"
                  type="number"
                  value={editForm.personalPrice}
                  onChange={event => setEditForm(form => ({ ...form, personalPrice: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={editForm.promotionEnabled} onChange={e => setEditForm(form => ({ ...form, promotionEnabled: e.target.checked }))} className="rounded" />
                <Label>启用限时促销</Label>
              </div>
              {editForm.promotionEnabled && (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>促销价</Label>
                    <Input type="number" value={editForm.promotionPrice} onChange={e => setEditForm(form => ({ ...form, promotionPrice: e.target.value }))} placeholder="0.01" />
                  </div>
                  <div className="space-y-2">
                    <Label>开始时间</Label>
                    <DateTimePickerDisplay
                      value={editForm.promotionStart}
                      placeholder="开始时间"
                      onChange={value => setEditForm(form => ({ ...form, promotionStart: value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>结束时间</Label>
                    <DateTimePickerDisplay
                      value={editForm.promotionEnd}
                      placeholder="结束时间"
                      onChange={value => setEditForm(form => ({ ...form, promotionEnd: value }))}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="editStock">库存</Label>
                <Input
                  id="editStock"
                  type="number"
                  value={editForm.stock}
                  onChange={event => setEditForm(form => ({ ...form, stock: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editSalesCount">销量</Label>
                <Input
                  id="editSalesCount"
                  type="number"
                  min="0"
                  value={editForm.salesCount}
                  onChange={event => setEditForm(form => ({ ...form, salesCount: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editSpecs">规格</Label>
                <Input
                  id="editSpecs"
                  value={editForm.specs}
                  onChange={event => setEditForm(form => ({ ...form, specs: event.target.value }))}
                  placeholder="5mL/支,10mL/支"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editVis">可见范围</Label>
                <Select
                  value={editForm.visibility}
                  onValueChange={value => setEditForm(form => ({ ...form, visibility: value as ProductVisibility }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{visibilityLabel[editForm.visibility]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部可见</SelectItem>
                    <SelectItem value="institution_only">仅宠物医院</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editVisibleRegions">可见城市</Label>
                <CityMultiSelect
                  value={editForm.visibleRegions}
                  onChange={regions => setEditForm(form => ({ ...form, visibleRegions: regions }))}
                />
                <p className="text-xs text-muted-foreground">选择后仅限这些城市的用户可见。</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editHiddenRegions">不可见城市</Label>
                <CityMultiSelect
                  value={editForm.hiddenRegions}
                  onChange={regions => setEditForm(form => ({ ...form, hiddenRegions: regions }))}
                />
                <p className="text-xs text-muted-foreground">选择后这些城市的用户不可见，优先级高于可见城市。</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editServiceTags">商品详情标签</Label>
              <Input
                id="editServiceTags"
                value={editForm.serviceTags}
                onChange={event => setEditForm(form => ({ ...form, serviceTags: event.target.value }))}
                placeholder="冷链配送,支持预约,质量问题售后"
              />
              <p className="text-xs text-muted-foreground">多个标签用逗号分隔，保存后会显示在小程序商品详情页。</p>
            </div>
            <div className="space-y-3">
              <Label htmlFor="editImages">商品图片</Label>
              <Input
                id="editImages"
                type="file"
                accept="image/*"
                multiple
                onChange={async event => {
                  await handleEditImageUpload(event.target.files);
                  event.target.value = '';
                }}
              />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {editForm.images.map((image, index) => (
                  <div key={`${image.slice(0, 24)}-${index}`} className="space-y-2 rounded-lg border p-2">
                    <img src={image} alt={`商品图 ${index + 1}`} className="h-32 w-full rounded-md object-cover" />
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => removeEditImage(index)}>
                      移除图片
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>商品详情</Label>
              <RichTextEditor
                value={editForm.description}
                onChange={value => setEditForm(form => ({ ...form, description: value }))}
                placeholder="在这里编辑商品详情，可以加粗、分段、列表。"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProduct(null)}>取消</Button>
            <Button onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={open => !open && setCreateOpen(false)}>
        <DialogContent className="!w-[min(92vw,50rem)] !max-w-[min(92vw,50rem)]">
          <DialogHeader>
            <DialogTitle>新增商品</DialogTitle>
          </DialogHeader>
          <div className="max-h-[80vh] space-y-4 overflow-y-auto py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="prodName">商品名称<RequiredMark /></Label>
                <Input
                  id="prodName"
                  required
                  value={createForm.name}
                  onChange={event => setCreateForm(form => ({ ...form, name: event.target.value }))}
                  placeholder="请输入商品名称"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prodCat">分类<RequiredMark /></Label>
                <Select
                  value={createForm.category}
                  onValueChange={value => setCreateForm(form => ({ ...form, category: value ?? '' }))}
                >
                  <SelectTrigger className="w-full" aria-required="true">
                    <SelectValue>{catMap[createForm.category] ?? '选择分类'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="hidden">
                <Label>商品类型<RequiredMark /></Label>
                <Select
                  value={createForm.productType}
                  onValueChange={value => setCreateForm(form => ({ ...form, productType: value as ProductType }))}
                >
                  <SelectTrigger className="w-full" aria-required="true">
                    <SelectValue>实体商品</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="physical">实体商品</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="prodInstPrice">医院价<RequiredMark /></Label>
                <Input
                  id="prodInstPrice"
                  type="number"
                  required
                  value={createForm.institutionPrice}
                  onChange={event => setCreateForm(form => ({ ...form, institutionPrice: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prodPersonalPrice">未认证价<RequiredMark /></Label>
                <Input
                  id="prodPersonalPrice"
                  type="number"
                  required
                  value={createForm.personalPrice}
                  onChange={event => setCreateForm(form => ({ ...form, personalPrice: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={createForm.promotionEnabled} onChange={e => setCreateForm(form => ({ ...form, promotionEnabled: e.target.checked }))} className="rounded" />
                <Label>启用限时促销</Label>
              </div>
              {createForm.promotionEnabled && (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>促销价<RequiredMark /></Label>
                    <Input required type="number" value={createForm.promotionPrice} onChange={e => setCreateForm(form => ({ ...form, promotionPrice: e.target.value }))} placeholder="0.01" />
                  </div>
                  <div className="space-y-2">
                    <Label>开始时间<RequiredMark /></Label>
                    <DateTimePickerDisplay
                      required
                      value={createForm.promotionStart}
                      placeholder="开始时间"
                      onChange={value => setCreateForm(form => ({ ...form, promotionStart: value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>结束时间<RequiredMark /></Label>
                    <DateTimePickerDisplay
                      required
                      value={createForm.promotionEnd}
                      placeholder="结束时间"
                      onChange={value => setCreateForm(form => ({ ...form, promotionEnd: value }))}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="prodStock">初始库存<RequiredMark /></Label>
                <Input
                  id="prodStock"
                  type="number"
                  required
                  value={createForm.stock}
                  onChange={event => setCreateForm(form => ({ ...form, stock: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prodSpecs">规格<RequiredMark /></Label>
                <Input
                  id="prodSpecs"
                  required
                  value={createForm.specs}
                  onChange={event => setCreateForm(form => ({ ...form, specs: event.target.value }))}
                  placeholder="5mL/支,10mL/支"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prodVis">可见范围</Label>
              <Select
                value={createForm.visibility}
                onValueChange={value => setCreateForm(form => ({ ...form, visibility: value as ProductVisibility }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{visibilityLabel[createForm.visibility]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部可见</SelectItem>
                  <SelectItem value="institution_only">仅宠物医院</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prodServiceTags">商品详情标签</Label>
              <Input
                id="prodServiceTags"
                value={createForm.serviceTags}
                onChange={event => setCreateForm(form => ({ ...form, serviceTags: event.target.value }))}
                placeholder="冷链配送,支持预约,质量问题售后"
              />
              <p className="text-xs text-muted-foreground">多个标签用逗号分隔，保存后会显示在小程序商品详情页。</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="prodVisibleRegions">可见城市</Label>
                <CityMultiSelect
                  value={createForm.visibleRegions}
                  onChange={regions => setCreateForm(form => ({ ...form, visibleRegions: regions }))}
                />
                <p className="text-xs text-muted-foreground">选择后仅限这些城市的用户可见。</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prodHiddenRegions">不可见城市</Label>
                <CityMultiSelect
                  value={createForm.hiddenRegions}
                  onChange={regions => setCreateForm(form => ({ ...form, hiddenRegions: regions }))}
                />
                <p className="text-xs text-muted-foreground">优先级高于可见城市。</p>
              </div>
            </div>
            <div className="space-y-3">
              <Label htmlFor="prodImages">商品图片<RequiredMark /></Label>
              <Input
                id="prodImages"
                type="file"
                accept="image/*"
                multiple
                required={createForm.images.length === 0}
                onChange={async event => {
                  await handleCreateImageUpload(event.target.files);
                  event.target.value = '';
                }}
              />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {createForm.images.map((image, index) => (
                  <div key={`${image.slice(0, 24)}-${index}`} className="space-y-2 rounded-lg border p-2">
                    <img src={image} alt={`商品图 ${index + 1}`} className="h-32 w-full rounded-md object-cover" />
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => removeCreateImage(index)}>
                      移除图片
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>商品详情<RequiredMark /></Label>
              <RichTextEditor
                value={createForm.description}
                onChange={value => setCreateForm(form => ({ ...form, description: value }))}
                placeholder="在这里编辑商品详情，可以加粗、分段、列表。"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={handleCreate}>创建并上架</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
