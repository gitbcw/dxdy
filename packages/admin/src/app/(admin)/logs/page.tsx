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
import { getOperationLogs } from '@dxdy/shared';
import { formatDateTime } from '@dxdy/shared';
import type { OperationLog } from '@dxdy/shared';

export default function LogsPage() {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [filterOperator, setFilterOperator] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [filterResult, setFilterResult] = useState('all');

  useEffect(() => {
    getOperationLogs().then(setLogs);
  }, []);

  const operators = useMemo(() => [...new Set(logs.map(l => l.operatorName))], [logs]);
  const actions = useMemo(() => [...new Set(logs.map(l => l.action))], [logs]);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (filterOperator !== 'all' && l.operatorName !== filterOperator) return false;
      if (filterAction !== 'all' && l.action !== filterAction) return false;
      if (filterResult !== 'all' && l.result !== filterResult) return false;
      return true;
    });
  }, [logs, filterOperator, filterAction, filterResult]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">操作日志</h1>

      <div className="flex gap-3">
        <Select value={filterOperator} onValueChange={v => setFilterOperator(v ?? 'all')}>
          <SelectTrigger className="w-40"><SelectValue placeholder="操作人" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部操作人</SelectItem>
            {operators.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAction} onValueChange={v => setFilterAction(v ?? 'all')}>
          <SelectTrigger className="w-40"><SelectValue placeholder="操作类型" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部操作</SelectItem>
            {actions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterResult} onValueChange={v => setFilterResult(v ?? 'all')}>
          <SelectTrigger className="w-32"><SelectValue placeholder="结果" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部结果</SelectItem>
            <SelectItem value="success">成功</SelectItem>
            <SelectItem value="failure">失败</SelectItem>
          </SelectContent>
        </Select>
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
              {filtered.map(log => (
                <TableRow key={log.id}>
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
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">暂无匹配日志</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
