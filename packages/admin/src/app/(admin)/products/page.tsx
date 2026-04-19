'use client';

import { useEffect, useState } from 'react';
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
import type { Product, ProductCategory } from '@dxdy/shared';

const visibilityLabel: Record<string, string> = {
  all: '全部可见',
  institution_only: '仅医院',
  personal_only: '仅个人',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', description: '', institution: '', personal: '', stock: '',
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', description: '', category: '', institutionPrice: '', personalPrice: '',
    visibility: 'all' as 'all' | 'institution_only' | 'personal_only', stock: '', specs: '',
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    Promise.all([getAllProducts(), getCategories()]).then(([p, c]) => {
      setProducts(p);
      setCategories(c);
    });
  }, []);

  const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

  function startEdit(product: Product) {
    setEditProduct(product);
    setEditForm({
      name: product.name,
      description: product.description,
      institution: String(product.institutionPrice),
      personal: String(product.personalPrice),
      stock: String(product.stock),
    });
  }

  async function handleSave() {
    if (!editProduct) return;
    const updated = await updateProduct(editProduct.id, {
      name: editForm.name,
      description: editForm.description,
      institutionPrice: parseFloat(editForm.institution) || 0,
      personalPrice: parseFloat(editForm.personal) || 0,
      stock: parseInt(editForm.stock) || 0,
    });
    if (updated) {
      setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
    }
    setEditProduct(null);
  }

  async function toggleStatus(product: Product) {
    const newStatus = product.status === 'on_sale' ? 'off_sale' : 'on_sale';
    const updated = await updateProduct(product.id, { status: newStatus });
    if (updated) {
      setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
    }
  }

  function toggleSelect(id: string) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
    setSelectAll(false);
  }

  function toggleSelectAll() {
    if (selectAll) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.id)));
    }
    setSelectAll(!selectAll);
  }

  async function handleCreate() {
    if (!createForm.name || !createForm.category) {
      alert('请填写名称和分类');
      return;
    }
    const specs = createForm.specs
      ? createForm.specs.split(',').map(v => ({ name: '规格', value: v.trim() }))
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
      stock: parseInt(createForm.stock) || 0,
      status: 'on_sale',
      images: [],
      returnPolicy: { enabled: true, deadlineDays: 7, note: '' },
      isPrescription: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setProducts(prev => [newProd, ...prev]);
    setCreateOpen(false);
    setCreateForm({ name: '', description: '', category: '', institutionPrice: '', personalPrice: '', visibility: 'all', stock: '', specs: '' });
  }

  async function handleBatchOffSale() {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      await updateProduct(id, { status: 'off_sale' });
    }
    setProducts(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, status: 'off_sale' } : p));
    setSelectedIds(new Set());
    setSelectAll(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">商品管理</h1>
        <div className="flex gap-2">
          <Button onClick={() => setCreateOpen(true)}>新增商品</Button>
          <Button variant="outline" onClick={handleBatchOffSale} disabled={selectedIds.size === 0}>
            批量下架{selectedIds.size > 0 && ` (${selectedIds.size})`}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} />
                </TableHead>
                <TableHead>ID</TableHead>
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
              {products.map(product => (
                <TableRow key={product.id}>
                  <TableCell>
                    <input type="checkbox" checked={selectedIds.has(product.id)} onChange={() => toggleSelect(product.id)} />
                  </TableCell>
                  <TableCell className="font-mono text-sm">{product.id}</TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{catMap[product.category] ?? product.category}</TableCell>
                  <TableCell>¥{formatMoney(product.institutionPrice)}</TableCell>
                  <TableCell>{product.personalPrice > 0 ? `¥${formatMoney(product.personalPrice)}` : '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{visibilityLabel[product.visibility] ?? product.visibility}</Badge>
                  </TableCell>
                  <TableCell>{product.stock}</TableCell>
                  <TableCell>
                    <Badge variant={product.status === 'on_sale' ? 'default' : 'secondary'}>
                      {product.status === 'on_sale' ? '在售' : '已下架'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => startEdit(product)}>编辑</Button>
                      <Button variant="outline" size="sm" onClick={() => toggleStatus(product)}>
                        {product.status === 'on_sale' ? '下架' : '上架'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editProduct} onOpenChange={() => setEditProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑商品</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editName">商品名称</Label>
              <Input id="editName" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDesc">商品描述</Label>
              <Input id="editDesc" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editInst">医院价</Label>
                <Input id="editInst" type="number" value={editForm.institution} onChange={e => setEditForm(f => ({ ...f, institution: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editPers">个人价</Label>
                <Input id="editPers" type="number" value={editForm.personal} onChange={e => setEditForm(f => ({ ...f, personal: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editStock">库存</Label>
              <Input id="editStock" type="number" value={editForm.stock} onChange={e => setEditForm(f => ({ ...f, stock: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProduct(null)}>取消</Button>
            <Button onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={v => !v && setCreateOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新增商品</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="prodName">商品名称</Label>
              <Input id="prodName" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="请输入商品名称" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prodDesc">商品描述</Label>
              <Input id="prodDesc" value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="商品描述" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prodCat">分类</Label>
              <Select value={createForm.category} onValueChange={v => setCreateForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue placeholder="选择分类" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prodInstPrice">医院价</Label>
                <Input id="prodInstPrice" type="number" value={createForm.institutionPrice} onChange={e => setCreateForm(f => ({ ...f, institutionPrice: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prodPersPrice">个人价</Label>
                <Input id="prodPersPrice" type="number" value={createForm.personalPrice} onChange={e => setCreateForm(f => ({ ...f, personalPrice: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prodVis">可见范围</Label>
              <Select value={createForm.visibility} onValueChange={v => setCreateForm(f => ({ ...f, visibility: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部可见</SelectItem>
                  <SelectItem value="institution_only">仅宠物医院</SelectItem>
                  <SelectItem value="personal_only">仅个人客户</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prodStock">初始库存</Label>
              <Input id="prodStock" type="number" value={createForm.stock} onChange={e => setCreateForm(f => ({ ...f, stock: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prodSpecs">规格（逗号分隔，如"5mL/支,10mL/支"）</Label>
              <Input id="prodSpecs" value={createForm.specs} onChange={e => setCreateForm(f => ({ ...f, specs: e.target.value }))} placeholder="5mL/支,10mL/支" />
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
