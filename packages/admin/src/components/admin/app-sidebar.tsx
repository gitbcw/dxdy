'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  RotateCcw,
  Users,
  Settings,
  FileText,
  LogOut,
} from 'lucide-react';
import type { AdminUser } from '@dxdy/shared';

const navItems = [
  { title: '仪表盘', href: '/dashboard', icon: LayoutDashboard, roles: ['service', 'product_manager', 'system_admin'] },
  { title: '商品管理', href: '/products', icon: Package, roles: ['product_manager', 'system_admin'] },
  { title: '订单管理', href: '/orders', icon: ShoppingCart, roles: ['service', 'system_admin'] },
  { title: '退换货', href: '/returns', icon: RotateCcw, roles: ['service', 'system_admin'] },
  { title: '用户管理', href: '/users', icon: Users, roles: ['system_admin'] },
  { title: '系统配置', href: '/system', icon: Settings, roles: ['system_admin'] },
  { title: '操作日志', href: '/logs', icon: FileText, roles: ['system_admin'] },
];

export function AppSidebar({ user }: { user: AdminUser }) {
  const pathname = usePathname();
  const filtered = navItems.filter(item => item.roles.includes(user.role));

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">DXDY 演示后台</h2>
        <p className="text-xs text-muted-foreground">{user.realName} · <Badge variant="secondary" className="text-xs">{user.role}</Badge></p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>导航</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filtered.map(item => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    render={<Link href={item.href} />}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => { localStorage.removeItem('admin_user'); window.location.href = '/login'; }}>
              <LogOut className="h-4 w-4" />
              <span>退出登录</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
