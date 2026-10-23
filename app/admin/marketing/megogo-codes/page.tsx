import type { Metadata } from 'next';

import AdminMegogoCodes from '@/components/admin/admin-megogo-codes';

export const metadata: Metadata = { title: 'Коди MEGOGO | Pchilka Market' };

export default function Page() {
  return <AdminMegogoCodes />;
}