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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { writeAdminLog } from '@/lib/admin-log';
import { formatDateTime } from '@/lib/format';
import { fetchCardVouchers, updateCardVoucher } from '@/lib/services/database';
import type { CardVoucher, CardVoucherStatus } from '@/lib/types';

const statusLabel: Record<CardVoucherStatus, string> = {
  ungifted: '未赠送',
  gifted: '已赠送',
  claimed: '已认领',
  redeemed: '已兑换',
  verified: '已核销',
  expired: '已过期',
  voided: '已作废',
};

const statusVariant: Record<CardVoucherStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ungifted: 'secondary',
  gifted: 'outline',
  claimed: 'default',
  redeemed: 'default',
  verified: 'default',
  expired: 'secondary',
  voided: 'destructive',
};

type StatusFilter = 'all' | CardVoucherStatus;

const tabs: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'ungifted', label: '未赠送' },
  { value: 'gifted', label: '已赠送' },
  { value: 'claimed', label: '已认领' },
  { value: 'redeemed', label: '已兑换' },
  { value: 'verified', label: '已核销' },
  { value: 'expired', label: '已过期' },
  { value: 'voided', label: '已作废' },
];

function normalizeDoc(doc: Record<string, unknown>): CardVoucher {
  const { _id, ...rest } = doc;
  return { id: String(_id || (doc as Record<string, unknown>).id || ''), ...rest } as CardVoucher;
}

export default function CardsPage() {
  const { user } = useAuth();
  const [cards, setCards] = useState<CardVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // 作废对话框
  const [voidTarget, setVoidTarget] = useState<CardVoucher | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  async function loadCards() {
    setLoading(true);
    try {
      const docs = await fetchCardVouchers();
      // 惰性过期：标记已过期的卡券
      const now = new Date().toISOString();
      const updated = docs.map(card => {
        if (['ungifted', 'gifted', 'claimed'].includes(card.status) && card.expiresAt && card.expiresAt < now) {
          return { ...card, status: 'expired' as CardVoucherStatus };
        }
        return card;
      });
      setCards(updated);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">卡券管理</h1>
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
                    <TableHead>购买人</TableHead>
                    <TableHead>持有人</TableHead>
                    <TableHead>关联订单</TableHead>
                    <TableHead>到期时间</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">加载中...</TableCell>
                    </TableRow>
                  ) : pagedCards.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">暂无卡券数据</TableCell>
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
                      <TableCell className="text-sm">{card.purchaserName || '-'}</TableCell>
                      <TableCell className="text-sm">{card.currentHolderName || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{card.purchaseOrderNo || '-'}</TableCell>
                      <TableCell className="text-xs">{card.expiresAt ? formatDateTime(card.expiresAt) : '-'}</TableCell>
                      <TableCell className="text-xs">{card.createdAt ? formatDateTime(card.createdAt) : '-'}</TableCell>
                      <TableCell>
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

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    第 {currentPage} / {totalPages} 页，共 {filteredCards.length} 条
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 作废对话框 */}
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
