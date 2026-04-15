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
import { getAllProducts, updateProduct, getCategories } from '@dxdy/shared';
import { formatMoney } from '@dxdy/shared';
import type { Product, ProductCategory } from '@dxdy/shared';

const visibilityLabel: Record<string, string> = {
  all: '全部可见',
  institution_only: '仅机构',
  personal_only: '仅个人',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editPrice, setEditPrice] = useState({ institution: '', personal: '' });

  useEffect(() => {
    Promise.all([getAllProducts(), getCategories()]).then(([p, c]) => {
      setProducts(p);
      setCategories(c);
    });
  }, []);

  const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

  function startEdit(product: Product) {
    setEditProduct(product);
    setEditPrice({
      institution: String(product.institutionPrice),
      personal: String(product.personalPrice),
    });
  }

  async function handleSave() {
    if (!editProduct) return;
    const updated = await updateProduct(editProduct.id, {
      institutionPrice: parseFloat(editPrice.institution) || 0,
      personalPrice: parseFloat(editPrice.personal) || 0,
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">商品管理</h1>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>商品名</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>机构价</TableHead>
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
            <DialogTitle>编辑商品价格</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm font-medium">{editProduct?.name}</p>
            <div className="space-y-2">
              <Label htmlFor="instPrice">机构价</Label>
              <Input id="instPrice" type="number" value={editPrice.institution} onChange={e => setEditPrice(p => ({ ...p, institution: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="persPrice">个人价</Label>
              <Input id="persPrice" type="number" value={editPrice.personal} onChange={e => setEditPrice(p => ({ ...p, personal: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProduct(null)}>取消</Button>
            <Button onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
