import type { Metadata } from 'next';
import AdminOfferProductManager from '@/components/admin/admin-offer-product-manager';
export const metadata: Metadata = { title: 'Співпраця: запропонувати товар | Admin' };
export default function Page() { return <AdminOfferProductManager />; }
