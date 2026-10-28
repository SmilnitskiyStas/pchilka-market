import type { Metadata } from 'next';
import AdminMenuManager from '@/components/admin/admin-menu-manager';
export const metadata: Metadata = { title: 'Меню сайту | Admin' };
export default function Page() { return <AdminMenuManager />; }
