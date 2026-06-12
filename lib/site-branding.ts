import { defaultSiteProfileSettings, type SiteProfileSettings } from '@/lib/site-profile-settings';

export function getSiteLogoUrl(profile?: Partial<SiteProfileSettings> | null): string {
  const candidate = typeof profile?.logoUrl === 'string' ? profile.logoUrl.trim() : '';
  if (candidate === '/img/logo.png') {
    return '/logo.png';
  }
  return candidate || defaultSiteProfileSettings.logoUrl;
}
