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
