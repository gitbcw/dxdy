'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/admin/app-sidebar';
import { Separator } from '@/components/ui/separator';
import type { AdminUser } from '@dxdy/shared';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user] = useState<AdminUser | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem('admin_user');
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!user) {
      router.replace('/login');
    }
  }, [router, user]);

  if (!user) return null;

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm text-muted-foreground">DXDY 宠物医疗供应链演示后台</span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
