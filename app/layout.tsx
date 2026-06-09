import type { Metadata } from 'next';

import AnalyticsConsentBanner from '@/components/analytics-consent-banner';
import AnalyticsLoader from '@/components/analytics-loader';
import SeoRuntimeLoader from '@/components/seo-runtime-loader';
import SiteFooter from '@/components/site-footer';
import SiteHeader from '@/components/site-header';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pchilka Market',
  description: 'MVP вебзастосунку Pchilka Market',
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png'
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body>
        <AnalyticsLoader />
        <SeoRuntimeLoader />
        <SiteHeader />
        {children}
        <SiteFooter />
        <AnalyticsConsentBanner />
      </body>
    </html>
  );
}
