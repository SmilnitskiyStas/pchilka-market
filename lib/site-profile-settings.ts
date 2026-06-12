export type SiteProfileSettings = {
  companyName: string;
  logoUrl: string;
  contactPhones: string[];
  contactEmail: string;
  contactAddress: string;
  contactsPageTitle: string;
  contactsPageLines: string[];
  contactsMapAddress: string;
  storesPageTitle: string;
  storesPageDescription: string;
  storesMapEmbedUrl: string;
  storesMapTitle: string;
  updatedAt: string;
};

export const SITE_PROFILE_SETTINGS_KEY = 'site_profile_v1';

export const defaultSiteProfileSettings: SiteProfileSettings = {
  companyName: 'Pchilka Market',
  logoUrl: '/logo.png',
  contactPhones: ['+38 (067) 341-84-98', '+38 (073) 341-84-98', '+38 (095) 341-84-98'],
  contactEmail: 'office.manager@legion2015.com',
  contactAddress: 'м. Київ, проспект Повітряних Сил, 19A/1',
  contactsPageTitle: 'Контакти',
  contactsPageLines: [
    'Центральний офіс Pchilka Market',
    'м. Київ, проспект Повітряних Сил, 19A/1',
    'Телефон: +38 (067) 341-84-98',
    'Email: office.manager@legion2015.com'
  ],
  contactsMapAddress: 'Київ, проспект Повітряних Сил, 19A/1',
  storesPageTitle: 'Наші магазини',
  storesPageDescription: 'Актуальний список магазинів Pchilka Market за містами та населеними пунктами.',
  storesMapEmbedUrl: '',
  storesMapTitle: 'Карта магазинів Pchilka Market',
  updatedAt: ''
};

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLogoUrl(value: unknown): string {
  const normalized = normalizeString(value);
  if (normalized === '/img/logo.png') {
    return '/logo.png';
  }
  return normalized;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeString(item)).filter(Boolean);
}

export function normalizeSiteProfileSettings(
  raw: Partial<SiteProfileSettings> | null | undefined
): SiteProfileSettings {
  const phones = normalizeStringList(raw?.contactPhones);
  const lines = normalizeStringList(raw?.contactsPageLines);

  return {
    companyName: normalizeString(raw?.companyName) || defaultSiteProfileSettings.companyName,
    logoUrl: normalizeLogoUrl(raw?.logoUrl) || defaultSiteProfileSettings.logoUrl,
    contactPhones: phones.length > 0 ? phones : defaultSiteProfileSettings.contactPhones,
    contactEmail: normalizeString(raw?.contactEmail) || defaultSiteProfileSettings.contactEmail,
    contactAddress: normalizeString(raw?.contactAddress) || defaultSiteProfileSettings.contactAddress,
    contactsPageTitle: normalizeString(raw?.contactsPageTitle) || defaultSiteProfileSettings.contactsPageTitle,
    contactsPageLines: lines.length > 0 ? lines : defaultSiteProfileSettings.contactsPageLines,
    contactsMapAddress: normalizeString(raw?.contactsMapAddress) || defaultSiteProfileSettings.contactsMapAddress,
    storesPageTitle: normalizeString(raw?.storesPageTitle) || defaultSiteProfileSettings.storesPageTitle,
    storesPageDescription:
      normalizeString(raw?.storesPageDescription) || defaultSiteProfileSettings.storesPageDescription,
    storesMapEmbedUrl: normalizeString(raw?.storesMapEmbedUrl),
    storesMapTitle: normalizeString(raw?.storesMapTitle) || defaultSiteProfileSettings.storesMapTitle,
    updatedAt: normalizeString(raw?.updatedAt)
  };
}
