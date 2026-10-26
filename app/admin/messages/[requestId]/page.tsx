import type { Metadata } from 'next';

import CandidateRequestPage from '@/components/admin/candidate-request-page';

export const metadata: Metadata = { title: 'Заявка кандидата | Адмін-панель Pchilka Market' };

export default async function AdminCandidateRequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  return <CandidateRequestPage requestId={requestId} />;
}
