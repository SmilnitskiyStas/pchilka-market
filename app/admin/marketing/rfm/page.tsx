import type { Metadata } from 'next';

import AdminMarketingRfmDashboard from '@/components/admin/admin-marketing-rfm-dashboard';

export const metadata: Metadata = {
  title: 'RFM-аналіз | Маркетинг | Pchilka Market',
  description: 'Локальний RFM-аналіз покупців за даними POS.'
};

export default function AdminMarketingRfmPage() {
  return <AdminMarketingRfmDashboard />;
}
