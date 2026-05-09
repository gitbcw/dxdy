'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchCommissionRecords, fetchUsers } from '@/lib/services/database';
import { formatMoney } from '@/lib/format';

type CommissionRecord = {
  id: string;
  salespersonId: string;
  salespersonName?: string;
  customerId?: string;
  orderId?: string;
  orderNo?: string;
  amount: number;
  status: string;
  sourceType?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
};

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: '待结算', variant: 'outline' },
  locked: { label: '已锁定', variant: 'secondary' },
  settled: { label: '已结算', variant: 'default' },
  deducted: { label: '已扣回', variant: 'destructive' },
};

export default function CommissionsPage() {
  const [records, setRecords] = useState<CommissionRecord[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [commissionData, usersData] = await Promise.all([
        fetchCommissionRecords(),
        fetchUsers(),
      ]);
      const map: Record<string, string> = {};
      for (const u of [...usersData.salespersons, ...usersData.customers]) {
        map[u.id] = u.nickname || u.realName || u.phone || u.id;
      }
      setNameMap(map);
      setRecords(commissionData as CommissionRecord[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取提成记录失败');
    } finally {
      setLoading(false);
    }
  }

  const filtered = records.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (!search) return true;
    const name = nameMap[r.salespersonId] || '';
    return name.includes(search) || r.orderNo?.includes(search) || r.orderId?.includes(search);
  });

  const totalPending = records.filter(r => r.status === 'pending').reduce((s, r) => s + (r.amount || 0), 0);
  const totalLocked = records.filter(r => r.status === 'locked').reduce((s, r) => s + (r.amount || 0), 0);
  const totalSettled = records.filter(r => r.status === 'settled').reduce((s, r) => s + (r.amount || 0), 0);
  const totalDeducted = records.filter(r => r.status === 'deducted').reduce((s, r) => s + (r.amount || 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">提成管理</h1>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">待结算</p><p className="text-2xl font-bold">¥{formatMoney(totalPending)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">已锁定</p><p className="text-2xl font-bold">¥{formatMoney(totalLocked)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">已结算</p><p className="text-2xl font-bold">¥{formatMoney(totalSettled)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">已扣回</p><p className="text-2xl font-bold text-red-600">¥{formatMoney(totalDeducted)}</p></CardContent></Card>
      </div>

      <div className="flex gap-4">
        <Input placeholder="搜索代理商姓名 / 订单号" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="pending">待结算</SelectItem>
            <SelectItem value="locked">已锁定</SelectItem>
            <SelectItem value="settled">已结算</SelectItem>
            <SelectItem value="deducted">已扣回</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>代理商</TableHead>
                <TableHead>订单号</TableHead>
                <TableHead>提成金额</TableHead>
                <TableHead>来源</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(record => {
                const st = statusMap[record.status] || { label: record.status, variant: 'outline' as const };
                return (
                  <TableRow key={record.id}>
                    <TableCell>{nameMap[record.salespersonId] || record.salespersonId}</TableCell>
                    <TableCell className="font-mono text-sm">{record.orderNo || record.orderId || '-'}</TableCell>
                    <TableCell className="font-semibold">¥{formatMoney(record.amount)}</TableCell>
                    <TableCell className="text-sm">{record.sourceType || '订单'}</TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{record.createdAt || '-'}</TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">暂无提成记录</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
