import type { Metadata } from 'next';

import AnalyticsConsentBanner from '@/components/analytics-consent-banner';
import AnalyticsLoader from '@/components/analytics-loader';
import SeoRuntimeLoader from '@/components/seo-runtime-loader';
import SiteFooter from '@/components/site-footer';
import SiteHeader from '@/components/site-header';
import SiteContentProvider, { PageAssignedArticles } from '@/components/site-content-provider';
import { getSiteProfileFromDb } from '@/lib/site-profile-repository';
import { defaultSiteProfileSettings } from '@/lib/site-profile-settings';
import './globals.css';
import './public-site.css';
import './visual-pages.css';

export const metadata: Metadata = {
  title: 'Pchilka Market',
  description: 'Офіційний сайт Pchilka Market: акції, магазини, власне виробництво та програма лояльності.',
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png'
  }
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getSiteProfileFromDb().catch(() => defaultSiteProfileSettings);
  return (
    <html lang="uk">
      <body>
        <AnalyticsLoader />
        <SeoRuntimeLoader />
        <SiteContentProvider>
        <SiteHeader profile={{ contactPhones: profile.contactPhones, logoUrl: profile.logoUrl }} />
        <PageAssignedArticles placement="before-content" />
        {children}
        <PageAssignedArticles />
        <SiteFooter />
        </SiteContentProvider>
        <AnalyticsConsentBanner />
      </body>
    </html>
  );
}
