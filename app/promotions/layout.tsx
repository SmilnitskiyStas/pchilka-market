import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Акції | Pchilka Market',
  description: 'Розділ акцій та каталогу Pchilka Market'
};

export default function PromotionsLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
