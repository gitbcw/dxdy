'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cloudbaseFetch, cloudbaseJsonFetch } from '@/lib/admin-api-client';
import { formatMoney, formatDateTime } from '@/lib/format';
import type { AdminUser, ReturnRecord } from '@/lib/types';

const statusLabel: Record<string, string> = {
  pending_review: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
  pending_return_ship: '待退货发货',
  returned: '已退货',
  verifying: '验货中',
  customer_shipping: '等待寄回',
  received: '商品质检',
  refunding: '退款中',
  return_completed: '退货完成',
  exchange_shipping: '换货发货中',
  exchange_completed: '换货完成',
};

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [reviewTarget, setReviewTarget] = useState<ReturnRecord | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submittingId, setSubmittingId] = useState('');

  useEffect(() => {
    loadReturns();
  }, []);

  function getOperator() {
    if (typeof window === 'undefined') return { operatorId: 'admin_001', operatorName: '后台管理员' };
    try {
      const stored = window.localStorage.getItem('admin_user');
      const user = stored ? JSON.parse(stored) as AdminUser : null;
      return {
        operatorId: user?.id || 'admin_001',
        operatorName: user?.realName || user?.username || '后台管理员',
      };
    } catch {
      return { operatorId: 'admin_001', operatorName: '后台管理员' };
    }
  }

  async function loadReturns() {
    setLoading(true);
    setError('');
    try {
      const response = await cloudbaseFetch('/api/cloudbase/returns', { cache: 'no-store' });
      const data = await response.json() as { returns?: ReturnRecord[]; error?: string };
      if (!response.ok) throw new Error(data.error || '读取售后数据失败');
      setReturns(data.returns || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取售后数据失败');
    } finally {
      setLoading(false);
    }
  }

  function updateRecord(updated?: ReturnRecord) {
    if (!updated) return;
    setReturns(prev => prev.map(record => record.id === updated.id ? updated : record));
  }

  async function handleReview(approved: boolean) {
    if (!reviewTarget) return;
    setSubmittingId(reviewTarget.id);
    setError('');
    try {
      const response = await cloudbaseJsonFetch('/api/cloudbase/returns', {
          id: reviewTarget.id,
          approved,
          note: reviewNote,
          ...getOperator(),
        });
      const data = await response.json() as { record?: ReturnRecord; error?: string };
      if (!response.ok) throw new Error(data.error || '审核失败');
      updateRecord(data.record);
      setReviewTarget(null);
      setReviewNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '审核失败');
    } finally {
      setSubmittingId('');
    }
  }

  async function handleAdvance(id: string, status: string) {
    setSubmittingId(id);
    setError('');
    try {
      const response = await cloudbaseJsonFetch('/api/cloudbase/returns', {
          id,
          status,
          ...getOperator(),
        });
      const data = await response.json() as { record?: ReturnRecord; error?: string };
      if (!response.ok) throw new Error(data.error || '处理失败');
      updateRecord(data.record);
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理失败');
    } finally {
      setSubmittingId('');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">退换货管理</h1>
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>订单号</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>原因</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>申请时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    加载售后数据中...
                  </TableCell>
                </TableRow>
              )}
              {!loading && returns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    暂无售后记录
                  </TableCell>
                </TableRow>
              )}
              {!loading && returns.map(record => (
                <TableRow key={record.id}>
                  <TableCell className="font-mono text-sm">{record.id}</TableCell>
                  <TableCell className="font-mono text-sm">{record.orderId}</TableCell>
                  <TableCell>{record.type === 'return' ? '退货' : '换货'}</TableCell>
                  <TableCell>
                    <Badge variant={record.status === 'pending_review' ? 'outline' : 'default'}>
                      {statusLabel[record.status] ?? record.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-48 truncate">{record.reason}</TableCell>
                  <TableCell>{record.refundAmount ? `¥${formatMoney(record.refundAmount)}` : '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateTime(record.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {record.status === 'pending_review' && (
                        <Button variant="outline" size="sm" onClick={() => { setReviewTarget(record); setReviewNote(''); }} disabled={submittingId === record.id}>
                          审核
                        </Button>
                      )}
                      {record.status === 'approved' && (
                        <Button variant="outline" size="sm" onClick={() => handleAdvance(record.id, 'customer_shipping')} disabled={submittingId === record.id}>
                          等待寄回
                        </Button>
                      )}
                      {['customer_shipping', 'returned'].includes(record.status) && (
                        <Button variant="outline" size="sm" onClick={() => handleAdvance(record.id, 'received')} disabled={submittingId === record.id}>
                          确认收货验货
                        </Button>
                      )}
                      {record.type === 'return' && ['received', 'verifying'].includes(record.status) && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleAdvance(record.id, 'refunding')} disabled={submittingId === record.id}>
                            验货合格
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleAdvance(record.id, 'rejected')} disabled={submittingId === record.id}>
                            不合格
                          </Button>
                        </>
                      )}
                      {record.status === 'refunding' && (
                        <Button variant="default" size="sm" onClick={() => handleAdvance(record.id, 'return_completed')} disabled={submittingId === record.id}>
                          确认退款
                        </Button>
                      )}
                      {record.type === 'exchange' && ['received', 'verifying'].includes(record.status) && (
                        <Button variant="default" size="sm" onClick={() => handleAdvance(record.id, 'exchange_shipping')} disabled={submittingId === record.id}>
                          换货发货
                        </Button>
                      )}
                      {record.type === 'exchange' && record.status === 'exchange_shipping' && (
                        <Button variant="default" size="sm" onClick={() => handleAdvance(record.id, 'exchange_completed')} disabled={submittingId === record.id}>
                          确认收货
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!reviewTarget} onOpenChange={() => setReviewTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>审核退换货</DialogTitle>
          </DialogHeader>
          {reviewTarget && (
            <div className="space-y-3 py-4">
              <div>
                <p className="text-sm text-muted-foreground">订单号</p>
                <p className="font-mono">{reviewTarget.orderId}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">原因</p>
                <p>{reviewTarget.reason}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">商品</p>
                {reviewTarget.items.map((item, i) => (
                  <p key={i}>{item.productName} x{item.quantity} ¥{formatMoney(item.unitPrice)}</p>
                ))}
              </div>
              {reviewTarget.refundAmount && (
                <div>
                  <p className="text-sm text-muted-foreground">退款金额</p>
                  <p>¥{formatMoney(reviewTarget.refundAmount)}</p>
                </div>
              )}
              {reviewTarget.sendLogistics && (
                <div>
                  <p className="text-sm text-muted-foreground">寄回物流</p>
                  <p>{reviewTarget.sendLogistics.company} {reviewTarget.sendLogistics.trackingNo}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="reviewNote">审核备注</Label>
                <Input id="reviewNote" value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="输入审核意见" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="destructive" onClick={() => handleReview(false)}>拒绝</Button>
            <Button onClick={() => handleReview(true)}>通过</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
