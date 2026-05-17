'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/admin/app-sidebar';
import { Separator } from '@/components/ui/separator';
import { useAuth, type AdminProfile } from '@/hooks/use-auth';
import { getDb } from '@/lib/cloudbase';

type AdminRole = AdminProfile['role'];
type UserStatusDoc = {
  status?: string;
};

const routeAccess: Record<string, AdminRole[]> = {
  dashboard: ['system_admin'],
  products: ['product_manager', 'system_admin'],
  orders: ['service', 'system_admin'],
  returns: ['service', 'system_admin'],
  finance: ['service', 'system_admin'],
  users: ['system_admin'],
  accounts: ['system_admin'],
  roles: ['system_admin'],
  system: ['system_admin'],
  coupons: ['system_admin'],
  reports: ['system_admin'],
  commissions: ['system_admin'],
  cards: ['system_admin'],
  reviews: ['system_admin'],
  logs: ['system_admin'],
};

function getLandingPath(role: AdminRole) {
  if (role === 'system_admin') return '/dashboard';
  if (role === 'product_manager') return '/products';
  return '/orders';
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // 未登录则跳转登录页
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [router, user, loading]);

  // 权限不足则跳转到对应首页
  useEffect(() => {
    if (loading || !user) return;
    const section = pathname.split('/').filter(Boolean)[0];
    const allowedRoles = section ? routeAccess[section] : null;
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      router.replace(getLandingPath(user.role));
    }
  }, [loading, pathname, router, user]);

  // 定期检查用户状态（被禁用则自动登出）
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!user) return;
    intervalRef.current = setInterval(async () => {
      try {
        const res = await getDb().collection('users').doc(user.id).get()
        const doc = (res.data as UserStatusDoc[])?.[0]
        if (!doc || doc.status === 'disabled') {
          router.replace('/login')
        }
      } catch { /* ignore */ }
    }, 60_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [user, router])

  if (!mounted || loading || !user) return null;

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm text-muted-foreground">大熊动医华南医学检验实验室管理后台</span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
