'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { fetchLogs, fetchProductsAndCategories, fetchUsers } from '@/lib/services/database';
import { formatDateTime } from '@/lib/format';
import type { OperationLog, Product, ProductCategory } from '@/lib/types';

function DateFilterInput({
  title,
  placeholder,
  value,
  onChange,
}: {
  title: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    if (typeof input.showPicker === 'function') {
      input.showPicker();
    } else {
      input.click();
    }
  }

  return (
    <button
      type="button"
      className="relative flex h-8 w-44 items-center rounded-lg border border-input bg-background px-2.5 text-left text-sm"
      onClick={openPicker}
    >
      <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
        {value || placeholder}
      </span>
      <CalendarDays className="ml-auto size-4 text-muted-foreground" />
      <input
        ref={inputRef}
        type="date"
        className="pointer-events-none absolute inset-0 opacity-0"
        value={value}
        onChange={event => onChange(event.target.value)}
        title={title}
        tabIndex={-1}
      />
    </button>
  );
}

const actionLabels: Record<string, string> = {
  login: '登录',
  logout: '退出登录',
  create_product: '创建商品',
  update_product: '更新商品',
  update_product_status: '更新商品状态',
  updateProductStatus: '更新商品状态',
  delete_product: '删除商品',
  deleteProduct: '删除商品',
  create_category: '创建商品分类',
  update_category: '更新商品分类',
  delete_category: '删除商品分类',
  approve_return: '退换货审核通过',
  reject_return: '退换货审核拒绝',
  advance_return: '推进退换货状态',
  save_system_config: '保存系统配置',
  update_role_permissions: '更新角色权限',
  create_account: '创建账号',
  update_account: '更新账号',
  delete_account: '删除账号',
  toggle_account_status: '切换账号状态',
  withdrawal_approved: '提现审核通过',
  withdrawal_rejected: '提现审核驳回',
  withdrawal_paid: '确认提现打款',
  invoice_issued: '发票开具',
  invoice_rejected: '发票驳回',
  verification_approve: '认证审核通过',
  verification_reject: '认证审核拒绝',
  agent_approve: '代理商审核通过',
  agent_reject: '代理商审核拒绝',
  create_report: '创建检测报告',
  update_report: '更新检测报告',
  delete_report: '删除检测报告',
  void_card_voucher: '作废卡券',
  gift_card: '赠送卡券',
  claim_card: '认领卡券',
  regift_card: '转赠卡券',
  redeem_card: '兑换卡券',
  void_card: '作废卡券',
};

function getActionLabel(action: string) {
  return actionLabels[action] ?? action;
}

const statusLabels: Record<string, string> = {
  on_sale: '已上架',
  off_sale: '已下架',
  pending: '待处理',
  approved: '已通过',
  rejected: '已拒绝',
  paid: '已打款',
  success: '成功',
  failure: '失败',
  disabled: '已禁用',
  active: '已启用',
};

function getStatusLabel(status: string) {
  return statusLabels[status] ?? status;
}

const roleLabels: Record<string, string> = {
  service: '客服',
  product_manager: '商品管理员',
  clerk: '制单员',
  system_admin: '系统管理员',
  unknown: '未知角色',
};

const targetLabels: Record<string, string> = {
  system: '系统配置',
  service: '客服',
  product_manager: '商品管理员',
  system_admin: '系统管理员',
  seed_prod_card: '卡券测试商品',
  seed_prod_supply: '宠物处方药',
  seed_prod_blood_a: '宠物血液制品 A',
  seed_prod_blood_b: '宠物血液制品 B',
};

function getRoleLabel(role: string) {
  return roleLabels[role] ?? role;
}

function getTargetLabel(log: OperationLog, targetNameMap: Record<string, string>) {
  const mapped = targetNameMap[log.target] || targetLabels[log.target];
  if (mapped) return mapped;

  const detail = log.detail || '';
  const patterns = [
    /^创建商品\s+(.+)$/,
    /^更新商品分类\s+(.+)$/,
    /^创建商品分类\s+(.+)$/,
    /^删除商品分类\s+(.+)$/,
    /^管理员\s+(.+)\s+登录$/,
    /^管理员\s+(.+)\s+登出$/,
    /^创建账号\s+(.+)$/,
    /^更新账号\s+(.+)$/,
    /^账号\s+(.+)\s+状态变更/,
    /^创建检测报告\s+(.+)$/,
    /^更新检测报告\s+(.+)$/,
  ];
  for (const pattern of patterns) {
    const match = detail.match(pattern);
    if (match?.[1]) return match[1];
  }
  return log.target;
}

function getUserTargetName(user: Record<string, unknown>) {
  const verificationInfo = user.verificationInfo && typeof user.verificationInfo === 'object'
    ? user.verificationInfo as Record<string, unknown>
    : {};
  const agentApplication = user.agentApplication && typeof user.agentApplication === 'object'
    ? user.agentApplication as Record<string, unknown>
    : {};
  const addresses = Array.isArray(user.addresses) ? user.addresses as Array<Record<string, unknown>> : [];
  const defaultAddress = addresses.find(address => address.isDefault) || addresses[0];

  return String(
    verificationInfo.hospitalName ||
    agentApplication.companyName ||
    user.hospitalName ||
    user.companyName ||
    user.nickname ||
    user.realName ||
    defaultAddress?.name ||
    verificationInfo.contactName ||
    agentApplication.realName ||
    user.phone ||
    user.username ||
    user.id ||
    '',
  );
}

