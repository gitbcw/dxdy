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
  Shield,
  Key,
  WalletCards,
  Ticket,
  ClipboardCheck,
  Receipt,
} from 'lucide-react';
import { useAuth, type AdminProfile } from '@/hooks/use-auth';

type AdminRole = AdminProfile['role'];

const navItems: { title: string; href: string; icon: typeof LayoutDashboard; roles: AdminRole[] }[] = [
  { title: '仪表盘', href: '/dashboard', icon: LayoutDashboard, roles: ['system_admin'] },
  { title: '商品管理', href: '/products', icon: Package, roles: ['product_manager', 'system_admin'] },
  { title: '订单管理', href: '/orders', icon: ShoppingCart, roles: ['service', 'system_admin'] },
  { title: '退换货', href: '/returns', icon: RotateCcw, roles: ['service', 'system_admin'] },
  { title: '财务处理', href: '/finance', icon: WalletCards, roles: ['service', 'system_admin'] },
  { title: '提成管理', href: '/commissions', icon: Receipt, roles: ['system_admin'] },
  { title: '用户管理', href: '/users', icon: Users, roles: ['system_admin'] },
  { title: '账号管理', href: '/accounts', icon: Shield, roles: ['system_admin'] },
  { title: '角色管理', href: '/roles', icon: Key, roles: ['system_admin'] },
  { title: '系统配置', href: '/system', icon: Settings, roles: ['system_admin'] },
  { title: '优惠券', href: '/coupons', icon: Ticket, roles: ['system_admin'] },
  { title: '检测报告', href: '/reports', icon: ClipboardCheck, roles: ['system_admin'] },
  { title: '操作日志', href: '/logs', icon: FileText, roles: ['system_admin'] },
];

export function AppSidebar({ user }: { user: AdminProfile }) {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const filtered = navItems.filter(item => item.roles.includes(user.role));
  async function handleLogout() {
    await signOut();
    window.location.href = '/login';
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">大熊动医华南医学检验实验室</h2>
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
            <SidebarMenuButton onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span>退出登录</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
