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
import { writeAdminLog } from '@/lib/admin-log';
import { getApp } from '@/lib/cloudbase';
import { formatDateTime, formatMoney } from '@/lib/format';
import {
  createCardVoucher,
  fetchCardVouchers,
  fetchUsers,
  updateCardVoucher,
} from '@/lib/services/database';
import type { CardVoucher, CardVoucherStatus, Customer, Salesperson } from '@/lib/types';

const statusLabel: Partial<Record<CardVoucherStatus, string>> = {
  ungifted: '未赠送',
  gifted: '已赠送',
  claimed: '已认领',
  redeemed: '已兑换',
  voided: '已作废',
};

const statusVariant: Partial<Record<CardVoucherStatus, 'default' | 'secondary' | 'destructive' | 'outline'>> = {
  ungifted: 'secondary',
  gifted: 'outline',
  claimed: 'default',
  redeemed: 'default',
  voided: 'destructive',
};

type StatusFilter = 'all' | CardVoucherStatus;

type CardCreateForm = {
  productName: string;
  count: string;
  purchaseAmount: string;
  deductionAmount: string;
  productImage: string;
};

type GiftTarget = {
  id: string;
  name: string;
  phone: string;
  type: 'salesperson' | 'institution';
};

const tabs: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'ungifted', label: '未赠送' },
  { value: 'gifted', label: '已赠送' },
  { value: 'claimed', label: '已认领' },
  { value: 'redeemed', label: '已兑换' },
  { value: 'voided', label: '已作废' },
];

function isHiddenCardStatus(status: CardVoucherStatus) {
  return status === 'verified' || status === 'expired';
}

function normalizeDoc(doc: Record<string, unknown>): CardVoucher {
  const { _id, ...rest } = doc;
  return { id: String(_id || (doc as Record<string, unknown>).id || ''), ...rest } as CardVoucher;
}

function getCardDeductionAmount(card: CardVoucher) {
  return card.deductionAmount ?? card.discountAmount ?? 0;
}

function getCardPurchaseAmount(card: CardVoucher) {
  return card.purchaseAmount ?? getCardDeductionAmount(card);
}

function isAgentPurchasedCard(card: CardVoucher) {
  return Boolean(card.purchaserId || card.purchaseOrderId || card.purchaseOrderNo);
}

const emptyCreateForm = (): CardCreateForm => ({
  productName: '',
  count: '1',
  purchaseAmount: '',
  deductionAmount: '',
  productImage: '',
});

const CARD_COVER_MAX_SIZE = 2 * 1024 * 1024;
const CARD_COVER_PUBLIC_BASE_URL = 'https://636c-cloud1-d7g7ctn4m86bada89-1433980811.tcb.qcloud.la';
const CARD_COVER_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function buildCardNo(index: number) {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  const stamp = Date.now().toString(36).toUpperCase();
  return `DXCARD${date}${stamp}${String(index + 1).padStart(3, '0')}`;
}

function getSafeCoverFileName(file: File) {
  const name = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') || 'cover';
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  return `${name}.${ext}`;
}

function getUserDisplayName(input: object) {
  const user = input as Record<string, unknown>;
  const verificationInfo = user.verificationInfo && typeof user.verificationInfo === 'object'
    ? user.verificationInfo as Record<string, unknown>
    : {};
  const agentApplication = user.agentApplication && typeof user.agentApplication === 'object'
    ? user.agentApplication as Record<string, unknown>
    : {};
  return String(
    verificationInfo.hospitalName ||
    agentApplication.companyName ||
    user.nickname ||
    verificationInfo.realName ||
    verificationInfo.contactName ||
    agentApplication.realName ||
    agentApplication.contactName ||
    user.nickname ||
    user.phone ||
    user.id ||
    ''
  );
}

