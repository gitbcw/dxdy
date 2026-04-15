'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { getOperationLogs } from '@dxdy/shared';
import { formatDateTime } from '@dxdy/shared';
import type { OperationLog } from '@dxdy/shared';

export default function LogsPage() {
  const [logs, setLogs] = useState<OperationLog[]>([]);

  useEffect(() => {
    getOperationLogs().then(setLogs);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">操作日志</h1>

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
              {logs.map(log => (
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
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
