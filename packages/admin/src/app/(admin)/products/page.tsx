'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { getAllProducts, updateProduct, createProduct, getCategories } from '@dxdy/shared';
import { formatMoney } from '@dxdy/shared';
import type { Product, ProductCategory, ProductVisibility } from '@dxdy/shared';

type ProductFormState = {
  name: string;
  description: string;
  category: string;
  institutionPrice: string;
  personalPrice: string;
  visibility: ProductVisibility;
  stock: string;
  specs: string;
  images: string[];
};

const visibilityLabel: Record<string, string> = {
  all: '全部可见',
  institution_only: '仅医院',
  personal_only: '仅个人',
};

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

const emptyProductForm = (): ProductFormState => ({
  name: '',
  description: '',
  category: '',
  institutionPrice: '',
  personalPrice: '',
  visibility: 'all',
  stock: '',
  specs: '',
  images: [],
});

function productSpecsToText(specs: Product['specs']) {
  return specs.map(spec => spec.value).join(',');
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function readFilesAsDataUrls(files: FileList | null) {
  if (!files || files.length === 0) return [];
  return Promise.all(Array.from(files).map(readFileAsDataUrl));
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

  useEffect(() => {
    Promise.all([getAllProducts(), getCategories()]).then(([allProducts, allCategories]) => {
      setProducts(allProducts);
      setCategories(allCategories);
    });
  }, []);

  const catMap = Object.fromEntries(categories.map(category => [category.id, category.name]));
  const categoryFilterItems = { all: '全部分类', ...catMap };

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
  const allCurrentPageSelected =
    pagedProducts.length > 0 && pagedProducts.every(product => selectedIds.has(product.id));

  function resetToFirstPage() {
    setPage(1);
  }

  function startEdit(product: Product) {
    setEditProduct(product);
    setEditForm({
      name: product.name,
      description: product.description,
      category: product.category,
      institutionPrice: String(product.institutionPrice),
      personalPrice: String(product.personalPrice),
      visibility: product.visibility,
      stock: String(product.stock),
      specs: productSpecsToText(product.specs),
      images: product.images ?? [],
    });
  }

  async function handleSave() {
    if (!editProduct) return;
    const specs = editForm.specs
      ? editForm.specs.split(',').map(value => ({ name: '规格', value: value.trim() })).filter(spec => spec.value)
      : [{ name: '默认', value: '默认' }];

    const updated = await updateProduct(editProduct.id, {
      name: editForm.name,
      description: editForm.description,
      category: editForm.category,
      institutionPrice: parseFloat(editForm.institutionPrice) || 0,
      personalPrice: parseFloat(editForm.personalPrice) || 0,
      visibility: editForm.visibility,
      stock: parseInt(editForm.stock, 10) || 0,
      specs,
      images: editForm.images,
    });
    if (updated) {
      setProducts(prev => prev.map(product => (product.id === updated.id ? updated : product)));
    }
    setEditProduct(null);
  }

  async function toggleStatus(product: Product) {
    const newStatus = product.status === 'on_sale' ? 'off_sale' : 'on_sale';
    const updated = await updateProduct(product.id, { status: newStatus });
    if (updated) {
      setProducts(prev => prev.map(item => (item.id === updated.id ? updated : item)));
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
    if (!createForm.name || !createForm.category) {
      alert('请填写名称和分类');
      return;
    }

    const specs = createForm.specs
      ? createForm.specs.split(',').map(value => ({ name: '规格', value: value.trim() })).filter(spec => spec.value)
      : [{ name: '默认', value: '默认' }];

    const newProd = await createProduct({
      id: `prod_${Date.now().toString(36)}`,
      name: createForm.name,
      description: createForm.description,
      category: createForm.category,
      specs,
      institutionPrice: parseFloat(createForm.institutionPrice) || 0,
      personalPrice: parseFloat(createForm.personalPrice) || 0,
      visibility: createForm.visibility,
      stock: parseInt(createForm.stock, 10) || 0,
      status: 'on_sale',
      images: createForm.images,
      returnPolicy: { enabled: true, deadlineDays: 7, note: '' },
      isPrescription: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    setProducts(prev => [newProd, ...prev]);
    setCreateOpen(false);
    setCreateForm(emptyProductForm());
    resetToFirstPage();
  }

  async function handleCreateImageUpload(files: FileList | null) {
    const images = await readFilesAsDataUrls(files);
    if (images.length === 0) return;
    setCreateForm(form => ({ ...form, images: [...form.images, ...images] }));
  }

  async function handleEditImageUpload(files: FileList | null) {
    const images = await readFilesAsDataUrls(files);
    if (images.length === 0) return;
    setEditForm(form => ({ ...form, images: [...form.images, ...images] }));
  }

  function removeCreateImage(index: number) {
    setCreateForm(form => ({ ...form, images: form.images.filter((_, current) => current !== index) }));
  }

  function removeEditImage(index: number) {
    setEditForm(form => ({ ...form, images: form.images.filter((_, current) => current !== index) }));
  }

  async function handleBatchOffSale() {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      await updateProduct(id, { status: 'off_sale' });
    }
    setProducts(prev =>
      prev.map(product => (selectedIds.has(product.id) ? { ...product, status: 'off_sale' } : product)),
    );
    setSelectedIds(new Set());
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
              items={categoryFilterItems}
              value={categoryFilter}
              onValueChange={value => {
                setCategoryFilter(value);
                resetToFirstPage();
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="商品分类" />
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
              items={productStatusLabel}
              value={statusFilter}
              onValueChange={value => {
                setStatusFilter(value as 'all' | Product['status']);
                resetToFirstPage();
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="商品状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="on_sale">在售</SelectItem>
                <SelectItem value="off_sale">已下架</SelectItem>
              </SelectContent>
            </Select>
            <Select
              items={visibilityLabel}
              value={visibilityFilter}
              onValueChange={value => {
                setVisibilityFilter(value as 'all' | ProductVisibility);
                resetToFirstPage();
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="可见性" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部可见</SelectItem>
                <SelectItem value="institution_only">仅医院</SelectItem>
                <SelectItem value="personal_only">仅个人</SelectItem>
              </SelectContent>
            </Select>
            <Select
              items={stockFilterLabel}
              value={stockFilter}
              onValueChange={value => {
                setStockFilter(value as StockFilter);
                resetToFirstPage();
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="库存筛选" />
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
                <TableHead>ID</TableHead>
                <TableHead>图片</TableHead>
                <TableHead>商品名</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>医院价</TableHead>
                <TableHead>个人价</TableHead>
                <TableHead>可见性</TableHead>
                <TableHead>库存</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedProducts.map(product => (
                <TableRow key={product.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(product.id)}
                      onChange={() => toggleSelect(product.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">{product.id}</TableCell>
                  <TableCell>
                    {product.images?.[0] ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={product.images[0]}
                          alt={product.name}
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
                  <TableCell>
                    {product.personalPrice > 0 ? `¥${formatMoney(product.personalPrice)}` : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {visibilityLabel[product.visibility] ?? product.visibility}
                    </Badge>
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
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {pagedProducts.length === 0 && (
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
            </p>
            <div className="flex gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={value => {
                  setPageSize(parseInt(value, 10));
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
        <DialogContent className="max-w-4xl">
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
                  onValueChange={value => setEditForm(form => ({ ...form, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择分类" />
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
                <Label htmlFor="editPers">个人价</Label>
                <Input
                  id="editPers"
                  type="number"
                  value={editForm.personalPrice}
                  onChange={event => setEditForm(form => ({ ...form, personalPrice: event.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
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
                  items={visibilityLabel}
                  value={editForm.visibility}
                  onValueChange={value => setEditForm(form => ({ ...form, visibility: value as ProductVisibility }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部可见</SelectItem>
                    <SelectItem value="institution_only">仅宠物医院</SelectItem>
                    <SelectItem value="personal_only">仅个人客户</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>新增商品</DialogTitle>
          </DialogHeader>
          <div className="max-h-[80vh] space-y-4 overflow-y-auto py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="prodName">商品名称</Label>
                <Input
                  id="prodName"
                  value={createForm.name}
                  onChange={event => setCreateForm(form => ({ ...form, name: event.target.value }))}
                  placeholder="请输入商品名称"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prodCat">分类</Label>
                <Select
                  value={createForm.category}
                  onValueChange={value => setCreateForm(form => ({ ...form, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择分类" />
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
              <div className="space-y-2">
                <Label htmlFor="prodInstPrice">医院价</Label>
                <Input
                  id="prodInstPrice"
                  type="number"
                  value={createForm.institutionPrice}
                  onChange={event => setCreateForm(form => ({ ...form, institutionPrice: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prodPersPrice">个人价</Label>
                <Input
                  id="prodPersPrice"
                  type="number"
                  value={createForm.personalPrice}
                  onChange={event => setCreateForm(form => ({ ...form, personalPrice: event.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="prodVis">可见范围</Label>
                <Select
                  items={visibilityLabel}
                  value={createForm.visibility}
                  onValueChange={value => setCreateForm(form => ({ ...form, visibility: value as ProductVisibility }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部可见</SelectItem>
                    <SelectItem value="institution_only">仅宠物医院</SelectItem>
                    <SelectItem value="personal_only">仅个人客户</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prodStock">初始库存</Label>
                <Input
                  id="prodStock"
                  type="number"
                  value={createForm.stock}
                  onChange={event => setCreateForm(form => ({ ...form, stock: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prodSpecs">规格</Label>
                <Input
                  id="prodSpecs"
                  value={createForm.specs}
                  onChange={event => setCreateForm(form => ({ ...form, specs: event.target.value }))}
                  placeholder="5mL/支,10mL/支"
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label htmlFor="prodImages">商品图片</Label>
              <Input
                id="prodImages"
                type="file"
                accept="image/*"
                multiple
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
              <Label>商品详情</Label>
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
