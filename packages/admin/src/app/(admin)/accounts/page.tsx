'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
  getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser,
} from '@dxdy/shared';
import type { AdminUser, AdminRole } from '@dxdy/shared';

const roleLabel: Record<AdminRole, string> = {
  service: '客服',
  product_manager: '商品管理员',
  system_admin: '系统管理员',
};

const statusLabel: Record<string, string> = {
  active: '正常',
  disabled: '已禁用',
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AdminUser[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [form, setForm] = useState({
    username: '',
    password: '',
    realName: '',
    phone: '',
    role: 'service' as AdminRole,
    status: 'active' as 'active' | 'disabled',
  });

  function loadAccounts() {
    setAccounts(getAdminUsers());
  }

  useEffect(() => { loadAccounts(); }, []);

  function openCreate() {
    setEditTarget(null);
    setForm({ username: '', password: '', realName: '', phone: '', role: 'service', status: 'active' });
    setDialogOpen(true);
  }

  function openEdit(user: AdminUser) {
    setEditTarget(user);
    setForm({
      username: user.username,
      password: '',
      realName: user.realName,
      phone: user.phone,
      role: user.role,
      status: user.status,
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (editTarget) {
      const data: Partial<{ realName: string; phone: string; role: AdminRole; status: 'active' | 'disabled'; password: string }> = {
        realName: form.realName,
        phone: form.phone,
        role: form.role,
        status: form.status,
      };
      if (form.password) data.password = form.password;
      await updateAdminUser(editTarget.id, data);
    } else {
      await createAdminUser({
        username: form.username,
        password: form.password,
        realName: form.realName,
        phone: form.phone,
        role: form.role,
      });
    }
    setDialogOpen(false);
    loadAccounts();
  }

  async function handleDelete(id: string) {
    if (!confirm('确认删除该账号？')) return;
    await deleteAdminUser(id);
    loadAccounts();
  }

  async function handleToggleStatus(user: AdminUser) {
    const next = user.status === 'active' ? 'disabled' : 'active';
    await updateAdminUser(user.id, { status: next });
    loadAccounts();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">账号管理</h1>
        <Button onClick={openCreate}>新增账号</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户名</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>手机</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-sm">{a.username}</TableCell>
                  <TableCell>{a.realName}</TableCell>
                  <TableCell>{a.phone}</TableCell>
                  <TableCell><Badge variant="secondary">{roleLabel[a.role]}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={a.status === 'active' ? 'default' : 'destructive'}>
                      {statusLabel[a.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(a)}>编辑</Button>
                    <Button variant="outline" size="sm" onClick={() => handleToggleStatus(a)}>
                      {a.status === 'active' ? '禁用' : '启用'}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(a.id)}>删除</Button>
                  </TableCell>
                </TableRow>
              ))}
              {accounts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">暂无账号</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? '编辑账号' : '新增账号'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!editTarget && (
              <div className="space-y-2">
                <Label>用户名</Label>
                <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="输入用户名" />
              </div>
            )}
            <div className="space-y-2">
              <Label>{editTarget ? '重置密码（留空不修改）' : '密码'}</Label>
              <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={editTarget ? '留空不修改' : '输入密码'} />
            </div>
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input value={form.realName} onChange={e => setForm({ ...form, realName: e.target.value })} placeholder="输入真实姓名" />
            </div>
            <div className="space-y-2">
              <Label>手机</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="输入手机号" />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select value={form.role} onValueChange={v => setForm({ ...form, role: v as AdminRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">客服</SelectItem>
                  <SelectItem value="product_manager">商品管理员</SelectItem>
                  <SelectItem value="system_admin">系统管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editTarget && (
              <div className="space-y-2">
                <Label>状态</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v as 'active' | 'disabled' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">正常</SelectItem>
                    <SelectItem value="disabled">禁用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit}>{editTarget ? '保存' : '创建'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
