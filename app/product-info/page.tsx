import type { Metadata } from 'next';

import ImportProductScanner from '@/components/import-product-scanner';
import { importProducts } from '@/content/import-products';

export const metadata: Metadata = {
  title: 'Пошук інформації про товар | Pchilka Market',
  description: 'Пошук інформації про імпортний товар за штрихкодом або кодом товару.',
  robots: { index: false, follow: false }
};

export default function ProductInfoLookupPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-3 py-6 sm:px-6 sm:py-10">
      <ImportProductScanner products={importProducts.map(({ slug, name, barcode, productCode }) => ({ slug, name, barcode, productCode }))} />
    </main>
  );
}
