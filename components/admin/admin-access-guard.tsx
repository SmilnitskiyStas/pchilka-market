'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { hasAdminPermission, resourceForAdminPath, type AdminPermission } from '@/lib/admin-permissions';

type Props = {
  role: 'admin' | 'editor';
  permissions: AdminPermission[];
  children: ReactNode;
};

export default function AdminAccessGuard({ role, permissions, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = hasAdminPermission(role, permissions, resourceForAdminPath(pathname));

  useEffect(() => {
    if (!allowed) router.replace('/admin');
  }, [allowed, router]);

  if (!allowed) return null;
  return <>{children}</>;
}
