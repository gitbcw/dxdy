'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { fetchClerks, fetchReturns } from '@/lib/services/database';
import { assignOrderToClerk, clerkShipOrder, queryLogistics, reviewReturn } from '@/lib/services/functions';
import { writeAdminLog } from '@/lib/admin-log';
import { formatMoney, formatDateTime } from '@/lib/format';
import type { Clerk, LogisticsInfo, ReturnRecord } from '@/lib/types';

type ReturnLogisticsTrack = LogisticsInfo & {
  title?: string;
  desc?: string;
};

const typeLabel: Record<string, string> = {
  return: '退货退款',
  refund_return: '退货退款',
  exchange: '换货',
};

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

const actionLabel: Record<string, string> = {
  review: '审核',
  wait_customer_shipping: '等待寄回',
  receive_and_verify: '确认收货验货',
  refunding: '验货合格',
  reject: '不合格',
  confirm_refund: '确认退款',
  exchange_shipping: '换货发货',
  none: '无可用操作',
};

function getReturnTypeText(type: string) {
  return typeLabel[type] ?? type;
}

function DateFilterInput({
  title,
  value,
  onChange,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative flex h-8 w-full items-center rounded-lg border border-input bg-background px-2.5 text-sm">
      <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
        {value || title}
      </span>
      <CalendarDays className="ml-auto size-4 text-muted-foreground" />
      <input
        type="date"
        className="absolute inset-0 cursor-pointer opacity-0"
        value={value}
        onChange={event => onChange(event.target.value)}
        title={title}
      />
    </div>
  );
}

function getAvailableActions(record: ReturnRecord) {
  const actions: string[] = [];
  if (record.status === 'pending_review') actions.push('review');
  if (record.status === 'approved') actions.push('wait_customer_shipping');
  if (['customer_shipping', 'returned'].includes(record.status)) actions.push('receive_and_verify');
  if (record.type !== 'exchange' && ['received', 'verifying'].includes(record.status)) {
    actions.push('refunding', 'reject');
  }
  if (record.status === 'refunding') actions.push('confirm_refund');
  if (record.type === 'exchange' && ['received', 'verifying'].includes(record.status)) actions.push('exchange_shipping');
  return actions.length > 0 ? actions : ['none'];
}

