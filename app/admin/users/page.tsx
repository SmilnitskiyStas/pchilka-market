import type { Metadata } from 'next';

import AdminUsersManager from '@/components/admin/admin-users-manager';

export const metadata: Metadata = {
  title: 'Користувачі | Адмін-панель Pchilka Market',
  description: 'Керування користувачами та доступами до адмін-панелі.'
};

export default function AdminUsersPage() {
  return <AdminUsersManager />;
}
