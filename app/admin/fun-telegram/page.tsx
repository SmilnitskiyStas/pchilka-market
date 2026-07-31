import type { Metadata } from 'next';
import FunTelegramManager from '@/components/admin/fun-telegram-manager';
export const metadata: Metadata = { title: 'Тестовий Telegram бот | Pchilka Market' };
export default function FunTelegramPage() { return <FunTelegramManager />; }
