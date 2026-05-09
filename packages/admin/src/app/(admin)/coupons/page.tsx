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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { fetchCouponTemplates, fetchUserCoupons, fetchUsers } from '@/lib/services/database';
import { manageCoupon } from '@/lib/services/functions';
import type { CouponTemplate, UserCoupon, CouponType } from '@/lib/types';

const typeLabel: Record<CouponType, string> = { fixed: '固定金额', discount: '折扣', full_reduction: '满减' };
const scopeLabel: Record<string, string> = { all: '全场通用', products: '指定商品', categories: '指定分类' };
const statusLabel: Record<string, string> = { active: '进行中', disabled: '已停用', expired: '已过期' };
const sourceLabel: Record<string, string> = { admin_grant: '后台发放', user_claim: '用户领取', auto_new_user: '新用户自动' };
const ucStatusLabel: Record<string, string> = { available: '可用', used: '已使用', expired: '已过期', disabled: '已停用' };

type TemplateForm = {
  name: string; description: string; type: CouponType; value: string; minAmount: string;
  scope: string; scopeIds: string; distributeMethod: string; totalQuota: string;
  perUserLimit: string; validDaysAfterClaim: string; validFrom: string; validTo: string;
};

const emptyForm = (): TemplateForm => ({
  name: '', description: '', type: 'fixed', value: '', minAmount: '0',
  scope: 'all', scopeIds: '', distributeMethod: 'admin', totalQuota: '0',
  perUserLimit: '1', validDaysAfterClaim: '30', validFrom: '', validTo: '',
});

