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
import { useAuth } from '@/hooks/use-auth';
import { fetchUsers } from '@/lib/services/database';
import { reviewVerification, reviewAgentApplication } from '@/lib/services/functions';
import { writeAdminLog } from '@/lib/admin-log';
import { maskPhone, formatDate } from '@/lib/format';
import type { Customer, Salesperson, Clerk } from '@/lib/types';

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

export default function UsersPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salespersons, setSalespersons] = useState<Salesperson[]>([]);
  const [agentApplications, setAgentApplications] = useState<AgentApplicationUser[]>([]);
  const [clerks, setClerks] = useState<Clerk[]>([]);
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
      setCustomers(data.customers);
      setSalespersons(data.salespersons);
      setAgentApplications(data.agentApplications as AgentApplicationUser[]);
      setClerks(data.clerks);
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">用户管理</h1>
      {error && <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

      <Tabs defaultValue="customers">
        <TabsList>
          <TabsTrigger value="customers">客户 ({customers.length})</TabsTrigger>
          <TabsTrigger value="agents">代理审核 ({agentApplications.length})</TabsTrigger>
          <TabsTrigger value="salespersons">代理商 ({salespersons.length})</TabsTrigger>
          <TabsTrigger value="clerks">制单员 ({clerks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="customers">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>昵称</TableHead>
                    <TableHead>手机</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>认证</TableHead>
                    <TableHead>余额</TableHead>
                    <TableHead>注册时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">正在读取 CloudBase 用户...</TableCell>
                    </TableRow>
                  )}
                  {!loading && customers.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-sm">{c.id}</TableCell>
                      <TableCell>{c.nickname}</TableCell>
                      <TableCell>{maskPhone(c.phone)}</TableCell>
                      <TableCell>{c.customerType === 'institution' ? '医院' : '个人'}</TableCell>
                      <TableCell>
                        <Badge variant={verifyVariant[c.verificationStatus]}>{verifyLabel[c.verificationStatus]}</Badge>
                      </TableCell>
                      <TableCell>¥{(c.wallet?.balance || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.createdAt ? formatDate(c.createdAt) : '-'}</TableCell>
                      <TableCell>
                        {c.verificationStatus === 'pending' && (
                          <Button variant="outline" size="sm" onClick={() => setReviewTarget({ type: 'verification', user: c })}>审核</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
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
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">正在读取 CloudBase 代理商申请...</TableCell>
                    </TableRow>
                  )}
                  {!loading && agentApplications.map(user => {
                    const app = user.agentApplication || {};
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-mono text-sm">{user.id}</TableCell>
                        <TableCell>{app.companyName || user.nickname}</TableCell>
                        <TableCell>{app.contactName || user.nickname}</TableCell>
                        <TableCell>{maskPhone(app.contactPhone || user.phone)}</TableCell>
                        <TableCell>{app.region || '-'}</TableCell>
                        <TableCell className="max-w-56 truncate">{app.businessArea || '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{app.submittedAt || '-'}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => setReviewTarget({ type: 'agent', user })}>审核</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!loading && agentApplications.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">暂无待审核代理商申请</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salespersons">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
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
                  {salespersons.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-sm">{s.id}</TableCell>
                      <TableCell>{s.nickname}</TableCell>
                      <TableCell>{maskPhone(s.phone)}</TableCell>
                      <TableCell>
                        <Badge variant={verifyVariant[s.verificationStatus]}>{verifyLabel[s.verificationStatus]}</Badge>
                      </TableCell>
                      <TableCell>{s.customers?.length || 0}</TableCell>
                      <TableCell>¥{(s.commission?.available || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.createdAt ? formatDate(s.createdAt) : '-'}</TableCell>
                      <TableCell>-</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clerks">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>手机</TableHead>
                    <TableHead>待处理订单</TableHead>
                    <TableHead>注册时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clerks.map(cl => (
                    <TableRow key={cl.id}>
                      <TableCell className="font-mono text-sm">{cl.id}</TableCell>
                      <TableCell>{cl.realName}</TableCell>
                      <TableCell>{maskPhone(cl.phone)}</TableCell>
                      <TableCell>{cl.assignedOrderIds.length}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(cl.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!reviewTarget} onOpenChange={() => setReviewTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reviewTarget?.type === 'agent' ? '代理商申请审核' : '医院认证审核'}</DialogTitle>
          </DialogHeader>
          {reviewTarget && (
            <div className="space-y-3 py-4">
              <div>
                <p className="text-sm text-muted-foreground">用户</p>
                <p>{reviewTarget.user.nickname} ({reviewTarget.user.phone})</p>
              </div>
              {reviewTarget.type === 'verification' && (reviewTarget.user as Customer).verificationInfo && (
                <div>
                  <p className="text-sm text-muted-foreground">联系人</p>
                  <p>{(reviewTarget.user as Customer).verificationInfo!.contactName}</p>
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
          <DialogFooter>
            <Button variant="destructive" onClick={() => handleReview(false)}>拒绝</Button>
            <Button onClick={() => handleReview(true)}>通过</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
