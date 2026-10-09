import type { Metadata } from 'next';

import ImportProductScanner from '@/components/import-product-scanner';

export const metadata: Metadata = {
  title: 'Пошук інформації про товар | Pchilka Market',
  description: 'Пошук товару за штрихкодом або артикулом.',
  robots: { index: false, follow: false }
};

export default function ProductInfoLookupPage() {
  return <main className="mx-auto min-h-screen max-w-4xl px-3 py-6 sm:px-6 sm:py-10"><ImportProductScanner /></main>;
}
