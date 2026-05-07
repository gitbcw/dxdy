'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/admin/app-sidebar';
import { Separator } from '@/components/ui/separator';
import type { AdminUser } from '@/lib/types';

const routeAccess: Record<string, AdminUser['role'][]> = {
  dashboard: ['system_admin'],
  products: ['product_manager', 'system_admin'],
  orders: ['service', 'system_admin'],
  returns: ['service', 'system_admin'],
  finance: ['service', 'system_admin'],
  users: ['system_admin'],
  accounts: ['system_admin'],
  roles: ['system_admin'],
  system: ['system_admin'],
  logs: ['system_admin'],
};

function getLandingPath(role: AdminUser['role']) {
  if (role === 'system_admin') return '/dashboard';
  if (role === 'product_manager') return '/products';
  return '/orders';
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let canceled = false;
    async function loadSession() {
      try {
        const response = await fetch('/api/cloudbase/accounts/session', {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!response.ok) throw new Error('session invalid');
        const data = await response.json() as { user?: AdminUser };
        if (!canceled && data.user) {
          setUser(data.user);
          window.localStorage.setItem('admin_user', JSON.stringify(data.user));
        }
      } catch {
        window.localStorage.removeItem('admin_user');
      } finally {
        if (!canceled) setMounted(true);
      }
    }
    void loadSession();
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (mounted && !user) {
      router.replace('/login');
    }
  }, [router, user, mounted]);

  useEffect(() => {
    if (!mounted || !user) return;
    const section = pathname.split('/').filter(Boolean)[0];
    const allowedRoles = section ? routeAccess[section] : null;
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      router.replace(getLandingPath(user.role));
    }
  }, [mounted, pathname, router, user]);

  if (!mounted || !user) return null;

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
