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
import { getAllUsers, reviewVerification, getClerks } from '@dxdy/shared';
import { maskPhone, formatDate } from '@dxdy/shared';
import type { Customer, Salesperson, Clerk } from '@dxdy/shared';

export default function UsersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salespersons, setSalespersons] = useState<Salesperson[]>([]);
  const [clerks, setClerks] = useState<Clerk[]>([]);
  const [reviewTarget, setReviewTarget] = useState<{ type: 'customer' | 'salesperson'; user: Customer | Salesperson } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    getAllUsers().then(({ customers, salespersons }) => {
      setCustomers(customers);
      setSalespersons(salespersons);
    });
    setClerks(getClerks());
  }, []);

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
    const updated = await reviewVerification(reviewTarget.user.id, approved, approved ? undefined : rejectReason);
    if (updated) {
      if (reviewTarget.type === 'customer') {
        setCustomers(prev => prev.map(c => c.id === updated.id ? updated as Customer : c));
      } else {
        setSalespersons(prev => prev.map(s => s.id === updated.id ? updated as Salesperson : s));
      }
    }
    setReviewTarget(null);
    setRejectReason('');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">用户管理</h1>

      <Tabs defaultValue="customers">
        <TabsList>
          <TabsTrigger value="customers">客户 ({customers.length})</TabsTrigger>
          <TabsTrigger value="salespersons">业务员 ({salespersons.length})</TabsTrigger>
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
                  {customers.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-sm">{c.id}</TableCell>
                      <TableCell>{c.nickname}</TableCell>
                      <TableCell>{maskPhone(c.phone)}</TableCell>
                      <TableCell>{c.customerType === 'institution' ? '医院' : '个人'}</TableCell>
                      <TableCell>
                        <Badge variant={verifyVariant[c.verificationStatus]}>{verifyLabel[c.verificationStatus]}</Badge>
                      </TableCell>
                      <TableCell>¥{c.wallet.balance.toFixed(2)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                      <TableCell>
                        {c.verificationStatus === 'pending' && (
                          <Button variant="outline" size="sm" onClick={() => setReviewTarget({ type: 'customer', user: c })}>审核</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
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
                      <TableCell>{s.customers.length}</TableCell>
                      <TableCell>¥{s.commission.available.toFixed(2)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(s.createdAt)}</TableCell>
                      <TableCell>
                        {s.verificationStatus === 'pending' && (
                          <Button variant="outline" size="sm" onClick={() => setReviewTarget({ type: 'salesperson', user: s })}>审核</Button>
                        )}
                      </TableCell>
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
            <DialogTitle>实名认证审核</DialogTitle>
          </DialogHeader>
          {reviewTarget && (
            <div className="space-y-3 py-4">
              <div>
                <p className="text-sm text-muted-foreground">用户</p>
                <p>{reviewTarget.user.nickname} ({reviewTarget.user.phone})</p>
              </div>
              {reviewTarget.type === 'customer' && (reviewTarget.user as Customer).verificationInfo && (
                <div>
                  <p className="text-sm text-muted-foreground">联系人</p>
                  <p>{(reviewTarget.user as Customer).verificationInfo!.contactName}</p>
                </div>
              )}
              {reviewTarget.type === 'salesperson' && (
                <div>
                  <p className="text-sm text-muted-foreground">真实姓名</p>
                  <p>{(reviewTarget.user as Salesperson).verificationInfo.realName}</p>
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
