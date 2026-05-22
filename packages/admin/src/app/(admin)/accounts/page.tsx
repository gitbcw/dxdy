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
import { useAuth } from '@/hooks/use-auth';
import { fetchAdminAccounts, createAdminAccount, updateAdminAccount, deleteAdminAccount } from '@/lib/services/database';
import { writeAdminLog } from '@/lib/admin-log';
import type { AdminUser, AdminRole } from '@/lib/types';

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
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  async function loadAccounts() {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminAccounts();
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取账号失败');
    } finally {
      setLoading(false);
    }
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
    setError('');
    try {
      if (editTarget) {
        const data: Partial<{ realName: string; phone: string; role: AdminRole; status: 'active' | 'disabled'; password: string }> = {
          realName: form.realName,
          phone: form.phone,
          role: form.role,
          status: form.status,
        };
        if (form.password) data.password = form.password;
        await updateAdminAccount(editTarget.id, data);
        await writeAdminLog({ operator: user, action: 'update_account', target: editTarget.id, detail: `更新账号 ${editTarget.username}` });
      } else {
        await createAdminAccount({
          username: form.username,
          password: form.password,
          realName: form.realName,
          phone: form.phone,
          role: form.role,
        });
        await writeAdminLog({ operator: user, action: 'create_account', target: form.username, detail: `创建账号 ${form.username}` });
      }
      setDialogOpen(false);
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存账号失败');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确认删除该账号？')) return;
    try {
      await deleteAdminAccount(id);
      await writeAdminLog({ operator: user, action: 'delete_account', target: id, detail: `删除账号 ${id}` });
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除账号失败');
    }
  }

  async function handleToggleStatus(target: AdminUser) {
    const next = target.status === 'active' ? 'disabled' : 'active';
    try {
      await updateAdminAccount(target.id, { status: next });
      await writeAdminLog({ operator: user, action: 'toggle_account_status', target: target.id, detail: `账号 ${target.username} 状态变更为 ${next}` });
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新账号状态失败');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">账号管理</h1>
        <Button onClick={openCreate}>新增账号</Button>
      </div>
      {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

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
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">加载账号中...</TableCell>
                </TableRow>
              )}
              {!loading && accounts.map(a => (
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
              {!loading && accounts.length === 0 && (
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
              <Select value={form.role} onValueChange={v => setForm({ ...form, role: (v ?? 'service') as AdminRole })}>
                <SelectTrigger><SelectValue>{roleLabel[form.role]}</SelectValue></SelectTrigger>
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
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: (v ?? 'active') as 'active' | 'disabled' })}>
                  <SelectTrigger><SelectValue>{statusLabel[form.status]}</SelectValue></SelectTrigger>
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
