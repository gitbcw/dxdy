'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/hooks/use-auth';
import { fetchFinanceData, fetchUsers, fetchOrders } from '@/lib/services/database';
import { reviewWithdrawal, processInvoice } from '@/lib/services/functions';
import { writeAdminLog } from '@/lib/admin-log';
import { formatMoney } from '@/lib/format';

type RechargeOrder = {
  id: string;
  orderNo?: string;
  customerId?: string;
  amount?: number;
  rechargeTier?: { amount: number; bonus: number; label?: string };
  status?: string;
  createdAt?: string;
  paidAt?: string;
};

type WithdrawalRecord = {
  id: string;
  salespersonId?: string;
  amount?: number;
  bankName?: string;
  cardNo?: string;
  status?: string;
  appliedAt?: string;
  reviewNote?: string;
};

type InvoiceRecord = {
  id: string;
  orderNo?: string;
  orderId?: string;
  invoiceType?: string;
  title?: string;
  amount?: number;
  email?: string;
  status?: string;
  createdAt?: string;
  invoiceFileID?: string;
  rejectReason?: string;
};

type ReviewTarget =
  | { type: 'withdrawal'; record: WithdrawalRecord; action: 'approved' | 'rejected' | 'paid' }
  | { type: 'invoice'; record: InvoiceRecord; action: 'issued' | 'rejected' };

const withdrawalStatusText: Record<string, string> = {
  pending_review: '待审核',
  approved: '已通过',
  rejected: '已驳回',
  paid: '已打款',
  completed: '已打款',
};

const invoiceStatusText: Record<string, string> = {
  pending: '待处理',
  issued: '已开票',
  rejected: '已驳回',
};

