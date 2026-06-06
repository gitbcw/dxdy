'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { fetchRoles, updateRolePermissions } from '@/lib/services/database';
import { writeAdminLog } from '@/lib/admin-log';
import type { AdminRole } from '@/lib/types';

const roleLabel: Record<AdminRole, string> = {
  service: '客服',
  product_manager: '商品管理员',
  clerk: '制单员',
  system_admin: '系统管理员',
};

const permissionLabels: Record<string, string> = {
  order_price_adjust: '调整订单价格',
  view_dashboard: '查看仪表盘',
  manage_products: '管理商品',
  manage_orders: '管理订单',
  manage_returns: '管理退换货',
  manage_users: '管理用户',
  manage_accounts: '管理账号',
  manage_roles: '管理角色',
  manage_system: '系统配置',
  view_logs: '查看日志',
};

const defaultPermissions: Record<AdminRole, Record<string, boolean>> = {
  service: {
    view_dashboard: true,
    manage_orders: true,
    order_price_adjust: false,
    manage_returns: true,
  },
  product_manager: {
    view_dashboard: true,
    manage_products: true,
  },
  clerk: {
    manage_orders: true,
    manage_returns: true,
  },
  system_admin: {
    view_dashboard: true,
    manage_products: true,
    manage_orders: true,
    order_price_adjust: false,
    manage_returns: true,
    manage_users: true,
    manage_accounts: true,
    manage_roles: true,
    manage_system: true,
    view_logs: true,
  },
};

export default function RolesPage() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Record<AdminRole, Record<string, boolean>>>(() => {
    const result = {} as Record<AdminRole, Record<string, boolean>>;
    for (const role of Object.keys(defaultPermissions) as AdminRole[]) {
      result[role] = { ...defaultPermissions[role] };
    }
    return result;
  });
  const [saving, setSaving] = useState<AdminRole | null>(null);
  const [counts, setCounts] = useState<Record<AdminRole, number>>({ service: 0, product_manager: 0, system_admin: 0, clerk: 0 });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadRoles() {
      setError('');
      try {
        const data = await fetchRoles();
        if (data.permissions) {
          setPermissions(() => {
            const result = {} as Record<AdminRole, Record<string, boolean>>;
            for (const role of Object.keys(defaultPermissions) as AdminRole[]) {
              result[role] = { ...defaultPermissions[role], ...(data.permissions[role] || {}) };
            }
            return result;
          });
        }
        if (data.counts) setCounts(data.counts);
      } catch (err) {
        setError(err instanceof Error ? err.message : '读取角色权限失败');
      }
    }

    loadRoles();
  }, []);

  async function handleSave(role: AdminRole) {
    setSaving(role);
    setError('');
    setMessage('');
    try {
      await updateRolePermissions(role, permissions[role]);
      await writeAdminLog({ operator: user, action: 'update_role_permissions', target: role, detail: `更新 ${roleLabel[role]} 权限` });
      setMessage(`${roleLabel[role]}权限已保存`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存角色权限失败');
    } finally {
      setSaving(null);
    }
  }

  function togglePermission(role: AdminRole, key: string) {
    setPermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [key]: !prev[role][key],
      },
    }));
  }

  const roles: AdminRole[] = ['service', 'clerk', 'system_admin'];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">角色管理</h1>
      {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
      {message && <div className="rounded-md border border-emerald-700/20 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}

      <div className="grid gap-6 xl:grid-cols-3">
        {roles.map(role => (
          <Card key={role}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">{roleLabel[role]}</CardTitle>
              <Badge variant="secondary">{counts[role]} 人</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(permissionLabels).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!permissions[role]?.[key]}
                    onChange={() => togglePermission(role, key)}
                    className="rounded"
                  />
                  {label}
                </label>
              ))}
              <div className="flex justify-end pt-3">
                <Button
                  size="sm"
                  onClick={() => handleSave(role)}
                  disabled={saving === role}
                >
                  {saving === role ? '保存中...' : '保存权限'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
