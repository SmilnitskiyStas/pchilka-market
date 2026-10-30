import { isSafePageUrl } from '@/lib/visual-pages';

export type HomeLoyaltyImageSettings = { src: string; alt: string };
export const defaultHomeLoyaltyImage: HomeLoyaltyImageSettings = {
  src: '/img/loyalty/mobile-app-home.png',
  alt: 'Мобільний застосунок Пчілка: картка у твоєму смартфоні, кешбек, акції та відгуки'
};
export function validateHomeLoyaltyImage(raw: unknown): HomeLoyaltyImageSettings {
  if (!raw || typeof raw !== 'object') throw new Error('Вкажіть зображення програми лояльності.');
  const { src, alt } = raw as HomeLoyaltyImageSettings;
  if (typeof src !== 'string' || !isSafePageUrl(src.trim())) throw new Error('Вкажіть шлях до зображення від / або адресу https://.');
  if (typeof alt !== 'string' || !alt.trim() || alt.length > 500) throw new Error('Додайте опис зображення (до 500 символів).');
  return { src: src.trim(), alt: alt.trim() };
}
