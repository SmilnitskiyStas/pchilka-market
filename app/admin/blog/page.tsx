import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Адмінка: Контент | Pchilka Market',
  description: 'Перенаправлення до нового модуля Контент.'
};

export default function AdminBlogPage() {
  redirect('/admin/content');
}
