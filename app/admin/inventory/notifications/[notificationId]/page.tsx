import type { Metadata } from 'next';

import AdminInventoryManager from '@/components/admin/admin-inventory-manager';

type PageProps = {
  params: Promise<{
    notificationId: string;
  }>;
};

export const metadata: Metadata = {
  title: 'Деталі сповіщення | Інвентар | Pchilka Market',
  description: 'Повний перегляд Telegram-сповіщення inventory-модуля.'
};

export default async function AdminInventoryNotificationDetailsPage({ params }: PageProps) {
  const resolvedParams = await params;
  const notificationId = Number(resolvedParams.notificationId);

  return (
    <AdminInventoryManager
      key={`inventory-notification-${notificationId}`}
      initialSubsection="notifications"
      initialNotificationLogId={Number.isFinite(notificationId) && notificationId > 0 ? notificationId : null}
    />
  );
}