export default function ReturnsPage() {
  const { user } = useAuth();
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [reviewTarget, setReviewTarget] = useState<ReturnRecord | null>(null);
  const [logisticsTarget, setLogisticsTarget] = useState<ReturnRecord | null>(null);
  const [logisticsTracks, setLogisticsTracks] = useState<ReturnLogisticsTrack[]>([]);
  const [logisticsLoading, setLogisticsLoading] = useState(false);
  const [logisticsError, setLogisticsError] = useState('');
  const [exchangeShipTarget, setExchangeShipTarget] = useState<ReturnRecord | null>(null);
  const [exchangeAssignTarget, setExchangeAssignTarget] = useState<ReturnRecord | null>(null);
  const [exchangeShipCompany, setExchangeShipCompany] = useState('');
  const [exchangeTrackingNo, setExchangeTrackingNo] = useState('');
  const [clerks, setClerks] = useState<Clerk[]>([]);
  const [reviewNote, setReviewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submittingId, setSubmittingId] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadReturns();
  }, []);

  function getOperator() {
    return {
      operatorId: user?.id || 'admin_001',
      operatorName: user?.realName || user?.username || '后台管理员',
    };
  }

  async function loadReturns() {
    setLoading(true);
    setError('');
    try {
      const [data, clerkData] = await Promise.all([
        fetchReturns(),
        fetchClerks(user?.id).catch(() => []),
      ]);
      setReturns(data);
      setClerks(clerkData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取售后数据失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleReview(approved: boolean) {
    if (!reviewTarget) return;
    setSubmittingId(reviewTarget.id);
    setError('');
    const op = getOperator();
    try {
      const result = await reviewReturn({
        id: reviewTarget.id,
        approved,
        note: reviewNote,
        ...op,
      });
      if (!result.success) throw new Error(result.error || '审核失败');
      await writeAdminLog({ operator: user, action: approved ? 'approve_return' : 'reject_return', target: reviewTarget.id, detail: `审核退换货 ${reviewTarget.id}: ${approved ? '通过' : '拒绝'}` });
      await loadReturns();
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
    const op = getOperator();
    try {
      const result = await reviewReturn({
        id,
        status,
        ...op,
      });
      if (!result.success) throw new Error(result.error || '处理失败');
      await writeAdminLog({ operator: user, action: 'advance_return', target: id, detail: `售后状态推进至 ${status}` });
      await loadReturns();
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理失败');
    } finally {
      setSubmittingId('');
    }
  }

  async function ensureExchangeOrder(record: ReturnRecord) {
    if (record.exchangeOrderId) return record.exchangeOrderId;
    const result = await reviewReturn({
      id: record.id,
      status: 'exchange_shipping',
      ...getOperator(),
    });
    if (!result.success) throw new Error(result.error || '换货发货订单创建失败');
    const updatedRecord = result.record as ReturnRecord | undefined;
    if (!updatedRecord?.exchangeOrderId) throw new Error('换货发货订单创建失败');
    await writeAdminLog({
      operator: user,
      action: 'create_exchange_order',
      target: record.id,
      detail: `售后单 ${record.id} 创建换货发货订单 ${updatedRecord.exchangeOrderId}`,
    });
    return updatedRecord.exchangeOrderId;
  }

  function openExchangeShipDialog(record: ReturnRecord) {
    setExchangeShipTarget(record);
    setExchangeShipCompany('');
    setExchangeTrackingNo('');
    setError('');
  }

  function openExchangeAssignDialog(record: ReturnRecord) {
    setExchangeAssignTarget(record);
    setError('');
  }

  async function handleExchangeShip() {
    if (!exchangeShipTarget) return;
    if (!exchangeShipCompany.trim() || !exchangeTrackingNo.trim()) {
      setError('请填写物流公司和物流单号');
      return;
    }
    setSubmittingId(exchangeShipTarget.id);
    setError('');
    try {
      const exchangeOrderId = await ensureExchangeOrder(exchangeShipTarget);
      const result = await clerkShipOrder({
        orderId: exchangeOrderId,
        company: exchangeShipCompany.trim(),
        trackingNo: exchangeTrackingNo.trim(),
        ...getOperator(),
      });
      if (!result.success) throw new Error(result.error || '换货发货失败');
      await writeAdminLog({
        operator: user,
        action: 'ship_exchange_order',
        target: exchangeOrderId,
        detail: `换货订单 ${exchangeOrderId} 手动发货：${exchangeShipCompany.trim()} ${exchangeTrackingNo.trim()}`,
      });
      await loadReturns();
      setExchangeShipTarget(null);
      setExchangeShipCompany('');
      setExchangeTrackingNo('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '换货发货失败');
    } finally {
      setSubmittingId('');
    }
  }

  async function handleExchangeAssign(clerkId: string) {
    if (!exchangeAssignTarget) return;
    setSubmittingId(exchangeAssignTarget.id);
    setError('');
    try {
      const exchangeOrderId = await ensureExchangeOrder(exchangeAssignTarget);
      const result = await assignOrderToClerk({
        orderId: exchangeOrderId,
        clerkId,
        ...getOperator(),
      });
      if (!result.success) throw new Error(result.error || '换货订单指派失败');
      await writeAdminLog({
        operator: user,
        action: 'assign_exchange_order',
        target: exchangeOrderId,
        detail: `换货订单 ${exchangeOrderId} 指派给制单员 ${clerkId}`,
      });
      await loadReturns();
      setExchangeAssignTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '换货订单指派失败');
    } finally {
      setSubmittingId('');
    }
  }

  const availableStatuses = useMemo(
    () => [...new Set(returns.map(record => record.status))],
    [returns],
  );

  const availableActions = useMemo(
    () => [...new Set(returns.flatMap(record => getAvailableActions(record)))],
    [returns],
  );

  const filteredReturns = useMemo(() => {
    return returns.filter(record => {
      if (typeFilter !== 'all' && record.type !== typeFilter) return false;
      if (statusFilter !== 'all' && record.status !== statusFilter) return false;
      if (actionFilter !== 'all' && !getAvailableActions(record).includes(actionFilter)) return false;
      if (dateFrom && record.createdAt < dateFrom) return false;
      if (dateTo && record.createdAt > `${dateTo}T23:59:59`) return false;
      return true;
    });
  }, [returns, typeFilter, statusFilter, actionFilter, dateFrom, dateTo]);

  function clearFilters() {
    setTypeFilter('all');
    setStatusFilter('all');
    setActionFilter('all');
    setDateFrom('');
    setDateTo('');
  }

  function getReturnLogisticsTracks(record: ReturnRecord | null): ReturnLogisticsTrack[] {
    if (!record) return [];
    const sendLogistics = record.sendLogistics as (ReturnRecord['sendLogistics'] & { logistics?: LogisticsInfo[]; tracks?: LogisticsInfo[] }) | null;
    if (!sendLogistics) return [];
    if (Array.isArray(sendLogistics.logistics)) return sendLogistics.logistics as ReturnLogisticsTrack[];
    if (Array.isArray(sendLogistics.tracks)) return sendLogistics.tracks as ReturnLogisticsTrack[];
    return [];
  }

  async function openLogisticsDialog(record: ReturnRecord) {
    setLogisticsTarget(record);
    setLogisticsTracks(getReturnLogisticsTracks(record));
    setLogisticsError('');
    if (!record.sendLogistics?.trackingNo) return;
    setLogisticsLoading(true);
    try {
      const result = await queryLogistics({
        orderId: record.orderId,
        trackingNo: record.sendLogistics.trackingNo,
        userId: user?.id,
      });
      if (!result.success) throw new Error(result.error || '物流查询失败');
      const tracks = Array.isArray(result.provider?.tracks)
        ? result.provider.tracks as ReturnLogisticsTrack[]
        : [];
      setLogisticsTracks(tracks);
      if (!tracks.length) {
        setLogisticsError(result.provider?.providerMessage || '暂未查询到实时物流轨迹');
      }
    } catch (err) {
      setLogisticsError(err instanceof Error ? err.message : '物流查询失败');
    } finally {
      setLogisticsLoading(false);
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
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
            <Select value={typeFilter} onValueChange={value => setTypeFilter(value ?? 'all')}>
              <SelectTrigger className="w-full">
                <SelectValue>{typeFilter === 'all' ? '全部类型' : getReturnTypeText(typeFilter)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="return">退货退款</SelectItem>
                <SelectItem value="refund_return">退货退款</SelectItem>
                <SelectItem value="exchange">换货</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={value => setStatusFilter(value ?? 'all')}>
              <SelectTrigger className="w-full">
                <SelectValue>{statusFilter === 'all' ? '全部状态' : statusLabel[statusFilter]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {availableStatuses.map(status => (
                  <SelectItem key={status} value={status}>{statusLabel[status] ?? status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={value => setActionFilter(value ?? 'all')}>
              <SelectTrigger className="w-full">
                <SelectValue>{actionFilter === 'all' ? '全部操作' : actionLabel[actionFilter]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部操作</SelectItem>
                {availableActions.map(action => (
                  <SelectItem key={action} value={action}>{actionLabel[action] ?? action}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateFilterInput title="开始时间" value={dateFrom} onChange={setDateFrom} />
            <DateFilterInput title="结束时间" value={dateTo} onChange={setDateTo} />
            <Button type="button" variant="outline" onClick={clearFilters}>
              清空筛选
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>订单号</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>原因</TableHead>
                <TableHead>寄回物流</TableHead>
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
              {!loading && returns.length > 0 && filteredReturns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    没有符合当前筛选条件的售后记录
                  </TableCell>
                </TableRow>
              )}
              {!loading && filteredReturns.map(record => (
                <TableRow key={record.id}>
                  <TableCell className="font-mono text-sm">{record.orderId}</TableCell>
                  <TableCell>{getReturnTypeText(record.type)}</TableCell>
                  <TableCell>
                    <Badge variant={record.status === 'pending_review' ? 'outline' : 'default'}>
                      {statusLabel[record.status] ?? record.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-48 truncate">{record.reason}</TableCell>
                  <TableCell className="text-sm">
                    {record.sendLogistics?.trackingNo ? (
                      <Button variant="outline" size="sm" onClick={() => openLogisticsDialog(record)}>
                        查看物流
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{record.refundAmount ? `¥${formatMoney(record.refundAmount)}` : '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateTime(record.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {record.status !== 'pending_review' && (
                        <Button variant="outline" size="sm" onClick={() => { setReviewTarget(record); setReviewNote(''); }}>
                          详情
                        </Button>
                      )}
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
                      {record.type !== 'exchange' && ['received', 'verifying'].includes(record.status) && (
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
                        <>
                          <Button variant="default" size="sm" onClick={() => openExchangeShipDialog(record)} disabled={submittingId === record.id}>
                            手动发货
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openExchangeAssignDialog(record)} disabled={submittingId === record.id}>
                            指派制单员
                          </Button>
                        </>
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
            <DialogTitle>{reviewTarget?.status === 'pending_review' ? '审核退换货' : '退换货详情'}</DialogTitle>
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
                <p className="text-sm text-muted-foreground">问题描述</p>
                <p className="whitespace-pre-wrap break-words text-sm">{reviewTarget.description || '未填写'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">商品</p>
                {reviewTarget.items.map((item, i) => (
                  <p key={i}>{item.productName} x{item.quantity} ¥{formatMoney(item.unitPrice)}</p>
                ))}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">上传凭证</p>
                {reviewTarget.voucherUrls && reviewTarget.voucherUrls.length > 0 ? (
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {reviewTarget.voucherUrls.map((url, i) => (
                      <a key={`${url}-${i}`} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border bg-muted">
                        <img src={url} alt={`售后凭证 ${i + 1}`} className="aspect-square w-full object-cover" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm">未上传</p>
                )}
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
              {reviewTarget.type === 'exchange' && (
                <div>
                  <p className="text-sm text-muted-foreground">换货发货订单</p>
                  {reviewTarget.exchangeOrderId ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm">{reviewTarget.exchangeOrderId}</p>
                      <Link href={`/orders/detail/?id=${encodeURIComponent(reviewTarget.exchangeOrderId)}`}>
                        <Button variant="outline" size="sm">查看订单</Button>
                      </Link>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">验货合格后会自动创建换货发货订单</p>
                  )}
                </div>
              )}
              {reviewTarget.status === 'pending_review' && (
                <div className="space-y-2">
                  <Label htmlFor="reviewNote">审核备注</Label>
                  <Input id="reviewNote" value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="输入审核意见" />
                </div>
              )}
            </div>
          )}
          {reviewTarget?.status === 'pending_review' ? (
            <DialogFooter>
              <Button variant="destructive" onClick={() => handleReview(false)}>拒绝</Button>
              <Button onClick={() => handleReview(true)}>通过</Button>
            </DialogFooter>
          ) : (
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewTarget(null)}>关闭</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!exchangeShipTarget} onOpenChange={open => {
        if (!open) setExchangeShipTarget(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>换货手动发货</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>原订单号</Label>
              <p className="font-mono text-sm">{exchangeShipTarget?.orderId}</p>
            </div>
            {exchangeShipTarget?.exchangeOrderId && (
              <div className="space-y-2">
                <Label>换货发货订单</Label>
                <p className="font-mono text-sm">{exchangeShipTarget.exchangeOrderId}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="exchangeShipCompany">物流公司</Label>
              <Input
                id="exchangeShipCompany"
                value={exchangeShipCompany}
                onChange={event => setExchangeShipCompany(event.target.value)}
                placeholder="如 顺丰速运"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exchangeTrackingNo">物流单号</Label>
              <Input
                id="exchangeTrackingNo"
                value={exchangeTrackingNo}
                onChange={event => setExchangeTrackingNo(event.target.value)}
                placeholder="请输入物流单号"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExchangeShipTarget(null)}>取消</Button>
            <Button onClick={handleExchangeShip} disabled={!!exchangeShipTarget && submittingId === exchangeShipTarget.id}>
              确认发货
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!exchangeAssignTarget} onOpenChange={open => {
        if (!open) setExchangeAssignTarget(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>指派换货发货订单</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>原订单号</Label>
              <p className="font-mono text-sm">{exchangeAssignTarget?.orderId}</p>
            </div>
            {exchangeAssignTarget?.exchangeOrderId && (
              <div className="space-y-2">
                <Label>换货发货订单</Label>
                <p className="font-mono text-sm">{exchangeAssignTarget.exchangeOrderId}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>选择制单员</Label>
              <div className="space-y-2">
                {clerks.length === 0 && (
                  <p className="rounded-lg border p-3 text-sm text-muted-foreground">暂无可用制单员</p>
                )}
                {clerks.map(clerk => (
                  <button
                    key={clerk.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent disabled:opacity-60"
                    disabled={!!exchangeAssignTarget && submittingId === exchangeAssignTarget.id}
                    onClick={() => handleExchangeAssign(clerk.id)}
                  >
                    <div>
                      <p className="font-medium">{clerk.realName || clerk.nickname}</p>
                      <p className="text-sm text-muted-foreground">{clerk.phone}</p>
                    </div>
                    <Badge variant="secondary">指派</Badge>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExchangeAssignTarget(null)}>取消</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!logisticsTarget}
        onOpenChange={open => {
          if (!open) {
            setLogisticsTarget(null);
            setLogisticsTracks([]);
            setLogisticsError('');
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>寄回物流详情</DialogTitle>
          </DialogHeader>
          {logisticsTarget?.sendLogistics && (
            <div className="max-h-[calc(85vh-8rem)] space-y-4 overflow-y-auto py-4 pr-2">
              <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">快递公司</p>
                  <p className="mt-1 font-medium">{logisticsTarget.sendLogistics.company || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">物流单号</p>
                  <p className="mt-1 font-mono font-medium">{logisticsTarget.sendLogistics.trackingNo || '-'}</p>
                </div>
              </div>
              <div>
                <p className="mb-3 text-sm font-medium">物流轨迹</p>
                {logisticsLoading ? (
                  <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                    正在查询物流轨迹...
                  </div>
                ) : logisticsTracks.length > 0 ? (
                  <div className="max-h-[48vh] space-y-3 overflow-y-auto pr-2">
                    {logisticsTracks.map((track, index) => (
                      <div key={`${track.time}-${index}`} className="relative border-l border-border pl-4">
                        <span className="absolute -left-1.5 top-1.5 size-3 rounded-full bg-primary" />
                        <p className="text-sm font-medium">{track.title || track.description || track.desc || '物流更新'}</p>
                        {(track.description || track.desc) && (
                          <p className="mt-1 text-sm text-muted-foreground">{track.description || track.desc}</p>
                        )}
                        {track.time && <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(track.time)}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                    {logisticsError || '暂无物流轨迹'}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogisticsTarget(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
