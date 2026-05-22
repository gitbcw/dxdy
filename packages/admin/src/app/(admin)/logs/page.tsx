'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { fetchLogs } from '@/lib/services/database';
import { formatDateTime } from '@/lib/format';
import type { OperationLog } from '@/lib/types';

export default function LogsPage() {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [filterOperator, setFilterOperator] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [filterResult, setFilterResult] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState<OperationLog | null>(null);

  useEffect(() => {
    async function loadLogs() {
      setLoading(true);
      setError('');
      try {
        const data = await fetchLogs();
        setLogs(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '读取操作日志失败');
      } finally {
        setLoading(false);
      }
    }

    loadLogs();
  }, []);

  const operators = useMemo(() => [...new Set(logs.map(l => l.operatorName).filter(Boolean))], [logs]);
  const actions = useMemo(() => [...new Set(logs.map(l => l.action).filter(Boolean))], [logs]);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (filterOperator !== 'all' && l.operatorName !== filterOperator) return false;
      if (filterAction !== 'all' && l.action !== filterAction) return false;
      if (filterResult !== 'all' && l.result !== filterResult) return false;
      if (dateFrom && l.createdAt < dateFrom) return false;
      if (dateTo && l.createdAt > dateTo + 'T23:59:59') return false;
      return true;
    });
  }, [logs, filterOperator, filterAction, filterResult, dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">操作日志</h1>
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Select value={filterOperator} onValueChange={v => setFilterOperator(v ?? 'all')}>
          <SelectTrigger className="w-40"><SelectValue>{filterOperator === 'all' ? '全部操作人' : filterOperator}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部操作人</SelectItem>
            {operators.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAction} onValueChange={v => setFilterAction(v ?? 'all')}>
          <SelectTrigger className="w-40"><SelectValue>{filterAction === 'all' ? '全部操作' : filterAction}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部操作</SelectItem>
            {actions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterResult} onValueChange={v => setFilterResult(v ?? 'all')}>
          <SelectTrigger className="w-32"><SelectValue>{filterResult === 'all' ? '全部结果' : filterResult === 'success' ? '成功' : '失败'}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部结果</SelectItem>
            <SelectItem value="success">成功</SelectItem>
            <SelectItem value="failure">失败</SelectItem>
          </SelectContent>
        </Select>
        <input type="date" className="h-9 rounded-md border px-2 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="开始日期" />
        <input type="date" className="h-9 rounded-md border px-2 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} title="结束日期" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>操作人</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>操作</TableHead>
                <TableHead>目标</TableHead>
                <TableHead>结果</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">加载日志中...</TableCell>
                </TableRow>
              )}
              {!loading && filtered.map(log => (
                <TableRow
                  key={log.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedLog(log)}
                >
                  <TableCell className="text-sm text-muted-foreground">{formatDateTime(log.createdAt)}</TableCell>
                  <TableCell>{log.operatorName}</TableCell>
                  <TableCell><Badge variant="secondary">{log.operatorRole}</Badge></TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell className="max-w-48 truncate">{log.target}</TableCell>
                  <TableCell>
                    <Badge variant={log.result === 'success' ? 'default' : 'destructive'}>
                      {log.result === 'success' ? '成功' : '失败'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">暂无匹配日志</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={open => !open && setSelectedLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>日志详情</DialogTitle>
            <DialogDescription>查看单条后台操作的审计信息</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2">
                <span className="text-muted-foreground">时间</span>
                <span>{formatDateTime(selectedLog.createdAt)}</span>
                <span className="text-muted-foreground">操作人</span>
                <span>{selectedLog.operatorName}（{selectedLog.operatorRole}）</span>
                <span className="text-muted-foreground">操作</span>
                <span>{selectedLog.action}</span>
                <span className="text-muted-foreground">目标</span>
                <span className="break-all">{selectedLog.target}</span>
                <span className="text-muted-foreground">结果</span>
                <span>{selectedLog.result === 'success' ? '成功' : '失败'}</span>
              </div>
              <div className="rounded-md border bg-muted/40 p-3 leading-6">
                {selectedLog.detail || '无详情'}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