function getDetailLabel(log: OperationLog, targetNameMap: Record<string, string>) {
  const detail = log.detail || '';
  if (!detail) return '无详情';

  const productStatusMatch = detail.match(/^Update product (.+) status to ([\w-]+)$/);
  if (productStatusMatch) {
    const targetName = targetNameMap[log.target] || productStatusMatch[1];
    return `更新商品 ${targetName} 状态为${getStatusLabel(productStatusMatch[2])}`;
  }

  const deleteProductMatch = detail.match(/^Delete product (.+)$/);
  if (deleteProductMatch) {
    const targetName = targetNameMap[log.target] || deleteProductMatch[1];
    return `删除商品 ${targetName}`;
  }

  return detail.replace(/\b(on_sale|off_sale|pending|approved|rejected|paid|success|failure|disabled|active)\b/g, value => getStatusLabel(value));
}

export default function LogsPage() {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [targetNameMap, setTargetNameMap] = useState<Record<string, string>>({});
  const [filterOperator, setFilterOperator] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [filterResult, setFilterResult] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState<OperationLog | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    async function loadLogs() {
      setLoading(true);
      setError('');
      try {
        const [data, productData, usersData] = await Promise.all([
          fetchLogs(),
          fetchProductsAndCategories().catch(() => ({ products: [], categories: [] })),
          fetchUsers().catch(() => ({ customers: [], salespersons: [], agentApplications: [], clerks: [] })),
        ]);
        const names: Record<string, string> = {};
        productData.products.forEach((product: Product) => {
          names[product.id] = product.name;
        });
        productData.categories.forEach((category: ProductCategory) => {
          names[category.id] = category.name;
        });
        [
          ...usersData.customers,
          ...usersData.salespersons,
          ...usersData.agentApplications,
          ...usersData.clerks,
        ].forEach(user => {
          const name = getUserTargetName(user as Record<string, unknown>);
          if (user.id && name) names[user.id] = name;
        });
        setTargetNameMap(names);
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  function resetToFirstPage() {
    setPage(1);
  }

  function clearFilters() {
    setFilterOperator('all');
    setFilterAction('all');
    setFilterResult('all');
    setDateFrom('');
    setDateTo('');
    resetToFirstPage();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">操作日志</h1>
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Select value={filterOperator} onValueChange={v => { setFilterOperator(v ?? 'all'); resetToFirstPage(); }}>
          <SelectTrigger className="w-40"><SelectValue>{filterOperator === 'all' ? '全部操作人' : filterOperator}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部操作人</SelectItem>
            {operators.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAction} onValueChange={v => { setFilterAction(v ?? 'all'); resetToFirstPage(); }}>
          <SelectTrigger className="w-40"><SelectValue>{filterAction === 'all' ? '全部操作' : getActionLabel(filterAction)}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部操作</SelectItem>
            {actions.map(a => <SelectItem key={a} value={a}>{getActionLabel(a)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterResult} onValueChange={v => { setFilterResult(v ?? 'all'); resetToFirstPage(); }}>
          <SelectTrigger className="w-32"><SelectValue>{filterResult === 'all' ? '全部结果' : filterResult === 'success' ? '成功' : '失败'}</SelectValue></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部结果</SelectItem>
            <SelectItem value="success">成功</SelectItem>
            <SelectItem value="failure">失败</SelectItem>
          </SelectContent>
        </Select>
        <DateFilterInput title="开始日期" placeholder="开始时间" value={dateFrom} onChange={value => { setDateFrom(value); resetToFirstPage(); }} />
        <DateFilterInput title="结束日期" placeholder="结束时间" value={dateTo} onChange={value => { setDateTo(value); resetToFirstPage(); }} />
        <Button type="button" variant="outline" onClick={clearFilters}>
          清空筛选
        </Button>
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
              {!loading && pagedLogs.map(log => (
                <TableRow
                  key={log.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedLog(log)}
                >
                  <TableCell className="text-sm text-muted-foreground">{formatDateTime(log.createdAt)}</TableCell>
                  <TableCell>{log.operatorName}</TableCell>
                  <TableCell><Badge variant="secondary">{getRoleLabel(log.operatorRole)}</Badge></TableCell>
                  <TableCell>{getActionLabel(log.action)}</TableCell>
                  <TableCell className="max-w-48 truncate">{getTargetLabel(log, targetNameMap)}</TableCell>
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
          <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              第 <span className="font-medium text-foreground">{currentPage}</span> / <span className="font-medium text-foreground">{totalPages}</span> 页，
              每页 <span className="font-medium text-foreground">{pageSize}</span> 条，
              筛选结果 <span className="font-medium text-foreground">{filtered.length}</span> 条，
              日志总数 <span className="font-medium text-foreground">{logs.length}</span> 条
            </p>
            <div className="flex gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={value => {
                  setPageSize(parseInt(value ?? '10', 10));
                  resetToFirstPage();
                }}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / 页</SelectItem>
                  <SelectItem value="20">20 / 页</SelectItem>
                  <SelectItem value="50">50 / 页</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
              >
                下一页
              </Button>
            </div>
          </div>
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
                <span>{selectedLog.operatorName}（{getRoleLabel(selectedLog.operatorRole)}）</span>
                <span className="text-muted-foreground">操作</span>
                <span>{getActionLabel(selectedLog.action)}</span>
                <span className="text-muted-foreground">目标</span>
                <span className="break-all">{getTargetLabel(selectedLog, targetNameMap)}</span>
                <span className="text-muted-foreground">结果</span>
                <span>{selectedLog.result === 'success' ? '成功' : '失败'}</span>
              </div>
              <div className="rounded-md border bg-muted/40 p-3 leading-6">
                {getDetailLabel(selectedLog, targetNameMap)}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