function buildGiftTargets(customers: Customer[], salespersons: Salesperson[]): GiftTarget[] {
  const agentTargets = salespersons
    .filter(person => person.verificationStatus === 'approved' || (person as unknown as { agentStatus?: string }).agentStatus === 'approved')
    .map(person => ({
      id: person.id,
      name: getUserDisplayName(person),
      phone: person.phone || '',
      type: 'salesperson' as const,
    }));
  const hospitalTargets = customers
    .filter(customer => customer.customerType === 'institution')
    .map(customer => ({
      id: customer.id,
      name: getUserDisplayName(customer),
      phone: customer.phone || '',
      type: 'institution' as const,
    }));
  return [...agentTargets, ...hospitalTargets].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

async function uploadCardCover(file: File): Promise<string> {
  if (!CARD_COVER_ALLOWED_TYPES.has(file.type)) {
    throw new Error('仅支持 JPG、PNG、WebP 格式的卡券封面');
  }
  if (file.size > CARD_COVER_MAX_SIZE) {
    throw new Error('卡券封面不能超过 2MB');
  }

  const app = getApp();
  if (!app?.uploadFile) throw new Error('CloudBase 未初始化，无法上传卡券封面');

  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const cloudPath = `card-vouchers/${timestamp}-${random}-${getSafeCoverFileName(file)}`;
  await app.uploadFile({
    cloudPath,
    filePath: file,
  });
  return `${CARD_COVER_PUBLIC_BASE_URL}/${cloudPath}`;
}

export default function CardsPage() {
  const { user } = useAuth();
  const [cards, setCards] = useState<CardVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState<CardCreateForm>(emptyCreateForm());
  const [creating, setCreating] = useState(false);
  const [giftTargets, setGiftTargets] = useState<GiftTarget[]>([]);
  const [giftTarget, setGiftTarget] = useState<CardVoucher | null>(null);
  const [giftTargetId, setGiftTargetId] = useState('');
  const [giftTargetSearch, setGiftTargetSearch] = useState('');
  const [gifting, setGifting] = useState(false);

  // 作废对话框
  const [voidTarget, setVoidTarget] = useState<CardVoucher | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  async function loadCards() {
    setLoading(true);
    try {
      const [docs, users] = await Promise.all([
        fetchCardVouchers(),
        fetchUsers(),
      ]);
      setGiftTargets(buildGiftTargets(users.customers || [], users.salespersons || []));
      setCards(docs.filter(card => !isHiddenCardStatus(card.status)));
    } catch (e) {
      console.error('加载卡券失败', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCards() }, []);

  const filteredCards = cards.filter(card => {
    const matchesTab = tab === 'all' || card.status === tab;
    const matchesSearch = !search ||
      card.cardNo.toLowerCase().includes(search.toLowerCase()) ||
      card.productName.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedCards = filteredCards.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function resetPage() { setPage(1); }

  // 汇总
  const summary = {
    total: cards.length,
    ungifted: cards.filter(c => c.status === 'ungifted').length,
    gifted: cards.filter(c => c.status === 'gifted').length,
    claimed: cards.filter(c => c.status === 'claimed').length,
    redeemed: cards.filter(c => c.status === 'redeemed').length,
  };
  const canAdminGiftCards = user?.role === 'system_admin';
  const canAdminGiftCard = (card: CardVoucher) => canAdminGiftCards && card.status === 'ungifted' && !isAgentPurchasedCard(card);
  const selectedGiftTarget = giftTargets.find(item => item.id === giftTargetId);
  const filteredGiftTargets = giftTargets.filter(target => {
    const keyword = giftTargetSearch.trim().toLowerCase();
    if (!keyword) return true;
    const targetTypeLabel = target.type === 'salesperson' ? '实名代理商' : '医院客户';
    return [
      target.name,
      target.phone,
      targetTypeLabel,
    ].some(value => value.toLowerCase().includes(keyword));
  });

  async function handleVoid() {
    if (!voidTarget || !voidReason.trim()) return;
    setVoiding(true);
    try {
      const now = new Date().toISOString();
      await updateCardVoucher(voidTarget.id, {
        status: 'voided',
        voidedAt: now,
        voidedBy: user?.id || '',
        voidReason: voidReason.trim(),
        updatedAt: now,
      });
      await writeAdminLog({
        operator: user,
        action: 'void_card_voucher',
        target: voidTarget.cardNo,
        detail: `作废卡券 ${voidTarget.cardNo}，原因：${voidReason.trim()}`,
      });
      setVoidTarget(null);
      setVoidReason('');
      loadCards();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '作废失败');
    } finally {
      setVoiding(false);
    }
  }

  function openGiftDialog(card: CardVoucher) {
    if (isAgentPurchasedCard(card)) {
      alert('该卡券已由代理商购买，系统管理员不能再赠送给其他人');
      return;
    }
    setGiftTarget(card);
    setGiftTargetId('');
    setGiftTargetSearch('');
  }

  async function handleGiftCard() {
    if (!giftTarget || !giftTargetId) return;
    if (isAgentPurchasedCard(giftTarget)) {
      alert('该卡券已由代理商购买，系统管理员不能再赠送给其他人');
      setGiftTarget(null);
      setGiftTargetId('');
      setGiftTargetSearch('');
      return;
    }
    const target = giftTargets.find(item => item.id === giftTargetId);
    if (!target) {
      alert('请选择赠送对象');
      return;
    }
    setGifting(true);
    try {
      const now = new Date().toISOString();
      const giftEntry = {
        fromUserId: user?.id || '',
        fromUserName: user?.realName || user?.username || '系统管理员',
        toUserId: target.id,
        toUserName: target.name,
        action: 'admin_gift',
        at: now,
      };
      await updateCardVoucher(giftTarget.id, {
        status: 'gifted',
        currentHolderId: target.id,
        currentHolderName: target.name,
        giftHistory: [...(giftTarget.giftHistory || []), giftEntry],
        updatedAt: now,
      });
      await writeAdminLog({
        operator: user,
        action: 'gift_card',
        target: giftTarget.cardNo,
        detail: `系统管理员赠送卡券 ${giftTarget.cardNo} 给 ${target.name}`,
      });
      setGiftTarget(null);
      setGiftTargetId('');
      setGiftTargetSearch('');
      loadCards();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '赠送卡券失败');
    } finally {
      setGifting(false);
    }
  }

  function openCreateDialog() {
    setCreateForm(emptyCreateForm());
    setShowCreateDialog(true);
  }

  async function handleCoverUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    try {
      const imageUrl = await uploadCardCover(file);
      setCreateForm(form => ({ ...form, productImage: imageUrl }));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '上传卡券封面失败');
    }
  }

  async function handleCreateCards() {
    const count = Math.min(Math.max(parseInt(createForm.count, 10) || 1, 1), 200);
    const purchaseAmount = Math.round((Number(createForm.purchaseAmount) || 0) * 100) / 100;
    const deductionAmount = Math.round((Number(createForm.deductionAmount) || 0) * 100) / 100;
    const productName = createForm.productName.trim();
    if (!productName) {
      alert('请输入卡券名称');
      return;
    }
    if (deductionAmount <= 0) {
      alert('请输入有效的卡券抵扣金额');
      return;
    }
    if (purchaseAmount <= 0) {
      alert('请输入有效的购买卡券金额');
      return;
    }
    if (!createForm.productImage) {
      alert('请上传卡券封面');
      return;
    }
    setCreating(true);
    try {
      const now = new Date().toISOString();
      for (let index = 0; index < count; index += 1) {
        await createCardVoucher({
          cardNo: buildCardNo(index),
          status: 'ungifted',
          purchaseOrderId: '',
          purchaseOrderNo: '',
          productId: '',
          productName,
          productImage: createForm.productImage,
          redeemableCategory: '',
          validDays: 0,
          expiresAt: '',
          purchaseAmount,
          deductionAmount,
          discountAmount: deductionAmount,
          purchaserId: '',
          purchaserName: '',
          purchaserOpenid: '',
          currentHolderId: null,
          currentHolderName: '',
          giftHistory: [],
          redeemedOrderId: '',
          redeemedProductId: '',
          redeemedProductName: '',
          redeemedAt: '',
          verifiedAt: '',
          voidedAt: '',
          voidedBy: '',
          voidReason: '',
          createdAt: now,
          updatedAt: now,
        });
      }
      await writeAdminLog({
        operator: user,
        action: 'create_card_voucher',
        target: productName,
        detail: `新增卡券 ${productName}，数量 ${count}`,
      });
      setShowCreateDialog(false);
      loadCards();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '新增卡券失败');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">卡券管理</h1>
        <Button onClick={openCreateDialog}>新增卡券</Button>
      </div>

      {/* 汇总卡片 */}
      <div className="grid gap-4 md:grid-cols-5">
        {[
          { label: '总卡券', value: summary.total, variant: 'outline' as const },
          { label: '未赠送', value: summary.ungifted, variant: 'secondary' as const },
          { label: '已赠送', value: summary.gifted, variant: 'outline' as const },
          { label: '已认领', value: summary.claimed, variant: 'default' as const },
          { label: '已兑换', value: summary.redeemed, variant: 'default' as const },
        ].map(item => (
          <Card key={item.label}>
            <CardContent className="flex flex-col items-center justify-center p-4">
              <span className="text-2xl font-bold">{item.value}</span>
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 搜索 */}
      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="搜索卡号 / 商品名"
            value={search}
            onChange={e => { setSearch(e.target.value); resetPage(); }}
            className="max-w-sm"
          />
        </CardContent>
      </Card>

      {/* 状态标签 */}
      <Tabs value={tab} onValueChange={v => { setTab(v as StatusFilter); resetPage(); }}>
        <TabsList>
          {tabs.map(t => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab}>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>卡号</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>商品名</TableHead>
                    <TableHead>购买金额</TableHead>
                    <TableHead>抵扣金额</TableHead>
                    <TableHead>购买人</TableHead>
                    <TableHead>持有人</TableHead>
                    <TableHead>关联订单</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">加载中...</TableCell>
                    </TableRow>
                  ) : pagedCards.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">暂无卡券数据</TableCell>
                    </TableRow>
                  ) : pagedCards.map(card => (
                    <TableRow key={card.id}>
                      <TableCell className="font-mono text-xs">{card.cardNo}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[card.status]}>
                          {statusLabel[card.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate">{card.productName}</TableCell>
                      <TableCell className="font-medium">¥{formatMoney(getCardPurchaseAmount(card))}</TableCell>
                      <TableCell className="font-medium">¥{formatMoney(getCardDeductionAmount(card))}</TableCell>
                      <TableCell className="text-sm">{card.purchaserName || '-'}</TableCell>
                      <TableCell className="text-sm">{card.currentHolderName || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{card.purchaseOrderNo || '-'}</TableCell>
                      <TableCell className="text-xs">{card.createdAt ? formatDateTime(card.createdAt) : '-'}</TableCell>
                      <TableCell>
                        {canAdminGiftCard(card) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mr-2"
                            onClick={() => openGiftDialog(card)}
                          >
                            赠送
                          </Button>
                        )}
                        {['ungifted', 'gifted', 'claimed'].includes(card.status) && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => { setVoidTarget(card); setVoidReason(''); }}
                          >
                            作废
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  第 <span className="font-medium text-foreground">{currentPage}</span> / <span className="font-medium text-foreground">{totalPages}</span> 页，
                  每页 <span className="font-medium text-foreground">{pageSize}</span> 条，
                  筛选结果 <span className="font-medium text-foreground">{filteredCards.length}</span> 条，
                  卡券总数 <span className="font-medium text-foreground">{cards.length}</span> 条
                </p>
                <div className="flex gap-2">
                  <Select
                    value={String(pageSize)}
                    onValueChange={value => {
                      setPageSize(parseInt(value ?? '10', 10));
                      resetPage();
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
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>新增卡券</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>卡券名称</Label>
              <Input
                value={createForm.productName}
                onChange={e => setCreateForm(form => ({ ...form, productName: e.target.value }))}
                placeholder="请输入卡券名称"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>生成数量</Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={createForm.count}
                  onChange={e => setCreateForm(form => ({ ...form, count: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>卡券抵扣金额</Label>
                <Input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={createForm.deductionAmount}
                  onChange={e => setCreateForm(form => ({ ...form, deductionAmount: e.target.value }))}
                  placeholder="请输入抵扣金额"
                />
              </div>
              <div className="space-y-2">
                <Label>购买卡券金额</Label>
                <Input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={createForm.purchaseAmount}
                  onChange={e => setCreateForm(form => ({ ...form, purchaseAmount: e.target.value }))}
                  placeholder="请输入购买金额"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>卡券封面</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={e => handleCoverUpload(e.target.files)}
              />
              {createForm.productImage && (
                <div className="flex items-center gap-3 rounded-md border p-2">
                  <img
                    src={createForm.productImage}
                    alt="卡券封面"
                    className="h-16 w-24 rounded object-cover"
                  />
                  <span className="text-sm text-muted-foreground">已上传卡券封面</span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>取消</Button>
            <Button
              onClick={handleCreateCards}
              disabled={creating || !createForm.productName.trim() || !createForm.deductionAmount || !createForm.purchaseAmount || !createForm.productImage}
            >
              {creating ? '创建中...' : '确认创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 作废对话框 */}
      <Dialog open={!!giftTarget} onOpenChange={open => { if (!open) { setGiftTarget(null); setGiftTargetSearch(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>赠送卡券</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                卡号：<span className="font-mono font-medium text-foreground">{giftTarget?.cardNo}</span>
              </p>
              <p>
                卡券：<span className="font-medium text-foreground">{giftTarget?.productName}</span>
              </p>
            </div>
            <div className="space-y-2">
              <Label>赠送对象</Label>
              <Input
                value={giftTargetSearch}
                onChange={e => setGiftTargetSearch(e.target.value)}
                placeholder="搜索姓名 / 手机号 / 类型"
              />
              <Select value={giftTargetId} onValueChange={value => setGiftTargetId(value || '')}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {selectedGiftTarget
                      ? `${selectedGiftTarget.name} · ${selectedGiftTarget.type === 'salesperson' ? '实名代理商' : '医院客户'}${selectedGiftTarget.phone ? ` · ${selectedGiftTarget.phone}` : ''}`
                      : '选择实名代理商或医院客户'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {filteredGiftTargets.map(target => (
                    <SelectItem key={target.id} value={target.id}>
                      {target.name} · {target.type === 'salesperson' ? '实名代理商' : '医院客户'}{target.phone ? ` · ${target.phone}` : ''}
                    </SelectItem>
                  ))}
                  {filteredGiftTargets.length === 0 && (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      未找到匹配的赠送对象
                    </div>
                  )}
                </SelectContent>
              </Select>
              {giftTargets.length === 0 && (
                <p className="text-xs text-muted-foreground">暂无可赠送对象：需要实名代理商或医院客户。</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setGiftTarget(null); setGiftTargetSearch(''); }}>取消</Button>
            <Button onClick={handleGiftCard} disabled={gifting || !giftTargetId}>
              {gifting ? '赠送中...' : '确认赠送'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!voidTarget} onOpenChange={open => { if (!open) setVoidTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>作废卡券</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                卡号：<span className="font-mono font-medium text-foreground">{voidTarget?.cardNo}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                商品：<span className="font-medium text-foreground">{voidTarget?.productName}</span>
              </p>
            </div>
            <div className="space-y-2">
              <Label>作废原因</Label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder="请输入作废原因"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidTarget(null)}>取消</Button>
            <Button variant="destructive" onClick={handleVoid} disabled={voiding || !voidReason.trim()}>
              {voiding ? '处理中...' : '确认作废'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
