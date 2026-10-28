import type { Metadata } from 'next';

import AnalyticsConsentBanner from '@/components/analytics-consent-banner';
import AnalyticsLoader from '@/components/analytics-loader';
import SeoRuntimeLoader from '@/components/seo-runtime-loader';
import SiteFooter from '@/components/site-footer';
import SiteHeader from '@/components/site-header';
import SiteContentProvider, { PageAssignedArticles } from '@/components/site-content-provider';
import './globals.css';
import './public-site.css';

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
        <SiteContentProvider>
        <SiteHeader />
        {children}
        <PageAssignedArticles />
        <SiteFooter />
        </SiteContentProvider>
        <AnalyticsConsentBanner />
      </body>
    </html>
  );
}
