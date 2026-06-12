export const BANNER_TIME_ZONE = 'Europe/Kiev';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function normalizeBannerDateTimeInput(value?: string | null): string | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const normalized = trimmed.replace(' ', 'T');
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (match) {
    const [, year, month, day, hours, minutes] = match;
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;

  return [
    parsed.getFullYear(),
    pad(parsed.getMonth() + 1),
    pad(parsed.getDate())
  ].join('-') + `T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

export function formatBannerDateTimeForDb(value?: string | null): string | null {
  const normalized = normalizeBannerDateTimeInput(value);
  if (!normalized) return null;
  return `${normalized.replace('T', ' ')}:00`;
}

export function parseBannerDateTimeMs(value?: string | null): number | null {
  const normalized = normalizeBannerDateTimeInput(value);
  if (!normalized) return null;

  const [datePart, timePart] = normalized.split('T');
  if (!datePart || !timePart) return null;

  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);

  if ([year, month, day, hours, minutes].some((item) => Number.isNaN(item))) {
    return null;
  }

  return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
}

function getZonedDateParts(date: Date, timeZone = BANNER_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: map.year ?? '0000',
    month: map.month ?? '01',
    day: map.day ?? '01',
    hours: map.hour ?? '00',
    minutes: map.minute ?? '00'
  };
}

export function getCurrentBannerDateTimeKey(now = new Date(), timeZone = BANNER_TIME_ZONE): string {
  const parts = getZonedDateParts(now, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hours}:${parts.minutes}`;
}

export function getBannerPublicationState(
  publishFrom?: string | null,
  publishTo?: string | null,
  now = new Date(),
  timeZone = BANNER_TIME_ZONE
): 'scheduled' | 'live' | 'expired' | 'no_period' {
  const fromKey = normalizeBannerDateTimeInput(publishFrom);
  const toKey = normalizeBannerDateTimeInput(publishTo);

  if (!fromKey && !toKey) {
    return 'no_period';
  }

  const nowKey = getCurrentBannerDateTimeKey(now, timeZone);

  if (fromKey && nowKey < fromKey) {
    return 'scheduled';
  }

  if (toKey && nowKey > toKey) {
    return 'expired';
  }

  return 'live';
}

export function isBannerInPublishRange(
  publishFrom?: string | null,
  publishTo?: string | null,
  now = new Date(),
  timeZone = BANNER_TIME_ZONE
): boolean {
  const state = getBannerPublicationState(publishFrom, publishTo, now, timeZone);
  return state === 'live' || state === 'no_period';
}

export function doesBannerMatchDate(
  publishFrom: string | null | undefined,
  publishTo: string | null | undefined,
  targetDate: string
): boolean {
  if (!targetDate) return true;

  const fromKey = normalizeBannerDateTimeInput(publishFrom);
  const toKey = normalizeBannerDateTimeInput(publishTo);

  if (!fromKey && !toKey) {
    return false;
  }

  const dayStart = `${targetDate}T00:00`;
  const dayEnd = `${targetDate}T23:59`;

  const startsBeforeOrOnDay = !fromKey || fromKey <= dayEnd;
  const endsAfterOrOnDay = !toKey || toKey >= dayStart;

  return startsBeforeOrOnDay && endsAfterOrOnDay;
}
