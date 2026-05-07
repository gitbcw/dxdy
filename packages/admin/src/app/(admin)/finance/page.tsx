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
import { cloudbaseFetch, cloudbaseJsonFetch } from '@/lib/admin-api-client';
import { formatMoney } from '@/lib/format';

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
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
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
      const res = await cloudbaseFetch('/api/cloudbase/finance', { cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || '财务数据读取失败');
      const data = await res.json() as { withdrawals?: WithdrawalRecord[]; invoices?: InvoiceRecord[] };
      setWithdrawals(data.withdrawals || []);
      setInvoices(data.invoices || []);
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
    try {
      const stored = window.localStorage.getItem('admin_user');
      const adminUser = stored ? JSON.parse(stored) as { id?: string; realName?: string; username?: string } : null;
      const payload = target.type === 'withdrawal'
        ? {
            type: 'withdrawal',
            id: target.record.id,
            status: target.action === 'paid' ? 'paid' : undefined,
            approved: target.action === 'approved' ? true : target.action === 'rejected' ? false : undefined,
            note,
          }
        : {
            type: 'invoice',
            id: target.record.id,
            status: target.action,
            note,
            invoiceFileID,
            invoiceNo,
            company,
            trackingNo,
          };
      const res = await cloudbaseJsonFetch('/api/cloudbase/finance', {
          ...payload,
          operatorId: adminUser?.id,
          operatorName: adminUser?.realName || adminUser?.username,
        });
      if (!res.ok) throw new Error((await res.json()).error || '处理失败');
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
          待审核提现 {pendingWithdrawals} 笔，待处理发票 {pendingInvoices} 张
        </p>
      </div>
      {error && <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

      <Tabs defaultValue="withdrawals">
        <TabsList>
          <TabsTrigger value="withdrawals">提现审核 ({withdrawals.length})</TabsTrigger>
          <TabsTrigger value="invoices">开票处理 ({invoices.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="withdrawals">
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
                      <TableCell className="font-mono text-sm">{record.salespersonId || '-'}</TableCell>
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
