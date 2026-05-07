import type { Metadata } from 'next';

import AdminMessagesManager from '@/components/admin/admin-messages-manager';

export const metadata: Metadata = {
  title: 'Повідомлення | Адмін-панель Pchilka Market',
  description: 'Вхідні заявки та повідомлення з публічних форм сайту.'
};

export default function AdminMessagesPage() {
  return <AdminMessagesManager />;
}