export default function CouponsPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<CouponTemplate[]>([]);
  const [userCoupons, setUserCoupons] = useState<UserCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('templates');

  // 模板表单
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CouponTemplate | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  // 发放对话框
  const [showGrantDialog, setShowGrantDialog] = useState(false);
  const [grantTemplateId, setGrantTemplateId] = useState('');
  const [grantUserId, setGrantUserId] = useState('');
  const [grantCount, setGrantCount] = useState('1');
  const [granting, setGranting] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      const [tmplRes, ucRes, usersRes] = await Promise.all([
        fetchCouponTemplates(), fetchUserCoupons(), fetchUsers(),
      ]);
      setTemplates(tmplRes);
      setUserCoupons(ucRes);
      setCustomers(usersRes.customers || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData() }, []);

  function openCreateTemplate() {
    setEditingTemplate(null);
    setForm(emptyForm());
    setShowTemplateDialog(true);
  }

  function openEditTemplate(t: CouponTemplate) {
    setEditingTemplate(t);
    setForm({
      name: t.name, description: t.description, type: t.type, value: String(t.value),
      minAmount: String(t.minAmount), scope: t.scope,
      scopeIds: Array.isArray(t.scopeIds) ? t.scopeIds.join(',') : '',
      distributeMethod: t.distributeMethod, totalQuota: String(t.totalQuota),
      perUserLimit: String(t.perUserLimit), validDaysAfterClaim: String(t.validDaysAfterClaim),
      validFrom: t.validFrom, validTo: t.validTo,
    });
    setShowTemplateDialog(true);
  }

  async function saveTemplate() {
    if (!form.name || !form.value) return;
    setSaving(true);
    try {
      if (editingTemplate) {
        await manageCoupon({
          action: 'updateTemplate', templateId: editingTemplate.id,
          updates: {
            name: form.name, description: form.description,
            totalQuota: Number(form.totalQuota), perUserLimit: Number(form.perUserLimit),
            validDaysAfterClaim: Number(form.validDaysAfterClaim),
            validFrom: form.validFrom, validTo: form.validTo, status: 'active',
          },
        });
      } else {
        await manageCoupon({
          action: 'createTemplate',
          name: form.name, description: form.description, type: form.type,
          value: Number(form.value), minAmount: Number(form.minAmount),
          scope: form.scope, scopeIds: form.scopeIds ? form.scopeIds.split(',').map(s => s.trim()) : [],
          distributeMethod: form.distributeMethod, totalQuota: Number(form.totalQuota),
          perUserLimit: Number(form.perUserLimit), validDaysAfterClaim: Number(form.validDaysAfterClaim),
          validFrom: form.validFrom, validTo: form.validTo,
        });
      }
      setShowTemplateDialog(false);
      loadData();
    } catch (e: any) {
      alert(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function disableTemplate(t: CouponTemplate) {
    if (!confirm(`确定停用"${t.name}"？`)) return;
    await manageCoupon({ action: 'updateTemplate', templateId: t.id, updates: { status: 'disabled' } });
    loadData();
  }

  function openGrantDialog(templateId: string) {
    setGrantTemplateId(templateId);
    setGrantUserId('');
    setGrantCount('1');
    setShowGrantDialog(true);
  }

  async function grantCoupon() {
    if (!grantUserId) { alert('请选择用户'); return; }
    setGranting(true);
    try {
      await manageCoupon({
        action: 'grantCoupon', templateId: grantTemplateId,
        userId: grantUserId, count: Number(grantCount), grantedBy: user?.id || '',
      });
      setShowGrantDialog(false);
      loadData();
    } catch (e: any) {
      alert(e.message || '发放失败');
    } finally {
      setGranting(false);
    }
  }

  async function disableUserCoupon(uc: UserCoupon) {
    if (!confirm('确定停用该优惠券？')) return;
    await manageCoupon({ action: 'disableUserCoupon', userCouponId: uc.id });
    loadData();
  }

  function renderValue(t: CouponTemplate) {
    if (t.type === 'fixed') return `减 ¥${t.value}`;
    if (t.type === 'discount') return `${t.value} 折`;
    return `满 ¥${t.minAmount} 减 ¥${t.value}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">优惠券管理</h1>
        <Button onClick={openCreateTemplate}>创建优惠券</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="templates">优惠券模板</TabsTrigger>
          <TabsTrigger value="records">发放记录</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>名称</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>面额</TableHead>
                    <TableHead>适用范围</TableHead>
                    <TableHead>发放/总量</TableHead>
                    <TableHead>有效期</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">加载中...</TableCell></TableRow>
                  ) : templates.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">暂无优惠券模板</TableCell></TableRow>
                  ) : templates.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>{typeLabel[t.type]}</TableCell>
                      <TableCell>{renderValue(t)}</TableCell>
                      <TableCell>{scopeLabel[t.scope] || t.scope}</TableCell>
                      <TableCell>{t.claimedCount} / {t.totalQuota || '不限'}</TableCell>
                      <TableCell className="text-xs">
                        {t.validDaysAfterClaim > 0 ? `领取后 ${t.validDaysAfterClaim} 天` : `${t.validFrom || '-'} ~ ${t.validTo || '-'}`}
                      </TableCell>
                      <TableCell><Badge variant={t.status === 'active' ? 'default' : 'secondary'}>{statusLabel[t.status] || t.status}</Badge></TableCell>
                      <TableCell className="space-x-1">
                        {t.status === 'active' && <>
                          <Button size="sm" variant="outline" onClick={() => openEditTemplate(t)}>编辑</Button>
                          <Button size="sm" variant="outline" onClick={() => openGrantDialog(t.id)}>发放</Button>
                          <Button size="sm" variant="destructive" onClick={() => disableTemplate(t)}>停用</Button>
                        </>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>优惠券</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>用户 ID</TableHead>
                    <TableHead>来源</TableHead>
                    <TableHead>有效期</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">加载中...</TableCell></TableRow>
                  ) : userCoupons.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">暂无发放记录</TableCell></TableRow>
                  ) : userCoupons.map(uc => (
                    <TableRow key={uc.id}>
                      <TableCell className="font-medium">{uc.couponName}</TableCell>
                      <TableCell>{typeLabel[uc.couponType]}</TableCell>
                      <TableCell className="text-xs font-mono">{uc.userId.slice(0, 12)}...</TableCell>
                      <TableCell>{sourceLabel[uc.source] || uc.source}</TableCell>
                      <TableCell className="text-xs">{uc.validFrom} ~ {uc.validTo}</TableCell>
                      <TableCell><Badge variant={uc.status === 'available' ? 'default' : 'secondary'}>{ucStatusLabel[uc.status] || uc.status}</Badge></TableCell>
                      <TableCell>
                        {uc.status === 'available' && (
                          <Button size="sm" variant="destructive" onClick={() => disableUserCoupon(uc)}>停用</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 创建/编辑模板对话框 */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? '编辑优惠券' : '创建优惠券'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>券名</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="如：一分钱购检测卡" />
            </div>
            <div className="space-y-2">
              <Label>说明</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="使用说明" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>类型</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v as CouponType })} disabled={!!editingTemplate}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">固定金额</SelectItem>
                    <SelectItem value="discount">折扣</SelectItem>
                    <SelectItem value="full_reduction">满减</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{form.type === 'discount' ? '折扣率(如8.5=85折)' : '面额(元)'}</Label>
                <Input type="number" step="0.01" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} disabled={!!editingTemplate} />
              </div>
            </div>
            {form.type === 'full_reduction' && (
              <div className="space-y-2">
                <Label>最低消费(元)</Label>
                <Input type="number" step="0.01" value={form.minAmount} onChange={e => setForm({ ...form, minAmount: e.target.value })} disabled={!!editingTemplate} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>适用范围</Label>
                <Select value={form.scope} onValueChange={v => setForm({ ...form, scope: v ?? 'all' })} disabled={!!editingTemplate}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全场通用</SelectItem>
                    <SelectItem value="products">指定商品</SelectItem>
                    <SelectItem value="categories">指定分类</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.scope !== 'all' && (
                <div className="space-y-2">
                  <Label>{form.scope === 'products' ? '商品 ID（逗号分隔）' : '分类 ID（逗号分隔）'}</Label>
                  <Input value={form.scopeIds} onChange={e => setForm({ ...form, scopeIds: e.target.value })} disabled={!!editingTemplate} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>发放方式</Label>
                <Select value={form.distributeMethod} onValueChange={v => setForm({ ...form, distributeMethod: v ?? 'admin' })} disabled={!!editingTemplate}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">后台发放</SelectItem>
                    <SelectItem value="user_claim">用户领取</SelectItem>
                    <SelectItem value="auto_new_user">新用户自动</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>总发放量(0=不限)</Label>
                <Input type="number" value={form.totalQuota} onChange={e => setForm({ ...form, totalQuota: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>每人限领</Label>
                <Input type="number" value={form.perUserLimit} onChange={e => setForm({ ...form, perUserLimit: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>领取后有效天数(0=固定日期)</Label>
                <Input type="number" value={form.validDaysAfterClaim} onChange={e => setForm({ ...form, validDaysAfterClaim: e.target.value })} />
              </div>
            </div>
            {Number(form.validDaysAfterClaim) === 0 && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>有效期开始</Label>
                  <Input type="datetime-local" value={form.validFrom} onChange={e => setForm({ ...form, validFrom: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>有效期结束</Label>
                  <Input type="datetime-local" value={form.validTo} onChange={e => setForm({ ...form, validTo: e.target.value })} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>取消</Button>
            <Button onClick={saveTemplate} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 发放对话框 */}
      <Dialog open={showGrantDialog} onOpenChange={setShowGrantDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>发放优惠券</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>选择用户</Label>
              <Select value={grantUserId} onValueChange={v => setGrantUserId(v ?? '')}>
                <SelectTrigger><SelectValue placeholder="选择用户" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nickname || c.phone || c.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>发放数量</Label>
              <Input type="number" min="1" max="10" value={grantCount} onChange={e => setGrantCount(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGrantDialog(false)}>取消</Button>
            <Button onClick={grantCoupon} disabled={granting}>{granting ? '发放中...' : '发放'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
