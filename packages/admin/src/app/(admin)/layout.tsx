'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/admin/app-sidebar';
import { Separator } from '@/components/ui/separator';
import { useAuth, type AdminProfile } from '@/hooks/use-auth';
import { getLandingPath, routeAccess } from '@/lib/admin-routes';
import { fetchAdminStatus } from '@/lib/services/database';

type AdminRole = AdminProfile['role'];

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
        const doc = await fetchAdminStatus(user.id)
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
