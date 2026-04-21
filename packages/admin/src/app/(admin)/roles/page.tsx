'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getAdminUsers, updateRolePermissions } from '@dxdy/shared';
import type { AdminRole } from '@dxdy/shared';

const roleLabel: Record<AdminRole, string> = {
  service: '客服',
  product_manager: '商品管理员',
  system_admin: '系统管理员',
};

const permissionLabels: Record<string, string> = {
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
    manage_returns: true,
  },
  product_manager: {
    view_dashboard: true,
    manage_products: true,
  },
  system_admin: {
    view_dashboard: true,
    manage_products: true,
    manage_orders: true,
    manage_returns: true,
    manage_users: true,
    manage_accounts: true,
    manage_roles: true,
    manage_system: true,
    view_logs: true,
  },
};

export default function RolesPage() {
  const [permissions, setPermissions] = useState<Record<AdminRole, Record<string, boolean>>>(() => {
    const result = {} as Record<AdminRole, Record<string, boolean>>;
    for (const role of Object.keys(defaultPermissions) as AdminRole[]) {
      result[role] = { ...defaultPermissions[role] };
    }
    return result;
  });
  const [saving, setSaving] = useState<AdminRole | null>(null);

  useEffect(() => {
    const admins = getAdminUsers();
    const merged = { ...defaultPermissions } as Record<AdminRole, Record<string, boolean>>;
    for (const role of Object.keys(merged) as AdminRole[]) {
      const user = admins.find(a => a.role === role);
      if (user && Object.keys(user.permissions).length > 0) {
        merged[role] = { ...user.permissions };
      }
    }
    setPermissions(merged);
  }, []);

  async function handleSave(role: AdminRole) {
    setSaving(role);
    await updateRolePermissions(role, permissions[role]);
    setSaving(null);
    alert(`${roleLabel[role]}权限已保存`);
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

  const roles: AdminRole[] = ['service', 'product_manager', 'system_admin'];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">角色管理</h1>

      <div className="grid gap-6 md:grid-cols-3">
        {roles.map(role => (
          <Card key={role}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">{roleLabel[role]}</CardTitle>
              <Badge variant="secondary">{getAdminUsers().filter(a => a.role === role).length} 人</Badge>
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
