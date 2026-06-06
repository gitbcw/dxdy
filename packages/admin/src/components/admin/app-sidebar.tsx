'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
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
  Receipt,
  CreditCard,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Boxes,
  CircleDollarSign,
  UserCog,
} from 'lucide-react';
import { useAuth, type AdminProfile } from '@/hooks/use-auth';

type AdminRole = AdminProfile['role'];
type NavIcon = typeof LayoutDashboard;

type NavItem = {
  title: string;
  href: string;
  icon: NavIcon;
  roles: AdminRole[];
};

type NavGroup = {
  title: string;
  icon: NavIcon;
  items: NavItem[];
};

const dashboardItem: NavItem = {
  title: '仪表盘',
  href: '/dashboard',
  icon: LayoutDashboard,
  roles: ['system_admin'],
};

const navGroups: NavGroup[] = [
  {
    title: '商品运营',
    icon: Boxes,
    items: [
      { title: '商品管理', href: '/products', icon: Package, roles: ['product_manager', 'system_admin'] },
      { title: '卡券管理', href: '/cards', icon: CreditCard, roles: ['system_admin'] },
      { title: '优惠券', href: '/coupons', icon: Ticket, roles: ['system_admin'] },
      { title: '评论管理', href: '/reviews', icon: MessageSquare, roles: ['system_admin'] },
    ],
  },
  {
    title: '订单履约',
    icon: ShoppingCart,
    items: [
      { title: '订单管理', href: '/orders', icon: ShoppingCart, roles: ['service', 'clerk', 'system_admin'] },
      { title: '退换货', href: '/returns', icon: RotateCcw, roles: ['service', 'clerk', 'system_admin'] },
    ],
  },
  {
    title: '财务结算',
    icon: CircleDollarSign,
    items: [
      { title: '财务处理', href: '/finance', icon: WalletCards, roles: ['service', 'system_admin'] },
      { title: '提成管理', href: '/commissions', icon: Receipt, roles: ['system_admin'] },
    ],
  },
  {
    title: '用户权限',
    icon: UserCog,
    items: [
      { title: '用户管理', href: '/users', icon: Users, roles: ['system_admin'] },
      { title: '账号管理', href: '/accounts', icon: Shield, roles: ['system_admin'] },
      { title: '角色管理', href: '/roles', icon: Key, roles: ['system_admin'] },
    ],
  },
  {
    title: '系统管理',
    icon: Settings,
    items: [
      { title: '系统配置', href: '/system', icon: Settings, roles: ['system_admin'] },
      { title: '操作日志', href: '/logs', icon: FileText, roles: ['system_admin'] },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.endsWith(href);
}

function filterItemByRole(item: NavItem, role: AdminRole) {
  return item.roles.includes(role);
}

export function AppSidebar({ user }: { user: AdminProfile }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();

  const visibleDashboard = filterItemByRole(dashboardItem, user.role) ? dashboardItem : null;
  const visibleGroups = useMemo(
    () =>
      navGroups
        .map(group => ({
          ...group,
          items: group.items.filter(item => filterItemByRole(item, user.role)),
        }))
        .filter(group => group.items.length > 0),
    [user.role],
  );

  const activeGroupTitle = visibleGroups.find(group =>
    group.items.some(item => isActivePath(pathname, item.href)),
  )?.title;

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    activeGroupTitle ? { [activeGroupTitle]: true } : {},
  );

  function toggleGroup(title: string) {
    setOpenGroups(prev => ({ ...prev, [title]: !prev[title] }));
  }

  async function handleLogout() {
    await signOut();
    router.replace('/login');
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">大熊动医</h2>
        <p className="text-xs text-muted-foreground">
          {user.realName} · <Badge variant="secondary" className="text-xs">{user.role}</Badge>
        </p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>导航</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleDashboard && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActivePath(pathname, visibleDashboard.href)}
                    render={<Link href={visibleDashboard.href} />}
                  >
                    <visibleDashboard.icon className="h-4 w-4" />
                    <span>{visibleDashboard.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {visibleGroups.map(group => {
                const isOpen = openGroups[group.title] ?? group.title === activeGroupTitle;
                const hasActiveItem = group.items.some(item => isActivePath(pathname, item.href));
                return (
                  <SidebarMenuItem key={group.title}>
                    <SidebarMenuButton
                      type="button"
                      isActive={hasActiveItem}
                      onClick={() => toggleGroup(group.title)}
                      aria-expanded={isOpen}
                    >
                      <group.icon className="h-4 w-4" />
                      <span>{group.title}</span>
                      {isOpen ? (
                        <ChevronDown className="ml-auto h-4 w-4" />
                      ) : (
                        <ChevronRight className="ml-auto h-4 w-4" />
                      )}
                    </SidebarMenuButton>
                    {isOpen && (
                      <SidebarMenuSub>
                        {group.items.map(item => (
                          <SidebarMenuSubItem key={item.href}>
                            <SidebarMenuSubButton
                              isActive={isActivePath(pathname, item.href)}
                              render={<Link href={item.href} />}
                            >
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                );
              })}
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
