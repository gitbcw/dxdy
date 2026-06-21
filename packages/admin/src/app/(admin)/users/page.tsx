'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { fetchUsers } from '@/lib/services/database';
import { reviewVerification, reviewAgentApplication } from '@/lib/services/functions';
import { writeAdminLog } from '@/lib/admin-log';
import { formatDate } from '@/lib/format';
import type { Customer, Salesperson } from '@/lib/types';

type AgentApplicationUser = Customer & {
  agentStatus?: string;
  agentApplication?: {
    companyName?: string;
    contactName?: string;
    contactPhone?: string;
    region?: string;
    businessArea?: string;
    submittedAt?: string;
  };
};

type DetailUser = Customer | Salesperson | AgentApplicationUser;

export default function UsersPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salespersons, setSalespersons] = useState<Salesperson[]>([]);
  const [agentApplications, setAgentApplications] = useState<AgentApplicationUser[]>([]);
  const [customerPageSize, setCustomerPageSize] = useState(10);
  const [personalCustomerPage, setPersonalCustomerPage] = useState(1);
  const [institutionCustomerPage, setInstitutionCustomerPage] = useState(1);
  const [agentPage, setAgentPage] = useState(1);
  const [agentPageSize, setAgentPageSize] = useState(10);
  const [salespersonPage, setSalespersonPage] = useState(1);
  const [salespersonPageSize, setSalespersonPageSize] = useState(10);
  const [detailUser, setDetailUser] = useState<DetailUser | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ type: 'verification' | 'agent'; user: Customer | Salesperson } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError('');
    try {
      const data = await fetchUsers();
      setCustomers(data.customers || []);
      setSalespersons(data.salespersons);
      setAgentApplications(data.agentApplications as AgentApplicationUser[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '用户数据加载失败');
    } finally {
      setLoading(false);
    }
  }

  const verifyLabel: Record<string, string> = {
    none: '未认证',
    pending: '待审核',
    approved: '已通过',
    rejected: '已拒绝',
  };
  const verifyVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    none: 'secondary',
    pending: 'outline',
    approved: 'default',
    rejected: 'destructive',
  };

  const personalCustomers = customers.filter(customer => customer.customerType === 'personal');
  const institutionCustomers = customers.filter(customer => customer.customerType === 'institution');
  const personalCustomerTotalPages = Math.max(1, Math.ceil(personalCustomers.length / customerPageSize));
  const institutionCustomerTotalPages = Math.max(1, Math.ceil(institutionCustomers.length / customerPageSize));
  const agentTotalPages = Math.max(1, Math.ceil(agentApplications.length / agentPageSize));
  const salespersonTotalPages = Math.max(1, Math.ceil(salespersons.length / salespersonPageSize));
  const pagedPersonalCustomers = personalCustomers.slice((personalCustomerPage - 1) * customerPageSize, personalCustomerPage * customerPageSize);
  const pagedInstitutionCustomers = institutionCustomers.slice((institutionCustomerPage - 1) * customerPageSize, institutionCustomerPage * customerPageSize);
  const pagedAgentApplications = agentApplications.slice((agentPage - 1) * agentPageSize, agentPage * agentPageSize);
  const pagedSalespersons = salespersons.slice((salespersonPage - 1) * salespersonPageSize, salespersonPage * salespersonPageSize);

  useEffect(() => {
    setPersonalCustomerPage(page => Math.min(page, personalCustomerTotalPages));
  }, [personalCustomerTotalPages]);

  useEffect(() => {
    setInstitutionCustomerPage(page => Math.min(page, institutionCustomerTotalPages));
  }, [institutionCustomerTotalPages]);

  useEffect(() => {
    setAgentPage(page => Math.min(page, agentTotalPages));
  }, [agentTotalPages]);

  useEffect(() => {
    setSalespersonPage(page => Math.min(page, salespersonTotalPages));
  }, [salespersonTotalPages]);

  function renderPaginationBar(params: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    total: number;
    totalLabel: string;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  }) {
    return (
      <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          第 <span className="font-medium text-foreground">{params.currentPage}</span> / <span className="font-medium text-foreground">{params.totalPages}</span> 页，
          每页 <span className="font-medium text-foreground">{params.pageSize}</span> 条，
          {params.totalLabel} <span className="font-medium text-foreground">{params.total}</span> 条
        </p>
        <div className="flex gap-2">
          <Select
            value={String(params.pageSize)}
            onValueChange={value => {
              params.onPageSizeChange(parseInt(value ?? '10', 10));
              params.onPageChange(1);
            }}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => params.onPageChange(Math.max(1, params.currentPage - 1))}
            disabled={params.currentPage <= 1}
          >
            上一页
          </Button>
          <Button
            variant="outline"
            onClick={() => params.onPageChange(Math.min(params.totalPages, params.currentPage + 1))}
            disabled={params.currentPage >= params.totalPages}
          >
            下一页
          </Button>
        </div>
      </div>
    );
  }

  async function handleReview(approved: boolean) {
    if (!reviewTarget) return;
    setError('');
    const op = {
      operatorId: user?.id || 'admin_001',
      operatorName: user?.realName || user?.username || '后台管理员',
    };
    try {
      const params = {
        userId: reviewTarget.user.id,
        approved,
        rejectReason: approved ? '' : rejectReason,
        ...op,
      };
      const result = reviewTarget.type === 'verification'
        ? await reviewVerification(params)
        : await reviewAgentApplication(params);
      if (!result.success) throw new Error(result.error || '审核失败');
      await writeAdminLog({ operator: user, action: `${reviewTarget.type}_${approved ? 'approve' : 'reject'}`, target: reviewTarget.user.id, detail: `${reviewTarget.type === 'verification' ? '认证' : '代理商'}审核: ${approved ? '通过' : '拒绝'}` });
      await loadUsers();
      setReviewTarget(null);
      setRejectReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '审核失败');
    }
  }

  function detailValue(value: unknown) {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? '是' : '否';
    return String(value);
  }

  function DetailRow({ label, value }: { label: string; value: unknown }) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words text-sm">{detailValue(value)}</p>
      </div>
    );
  }

  function VerificationImage({ label, src }: { label: string; src?: string }) {
    if (!src) return <DetailRow label={label} value="-" />;
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <a href={src} target="_blank" rel="noreferrer" className="block rounded-md border bg-muted/20 p-2">
          <img src={src} alt={label} className="h-40 w-full rounded object-contain" />
        </a>
      </div>
    );
  }

  function renderVerificationInfoBlock(verificationInfo: Customer['verificationInfo'] | Salesperson['verificationInfo']) {
    const isCustomerInfo = !!verificationInfo && ('contactName' in verificationInfo || 'hospitalName' in verificationInfo || 'businessLicense' in verificationInfo);
    if (!isCustomerInfo) {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <DetailRow label="真实姓名" value={verificationInfo?.realName} />
          <DetailRow label="身份证号" value={verificationInfo?.idCard} />
          <DetailRow label="驳回原因" value={verificationInfo?.rejectReason} />
        </div>
      );
    }

    const info = verificationInfo as Customer['verificationInfo'];
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <DetailRow label="门店名称" value={info?.hospitalName} />
          <DetailRow label="法人名称" value={info?.legalPerson} />
          <DetailRow label="联系人姓名" value={info?.contactName} />
          <DetailRow label="联系电话" value={info?.contactPhone} />
          <DetailRow label="所在地区" value={info?.region} />
          <DetailRow label="详细地址" value={info?.address} />
          <DetailRow label="提交时间" value={info?.submittedAt} />
          <DetailRow label="审核时间" value={info?.reviewedAt} />
          <DetailRow label="审核人" value={info?.reviewerName} />
          <DetailRow label="驳回原因" value={info?.rejectReason} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <VerificationImage label="营业执照" src={info?.businessLicenseUrl || info?.businessLicense} />
          <VerificationImage label="经营场所照片" src={info?.sitePhotoUrl || info?.sitePhoto} />
        </div>
      </div>
    );
  }

  function renderUserDetail(target: DetailUser) {
    const customer = target as Customer;
    const salesperson = target as Salesperson;
    const agent = target as AgentApplicationUser;
    const verificationInfo = customer.verificationInfo || salesperson.verificationInfo;
    const agentApplication = agent.agentApplication;
    const commission = salesperson.commission;
    const role = String(target.role);
    const roleText = role === 'customer'
      ? customer.customerType === 'personal'
        ? '个人客户'
        : '医院客户'
      : role === 'salesperson'
        ? '代理商'
        : role;

    return (
      <div className="max-h-[70vh] space-y-6 overflow-y-auto py-2">
        <div className="grid gap-4 md:grid-cols-2">
          <DetailRow label="用户ID" value={target.id} />
          <DetailRow label="角色" value={roleText} />
          <DetailRow label="昵称" value={target.nickname} />
          <DetailRow label="手机号" value={target.phone} />
          <DetailRow label="注册时间" value={target.createdAt ? formatDate(target.createdAt) : '-'} />
          <DetailRow label="认证状态" value={verifyLabel[target.verificationStatus] || target.verificationStatus} />
        </div>

        {'customerType' in target && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">客户信息</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <DetailRow label="客户类型" value={target.customerType === 'personal' ? '个人' : '医院'} />
              <DetailRow label="钱包余额" value={target.wallet?.balance !== undefined ? `¥${target.wallet.balance.toFixed(2)}` : '-'} />
              <DetailRow label="积分余额" value={target.points?.balance ?? '-'} />
              <DetailRow label="推荐码" value={target.referralCode} />
              <DetailRow label="推荐人" value={target.referredBy} />
              <DetailRow label="推荐时间" value={target.referredAt} />
              <DetailRow label="绑定业务员ID" value={target.boundSalespersonId} />
              <DetailRow label="地址数量" value={target.addresses?.length || 0} />
            </div>
          </div>
        )}

        {verificationInfo && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">认证信息</h3>
            {renderVerificationInfoBlock(verificationInfo)}
          </div>
        )}

        {agentApplication && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">代理申请信息</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <DetailRow label="申请主体" value={agentApplication.companyName} />
              <DetailRow label="联系人" value={agentApplication.contactName} />
              <DetailRow label="联系电话" value={agentApplication.contactPhone} />
              <DetailRow label="区域" value={agentApplication.region} />
              <DetailRow label="业务覆盖" value={agentApplication.businessArea} />
              <DetailRow label="提交时间" value={agentApplication.submittedAt} />
              <DetailRow label="申请状态" value={agent.agentStatus} />
            </div>
          </div>
        )}

        {target.role === 'salesperson' && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">代理商信息</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <DetailRow label="客户数" value={salesperson.customers?.length || 0} />
              <DetailRow label="累计提成" value={commission ? `¥${commission.total.toFixed(2)}` : '-'} />
              <DetailRow label="可用提成" value={commission ? `¥${commission.available.toFixed(2)}` : '-'} />
              <DetailRow label="已提现" value={commission ? `¥${commission.withdrawn.toFixed(2)}` : '-'} />
              <DetailRow label="待扣回" value={commission ? `¥${commission.pendingDeduction.toFixed(2)}` : '-'} />
              <DetailRow label="银行卡数量" value={salesperson.bankCards?.length || 0} />
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderCustomerTable(params: {
    rows: Customer[];
    currentPage: number;
    totalPages: number;
    total: number;
    totalLabel: string;
    onPageChange: (page: number) => void;
  }) {
    return (
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>昵称</TableHead>
                <TableHead>手机</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>认证</TableHead>
                <TableHead>余额</TableHead>
                <TableHead>推荐码</TableHead>
                <TableHead>推荐人</TableHead>
                <TableHead>注册时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">正在读取 CloudBase 用户...</TableCell>
                </TableRow>
              )}
              {!loading && params.rows.map(c => (
                <TableRow key={c.id}>
                  <TableCell>{c.nickname}</TableCell>
                  <TableCell>{c.phone || '-'}</TableCell>
                  <TableCell>{c.customerType === 'personal' ? '个人客户' : '医院客户'}</TableCell>
                  <TableCell>
                    <Badge variant={verifyVariant[c.verificationStatus]}>{verifyLabel[c.verificationStatus]}</Badge>
                  </TableCell>
                  <TableCell>¥{(c.wallet?.balance || 0).toFixed(2)}</TableCell>
                  <TableCell className="font-mono text-xs">{c.referralCode || '-'}</TableCell>
                  <TableCell className="text-xs">{c.referredBy || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.createdAt ? formatDate(c.createdAt) : '-'}</TableCell>
                  <TableCell className="space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setDetailUser(c)}>详情</Button>
                    {c.customerType === 'institution' && c.verificationStatus === 'pending' && (
                      <Button variant="outline" size="sm" onClick={() => setReviewTarget({ type: 'verification', user: c })}>审核</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && params.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">暂无客户</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {renderPaginationBar({
            currentPage: params.currentPage,
            totalPages: params.totalPages,
            pageSize: customerPageSize,
            total: params.total,
            totalLabel: params.totalLabel,
            onPageChange: params.onPageChange,
            onPageSizeChange: pageSize => {
              setCustomerPageSize(pageSize);
              setPersonalCustomerPage(1);
              setInstitutionCustomerPage(1);
            },
          })}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">用户管理</h1>
      {error && <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

      <Tabs defaultValue="customers">
        <TabsList>
          <TabsTrigger value="customers">客户 ({customers.length})</TabsTrigger>
          <TabsTrigger value="agents">代理审核 ({agentApplications.length})</TabsTrigger>
          <TabsTrigger value="salespersons">代理商 ({salespersons.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="customers">
          <Tabs defaultValue="personal">
            <TabsList>
              <TabsTrigger value="personal">个人客户 ({personalCustomers.length})</TabsTrigger>
              <TabsTrigger value="institution">医院客户 ({institutionCustomers.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="personal">
              {renderCustomerTable({
                rows: pagedPersonalCustomers,
                currentPage: personalCustomerPage,
                totalPages: personalCustomerTotalPages,
                total: personalCustomers.length,
                totalLabel: "个人客户总数",
                onPageChange: setPersonalCustomerPage,
              })}
            </TabsContent>
            <TabsContent value="institution">
              {renderCustomerTable({
                rows: pagedInstitutionCustomers,
                currentPage: institutionCustomerPage,
                totalPages: institutionCustomerTotalPages,
                total: institutionCustomers.length,
                totalLabel: "医院客户总数",
                onPageChange: setInstitutionCustomerPage,
              })}
            </TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="agents">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>申请主体</TableHead>
                    <TableHead>联系人</TableHead>
                    <TableHead>手机</TableHead>
                    <TableHead>区域</TableHead>
                    <TableHead>业务覆盖</TableHead>
                    <TableHead>提交时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">正在读取 CloudBase 代理商申请...</TableCell>
                    </TableRow>
                  )}
                  {!loading && pagedAgentApplications.map(user => {
                    const app = user.agentApplication || {};
                    return (
                      <TableRow key={user.id}>
                        <TableCell>{app.companyName || user.nickname}</TableCell>
                        <TableCell>{app.contactName || user.nickname}</TableCell>
                        <TableCell>{app.contactPhone || user.phone || '-'}</TableCell>
                        <TableCell>{app.region || '-'}</TableCell>
                        <TableCell className="max-w-56 truncate">{app.businessArea || '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{app.submittedAt || '-'}</TableCell>
                        <TableCell className="space-x-2">
                          <Button variant="outline" size="sm" onClick={() => setDetailUser(user)}>详情</Button>
                          <Button variant="outline" size="sm" onClick={() => setReviewTarget({ type: 'agent', user })}>审核</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!loading && agentApplications.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">暂无待审核代理商申请</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {renderPaginationBar({
                currentPage: agentPage,
                totalPages: agentTotalPages,
                pageSize: agentPageSize,
                total: agentApplications.length,
                totalLabel: '代理审核总数',
                onPageChange: setAgentPage,
                onPageSizeChange: setAgentPageSize,
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salespersons">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>昵称</TableHead>
                    <TableHead>手机</TableHead>
                    <TableHead>认证</TableHead>
                    <TableHead>客户数</TableHead>
                    <TableHead>可用提成</TableHead>
                    <TableHead>注册时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedSalespersons.map(s => (
                    <TableRow key={s.id}>
                      <TableCell>{s.nickname}</TableCell>
                      <TableCell>{s.phone || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={verifyVariant[s.verificationStatus]}>{verifyLabel[s.verificationStatus]}</Badge>
                      </TableCell>
                      <TableCell>{s.customers?.length || 0}</TableCell>
                      <TableCell>¥{(s.commission?.available || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.createdAt ? formatDate(s.createdAt) : '-'}</TableCell>
                      <TableCell className="space-x-2">
                        <Button variant="outline" size="sm" onClick={() => setDetailUser(s)}>详情</Button>
                        {s.verificationStatus === 'pending' && (
                          <Button variant="outline" size="sm" onClick={() => setReviewTarget({ type: 'verification', user: s })}>审核</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {renderPaginationBar({
                currentPage: salespersonPage,
                totalPages: salespersonTotalPages,
                pageSize: salespersonPageSize,
                total: salespersons.length,
                totalLabel: '代理商总数',
                onPageChange: setSalespersonPage,
                onPageSizeChange: setSalespersonPageSize,
              })}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <Dialog open={!!detailUser} onOpenChange={() => setDetailUser(null)}>
        <DialogContent className="!w-[min(92vw,44rem)] !max-w-[min(92vw,44rem)]">
          <DialogHeader>
            <DialogTitle>用户详情</DialogTitle>
          </DialogHeader>
          {detailUser && renderUserDetail(detailUser)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailUser(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewTarget} onOpenChange={() => setReviewTarget(null)}>
        <DialogContent className="flex !max-h-[90vh] !w-[min(92vw,48rem)] !max-w-[min(92vw,48rem)] flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>
              {reviewTarget?.type === 'agent'
                ? '代理商申请审核'
                : reviewTarget?.user.role === 'salesperson'
                  ? '代理商认证审核'
                  : '医院认证审核'}
            </DialogTitle>
          </DialogHeader>
          {reviewTarget && (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
              <div>
                <p className="text-sm text-muted-foreground">用户</p>
                <p>{reviewTarget.user.nickname} ({reviewTarget.user.phone})</p>
              </div>
              {reviewTarget.type === 'verification' && reviewTarget.user.role === 'customer' && (reviewTarget.user as Customer).verificationInfo && (
                <div className="rounded-md border p-3">
                  <p className="mb-3 text-sm font-medium">门店认证资料</p>
                  {renderVerificationInfoBlock((reviewTarget.user as Customer).verificationInfo)}
                </div>
              )}
              {reviewTarget.type === 'verification' && reviewTarget.user.role === 'salesperson' && (reviewTarget.user as Salesperson).verificationInfo && (
                <div>
                  <p className="text-sm text-muted-foreground">真实姓名</p>
                  <p>{(reviewTarget.user as Salesperson).verificationInfo!.realName || reviewTarget.user.nickname}</p>
                </div>
              )}
              {reviewTarget.type === 'agent' && (
                <div>
                  <p className="text-sm text-muted-foreground">申请主体</p>
                  <p>{(reviewTarget.user as AgentApplicationUser).agentApplication?.companyName || reviewTarget.user.nickname}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="rejectReason">拒绝原因（拒绝时必填）</Label>
                <Input id="rejectReason" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="输入拒绝原因" />
              </div>
            </div>
          )}
          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
            <Button variant="destructive" onClick={() => handleReview(false)}>拒绝</Button>
            <Button onClick={() => handleReview(true)}>通过</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
