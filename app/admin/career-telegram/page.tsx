import type { Metadata } from 'next';
import CareerTelegramManager from '@/components/admin/career-telegram-manager';
export const metadata: Metadata = { title: 'Telegram бот вакансій | Pchilka Market' };
export default function CareerTelegramPage() { return <CareerTelegramManager />; }
