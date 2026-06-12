import type { Metadata } from 'next';

import AdminMediaFilesManager from '@/components/admin/admin-media-files-manager';

export const metadata: Metadata = {
  title: 'Адмінка: Медіафайли | Pchilka Market',
  description: 'Керування фото, відео, PDF, банерами та іншими медіафайлами сайту.'
};

export default function AdminMediaPage() {
  return <AdminMediaFilesManager />;
}
