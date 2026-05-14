const MAX_REASONABLE_EXPIRY_YEARS_AHEAD = 20;

export type SuspiciousInventoryExpiryDate = {
  isSuspicious: boolean;
  code: 'expired' | 'year_too_old' | 'year_too_far' | 'before_delivery' | '';
  title: string;
  message: string;
};

function parseDateOnly(value: string) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function describeInventoryExpiryDate(dateValue: string) {
  const date = parseDateOnly(dateValue);
  if (!date) return dateValue || '—';

  return new Intl.DateTimeFormat('uk-UA').format(date);
}

export function getSuspiciousInventoryExpiryDate(input: {
  expiryDate?: string | null;
  deliveryDate?: string | null;
}): SuspiciousInventoryExpiryDate {
  const expiryDate = parseDateOnly(String(input.expiryDate ?? ''));
  if (!expiryDate) {
    return {
      isSuspicious: false,
      code: '',
      title: '',
      message: ''
    };
  }

  const expiryLabel = describeInventoryExpiryDate(String(input.expiryDate ?? ''));
  const currentYear = startOfToday().getFullYear();
  const expiryYear = expiryDate.getFullYear();

  if (expiryYear < currentYear) {
    return {
      isSuspicious: true,
      code: expiryYear < 2000 ? 'year_too_old' : 'expired',
      title: 'Підозріла дата придатності',
      message:
        expiryYear < 2000
          ? `Дата ${expiryLabel} виглядає як помилка в році. Перевірте, чи не мало бути 20${String(expiryYear).slice(-2)} або інший актуальний рік.`
          : `Дата ${expiryLabel} вже робить партію простроченою в день внесення. Підтвердіть, що це вказано свідомо.`
    };
  }

  if (expiryYear > currentYear + MAX_REASONABLE_EXPIRY_YEARS_AHEAD) {
    return {
      isSuspicious: true,
      code: 'year_too_far',
      title: 'Підозріла дата придатності',
      message: `Дата ${expiryLabel} виглядає занадто далекою. Перевірте, чи рік введено без помилки.`
    };
  }

  const deliveryDate = parseDateOnly(String(input.deliveryDate ?? ''));
  if (deliveryDate && expiryDate.getTime() < deliveryDate.getTime()) {
    return {
      isSuspicious: true,
      code: 'before_delivery',
      title: 'Підозріла дата придатності',
      message: `Дата придатності ${expiryLabel} раніше за дату поставки. Перевірте правильність введення.`
    };
  }

  return {
    isSuspicious: false,
    code: '',
    title: '',
    message: ''
  };
}