export default function FinancePage() {
  const { user } = useAuth();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [recharges, setRecharges] = useState<RechargeOrder[]>([]);
  const [salespersonMap, setSalespersonMap] = useState<Record<string, string>>({});
  const [target, setTarget] = useState<ReviewTarget | null>(null);
  const [note, setNote] = useState('');
  const [invoiceFileID, setInvoiceFileID] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [company, setCompany] = useState('');
  const [trackingNo, setTrackingNo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadFinance();
  }, []);

  async function loadFinance() {
    setLoading(true);
    setError('');
    try {
      const [data, usersData, allOrders] = await Promise.all([fetchFinanceData(), fetchUsers(), fetchOrders()]);
      setWithdrawals(data.withdrawals || []);
      setInvoices(data.invoices || []);
      setRecharges((allOrders || []).filter((o: any) => o.type === 'recharge'));
      const map: Record<string, string> = {};
      for (const u of usersData.salespersons || []) {
        map[u.id] = u.realName || u.nickname || u.name || u.phone || u.id;
      }
      for (const u of usersData.customers || []) {
        map[u.id] = u.nickname || u.phone || u.id;
      }
      setSalespersonMap(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : '财务数据读取失败');
    } finally {
      setLoading(false);
    }
  }

  function openTarget(next: ReviewTarget) {
    setTarget(next);
    setNote('');
    setInvoiceFileID('');
    setInvoiceNo('');
    setCompany('');
    setTrackingNo('');
  }

  async function submitTarget() {
    if (!target) return;
    const op = {
      operatorId: user?.id || 'admin_001',
      operatorName: user?.realName || user?.username || '后台管理员',
    };
    try {
      if (target.type === 'withdrawal') {
        const params: { id: string; status?: string; approved?: boolean; note: string; operatorId: string; operatorName: string } = {
          id: target.record.id,
          note,
          ...op,
        };
        if (target.action === 'paid') params.status = 'paid';
        else if (target.action === 'approved') params.approved = true;
        else if (target.action === 'rejected') params.approved = false;
        const result = await reviewWithdrawal(params);
        if (!result.success) throw new Error(result.error || '处理失败');
        await writeAdminLog({ operator: user, action: `withdrawal_${target.action}`, target: target.record.id, detail: `提现处理: ${target.action}` });
      } else {
        const result = await processInvoice({
          id: target.record.id,
          status: target.action,
          note,
          invoiceFileID,
          invoiceNo,
          company,
          trackingNo,
          ...op,
        });
        if (!result.success) throw new Error(result.error || '处理失败');
        await writeAdminLog({ operator: user, action: `invoice_${target.action}`, target: target.record.id, detail: `发票处理: ${target.action}` });
      }
      setTarget(null);
      await loadFinance();
    } catch (err) {
      setError(err instanceof Error ? err.message : '处理失败');
    }
  }

  const pendingWithdrawals = withdrawals.filter(item => item.status === 'pending_review').length;
  const pendingInvoices = invoices.filter(item => item.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">财务处理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          待审核提现 {pendingWithdrawals} 笔，待处理发票 {pendingInvoices} 张，充值记录 {recharges.length} 笔
        </p>
      </div>
      {error && <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

      <Tabs defaultValue="withdrawals">
        <TabsList>
          <TabsTrigger value="withdrawals">提现审核 ({withdrawals.length})</TabsTrigger>
          <TabsTrigger value="invoices">开票处理 ({invoices.length})</TabsTrigger>
          <TabsTrigger value="recharges">充值记录 ({recharges.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="withdrawals">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">待审核</p><p className="text-2xl font-bold">{withdrawals.filter(w => w.status === 'pending_review').length} 笔</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">待审核金额</p><p className="text-2xl font-bold">¥{formatMoney(withdrawals.filter(w => w.status === 'pending_review').reduce((s, w) => s + (w.amount || 0), 0))}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">累计提现</p><p className="text-2xl font-bold">¥{formatMoney(withdrawals.filter(w => w.status === 'paid' || w.status === 'completed').reduce((s, w) => s + (w.amount || 0), 0))}</p></CardContent></Card>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>代理商</TableHead>
                    <TableHead>金额</TableHead>
                    <TableHead>银行卡</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>申请时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">正在读取提现记录...</TableCell>
                    </TableRow>
                  )}
                  {!loading && withdrawals.map(record => (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono text-sm">{record.id}</TableCell>
                      <TableCell className="text-sm">{salespersonMap[record.salespersonId || ''] || record.salespersonId || '-'}</TableCell>
                      <TableCell>¥{formatMoney(record.amount || 0)}</TableCell>
                      <TableCell>{record.bankName || '-'} {record.cardNo ? `(${String(record.cardNo).slice(-4)})` : ''}</TableCell>
                      <TableCell><Badge variant={record.status === 'rejected' ? 'destructive' : 'outline'}>{withdrawalStatusText[record.status || ''] || record.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{record.appliedAt || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {record.status === 'pending_review' && (
                            <>
                              <Button variant="outline" size="sm" onClick={() => openTarget({ type: 'withdrawal', record, action: 'approved' })}>通过</Button>
                              <Button variant="destructive" size="sm" onClick={() => openTarget({ type: 'withdrawal', record, action: 'rejected' })}>驳回</Button>
                            </>
                          )}
                          {record.status === 'approved' && (
                            <Button size="sm" onClick={() => openTarget({ type: 'withdrawal', record, action: 'paid' })}>确认打款</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>订单</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>抬头</TableHead>
                    <TableHead>金额</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>申请时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">正在读取发票申请...</TableCell>
                    </TableRow>
                  )}
                  {!loading && invoices.map(record => (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono text-sm">{record.id}</TableCell>
                      <TableCell>{record.orderNo || record.orderId}</TableCell>
                      <TableCell>{record.invoiceType === 'paper' ? '纸质' : '电子'}</TableCell>
                      <TableCell>{record.title || '-'}</TableCell>
                      <TableCell>¥{formatMoney(record.amount || 0)}</TableCell>
                      <TableCell><Badge variant={record.status === 'rejected' ? 'destructive' : 'outline'}>{invoiceStatusText[record.status || ''] || record.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{record.createdAt || '-'}</TableCell>
                      <TableCell>
                        {record.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => openTarget({ type: 'invoice', record, action: 'issued' })}>开票</Button>
                            <Button variant="destructive" size="sm" onClick={() => openTarget({ type: 'invoice', record, action: 'rejected' })}>驳回</Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recharges">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">累计充值</p><p className="text-2xl font-bold">¥{formatMoney(recharges.reduce((s, r) => s + (r.amount || 0), 0))}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">累计赠送</p><p className="text-2xl font-bold">¥{formatMoney(recharges.reduce((s, r) => s + (r.rechargeTier?.bonus || 0), 0))}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">充值笔数</p><p className="text-2xl font-bold">{recharges.length}</p></CardContent></Card>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>订单号</TableHead>
                    <TableHead>客户</TableHead>
                    <TableHead>充值金额</TableHead>
                    <TableHead>赠送</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">正在读取充值记录...</TableCell>
                    </TableRow>
                  )}
                  {!loading && recharges.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{r.orderNo || r.id}</TableCell>
                      <TableCell>{salespersonMap[r.customerId || ''] || r.customerId || '-'}</TableCell>
                      <TableCell>¥{formatMoney(r.amount || 0)}</TableCell>
                      <TableCell>{((r.rechargeTier as any)?.bonus || 0) > 0 ? `¥${formatMoney((r.rechargeTier as any).bonus)}` : '-'}</TableCell>
                      <TableCell><Badge variant="outline">{r.status === 'completed' ? '已完成' : r.status}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.paidAt || r.createdAt || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!target} onOpenChange={() => setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{target?.type === 'withdrawal' ? '处理提现' : '处理发票'}</DialogTitle>
          </DialogHeader>
          {target && (
            <div className="space-y-4 py-4">
              <div>
                <p className="text-sm text-muted-foreground">记录</p>
                <p className="font-mono">{target.record.id}</p>
              </div>
              {target.type === 'invoice' && target.action === 'issued' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="invoiceNo">发票号</Label>
                    <Input id="invoiceNo" value={invoiceNo} onChange={event => setInvoiceNo(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoiceFileID">发票文件 fileID</Label>
                    <Input id="invoiceFileID" value={invoiceFileID} onChange={event => setInvoiceFileID(event.target.value)} placeholder="电子发票必填" />
                  </div>
                  {target.record.invoiceType === 'paper' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="company">快递公司</Label>
                        <Input id="company" value={company} onChange={event => setCompany(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="trackingNo">物流单号</Label>
                        <Input id="trackingNo" value={trackingNo} onChange={event => setTrackingNo(event.target.value)} />
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="note">备注{target.action === 'rejected' ? '（驳回必填）' : ''}</Label>
                <Input id="note" value={note} onChange={event => setNote(event.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>取消</Button>
            <Button onClick={submitTarget}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
