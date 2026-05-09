'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/hooks/use-auth';
import { fetchTestReports } from '@/lib/services/database';
import { manageTestReport } from '@/lib/services/functions';
import { writeAdminLog } from '@/lib/admin-log';

type TestReport = {
  id: string;
  code: string;
  reportNo?: string;
  productName?: string;
  batchNo?: string;
  bloodType?: string;
  collectedAt?: string;
  testedAt?: string;
  validUntil?: string;
  items?: { name: string; value?: string; unit?: string; referenceRange?: string; result?: string }[];
  storage?: string;
  transport?: string;
  conclusion?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ReportForm = {
  code: string;
  reportNo: string;
  productName: string;
  batchNo: string;
  bloodType: string;
  collectedAt: string;
  testedAt: string;
  validUntil: string;
  storage: string;
  transport: string;
  conclusion: string;
  internalNote: string;
  orderId: string;
  status: string;
};

const emptyForm = (): ReportForm => ({
  code: '', reportNo: '', productName: '', batchNo: '', bloodType: '',
  collectedAt: '', testedAt: '', validUntil: '', storage: '', transport: '',
  conclusion: '', internalNote: '', orderId: '', status: 'draft',
});

export default function ReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<TestReport[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<TestReport | null>(null);
  const [form, setForm] = useState<ReportForm>(emptyForm());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadReports(); }, []);

  async function loadReports() {
    setLoading(true);
    setError('');
    try {
      const data = await fetchTestReports();
      setReports(data.sort((a, b) => (b.testedAt || b.createdAt || '').localeCompare(a.testedAt || a.createdAt || '')));
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取检测报告失败');
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setEditing(null);
    setForm(emptyForm());
  }

  function startEdit(report: TestReport) {
    setEditing(report);
    setForm({
      code: report.code || '',
      reportNo: report.reportNo || '',
      productName: report.productName || '',
      batchNo: report.batchNo || '',
      bloodType: report.bloodType || '',
      collectedAt: report.collectedAt || '',
      testedAt: report.testedAt || '',
      validUntil: report.validUntil || '',
      storage: report.storage || '',
      transport: report.transport || '',
      conclusion: report.conclusion || '',
      internalNote: (report as any).internalNote || '',
      orderId: (report as any).orderId || '',
      status: report.status || 'draft',
    });
  }

  async function handleSubmit() {
    if (!form.code.trim()) { setError('血包编号必填'); return; }
    setSubmitting(true);
    setError('');
    const op = {
      operatorId: user?.id || 'admin_001',
      operatorName: user?.realName || user?.username || '后台管理员',
    };
    try {
      if (editing) {
        const result = await manageTestReport({
          action: 'updateReport', reportId: editing.id, ...form, ...op,
        });
        if (!result.success) throw new Error(result.error || '更新失败');
        await writeAdminLog({ operator: user, action: 'update_report', target: editing.id, detail: `更新检测报告 ${form.code}` });
      } else {
        const result = await manageTestReport({
          action: 'createReport', ...form, ...op,
        });
        if (!result.success) throw new Error(result.error || '创建失败');
        await writeAdminLog({ operator: user, action: 'create_report', target: form.code, detail: `创建检测报告 ${form.code}` });
      }
      setEditing(null);
      await loadReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(report: TestReport) {
    if (!confirm(`确定删除血包编号 ${report.code} 的检测报告？`)) return;
    const op = { operatorId: user?.id || 'admin_001', operatorName: user?.realName || user?.username || '后台管理员' };
    try {
      const result = await manageTestReport({ action: 'deleteReport', reportId: report.id, ...op });
      if (!result.success) throw new Error(result.error || '删除失败');
      await loadReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  const filtered = reports.filter(r =>
    !search || r.code?.includes(search) || r.productName?.includes(search) || r.batchNo?.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">检测报告管理</h1>
        <Button onClick={startCreate}>新建报告</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">总计</p><p className="text-2xl font-bold">{reports.length} 份</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">已发布</p><p className="text-2xl font-bold">{reports.filter(r => r.status === 'published').length} 份</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">草稿</p><p className="text-2xl font-bold">{reports.filter(r => r.status === 'draft').length} 份</p></CardContent></Card>
      </div>

      <Input placeholder="搜索血包编号 / 商品名 / 批次号" value={search} onChange={e => setSearch(e.target.value)} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>血包编号</TableHead>
                <TableHead>商品名</TableHead>
                <TableHead>血型</TableHead>
                <TableHead>批次号</TableHead>
                <TableHead>检测日期</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(report => (
                <TableRow key={report.id}>
                  <TableCell className="font-mono text-sm">{report.code}</TableCell>
                  <TableCell>{report.productName || '-'}</TableCell>
                  <TableCell>{report.bloodType || '-'}</TableCell>
                  <TableCell className="text-sm">{report.batchNo || '-'}</TableCell>
                  <TableCell className="text-sm">{report.testedAt || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={report.status === 'published' ? 'default' : 'outline'}>
                      {report.status === 'published' ? '已发布' : '草稿'}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(report)}>编辑</Button>
                    {report.status === 'draft' && (
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(report)}>删除</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">暂无检测报告</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editing !== null || form.code !== ''} onOpenChange={() => { setEditing(null); setForm(emptyForm()); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑检测报告' : '新建检测报告'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>血包编号 *</Label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} disabled={!!editing} placeholder="唯一编号" />
              </div>
              <div className="space-y-2">
                <Label>报告编号</Label>
                <Input value={form.reportNo} onChange={e => setForm(f => ({ ...f, reportNo: e.target.value }))} placeholder="自动生成或手动填写" />
              </div>
              <div className="space-y-2">
                <Label>商品名称</Label>
                <Input value={form.productName} onChange={e => setForm(f => ({ ...f, productName: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>批次号</Label>
                <Input value={form.batchNo} onChange={e => setForm(f => ({ ...f, batchNo: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>血型</Label>
                <select className="w-full rounded-md border px-2 py-1.5 text-sm" value={form.bloodType} onChange={e => setForm(f => ({ ...f, bloodType: e.target.value }))}>
                  <option value="">选择...</option>
                  <option value="A型">A型</option>
                  <option value="B型">B型</option>
                  <option value="AB型">AB型</option>
                  <option value="O型">O型</option>
                  <option value="按商品标注">按商品标注</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>关联订单 ID</Label>
                <Input value={form.orderId} onChange={e => setForm(f => ({ ...f, orderId: e.target.value }))} placeholder="可选" />
              </div>
              <div className="space-y-2">
                <Label>采集日期</Label>
                <Input type="date" value={form.collectedAt} onChange={e => setForm(f => ({ ...f, collectedAt: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>检测日期</Label>
                <Input type="date" value={form.testedAt} onChange={e => setForm(f => ({ ...f, testedAt: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>有效期至</Label>
                <Input type="date" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>状态</Label>
                <select className="w-full rounded-md border px-2 py-1.5 text-sm" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="draft">草稿</option>
                  <option value="published">发布</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>储存条件</Label>
              <Input value={form.storage} onChange={e => setForm(f => ({ ...f, storage: e.target.value }))} placeholder="如 2-8°C 冷藏" />
            </div>
            <div className="space-y-2">
              <Label>运输要求</Label>
              <Input value={form.transport} onChange={e => setForm(f => ({ ...f, transport: e.target.value }))} placeholder="如 冷链运输" />
            </div>
            <div className="space-y-2">
              <Label>检测结论</Label>
              <textarea className="w-full rounded-md border px-3 py-2 text-sm" rows={2} value={form.conclusion} onChange={e => setForm(f => ({ ...f, conclusion: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>内部备注</Label>
              <textarea className="w-full rounded-md border px-3 py-2 text-sm" rows={2} value={form.internalNote} onChange={e => setForm(f => ({ ...f, internalNote: e.target.value }))} placeholder="仅管理员可见" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 px-1">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setForm(emptyForm()); }}>取消</Button>
            <Button onClick={handleSubmit} disabled={submitting}>{submitting ? '提交中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
