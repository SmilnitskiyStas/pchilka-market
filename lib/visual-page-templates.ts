import type { VisualPage } from '@/lib/visual-pages';

export const visualPageTemplates: Array<{ id: string; label: string; blocks: VisualPage['blocks'] }> = [
  { id: 'information', label: 'Інформаційна сторінка', blocks: [{ id: 'intro', type: 'text', text: 'Розкажіть про головне.' }, { id: 'details', type: 'heading', text: 'Детальніше' }, { id: 'body', type: 'text', text: 'Додайте подробиці.' }] },
  { id: 'partner', label: 'Пропозиція для партнерів', blocks: [{ id: 'banner', type: 'banner', title: 'Запрошуємо до співпраці', text: 'Опишіть вашу пропозицію.', src: '', label: '', href: '' }, { id: 'benefits', type: 'columns', left: '**Ваші переваги**\nДодайте інформацію.', right: '**Як почати**\nОпишіть наступний крок.' }] },
  { id: 'rental', label: 'Оренда з формою заявки', blocks: [{ id: 'intro', type: 'text', text: 'Опишіть умови оренди.' }, { id: 'request', type: 'form', form: 'rental' }] }
];

export function copyVisualPage(page: VisualPage, id: () => string): VisualPage {
  const copy = structuredClone(page);
  return { ...copy, slug: '', title: `${copy.title} — копія`.slice(0, 200), blocks: copy.blocks.map((block) => ({ ...block, id: id() })), seo: { title: '', image: copy.seo?.image || '', noIndex: copy.seo?.noIndex ?? false } };
}
