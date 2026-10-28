export type VisualBlock =
  | { id: string; type: 'heading'; text: string }
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'image'; src: string; alt: string }
  | { id: string; type: 'video'; src: string; title: string }
  | { id: string; type: 'columns'; left: string; right: string }
  | { id: string; type: 'banner'; title: string; text: string; src: string; label: string; href: string }
  | { id: string; type: 'form'; form: 'rental' }
  | { id: string; type: 'button'; label: string; href: string };

export type VisualPage = {
  slug: string;
  title: string;
  description: string;
  blocks: VisualBlock[];
  seo?: { title: string; image: string; noIndex: boolean };
};

export type VisualPageRecord = {
  revision: number;
  draft: VisualPage;
  published: VisualPage | null;
  updatedAt: string;
  history?: Array<{ revision: number; draft: VisualPage; published: VisualPage | null; updatedAt: string }>;
};

export type PageSaveAction = 'save' | 'publish' | 'unpublish';
export const visualPageHref = (slug: string) => slug === 'rental-intro' ? '/cooperation/rental' : `/pages/${slug}`;

export function isPageSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function isSafePageUrl(value: string): boolean {
  if (!value || value.length > 2000 || /[\s\\\u0000-\u001f]/.test(value)) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}

export function validateVisualPage(raw: unknown, publishing = false): VisualPage {
  if (!raw || typeof raw !== 'object') throw new Error('Невірний формат сторінки.');
  const page = raw as VisualPage;
  if (!isPageSlug(page.slug)) throw new Error('Адреса: до 100 малих латинських літер, цифр і дефісів між словами.');
  if (typeof page.title !== 'string' || !page.title.trim() || page.title.length > 200) throw new Error('Вкажіть назву сторінки (до 200 символів).');
  if (typeof page.description !== 'string' || page.description.length > 500) throw new Error('Опис може містити до 500 символів.');
  if (!Array.isArray(page.blocks) || page.blocks.length > 100) throw new Error('На сторінці може бути до 100 блоків.');
  const ids = new Set<string>();
  let formCount = 0;
  const blocks = page.blocks.map((block): VisualBlock => {
    if (!block || typeof block !== 'object' || typeof block.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(block.id) || ids.has(block.id)) throw new Error('Блоки повинні мати унікальні ідентифікатори.');
    ids.add(block.id);
    const textField = (value: unknown, limit = 30000) => {
      if (typeof value !== 'string' || value.length > limit) throw new Error('Перевірте текст блоку.');
      return value;
    };
    const urlField = (value: unknown, required = true) => {
      if (typeof value !== 'string' || (value && !isSafePageUrl(value)) || (publishing && required && !value)) throw new Error('Вкажіть коректне посилання від / або https://.');
      return value;
    };
    if (block.type === 'form') {
      if (block.form !== 'rental' || ++formCount > 1 || page.slug === 'rental-intro') throw new Error('Доступна одна форма оренди на сторінці. Сторінка оренди вже містить форму.');
      return { id: block.id, type: 'form', form: 'rental' };
    }
    if (block.type === 'video') return { id: block.id, type: 'video', src: urlField(block.src), title: textField(block.title, 200) };
    if (block.type === 'columns') {
      const left = textField(block.left), right = textField(block.right);
      if (publishing && (!left.trim() || !right.trim())) throw new Error('Заповніть обидві колонки.');
      return { id: block.id, type: 'columns', left, right };
    }
    if (block.type === 'banner') {
      const title = textField(block.title, 200), text = textField(block.text), label = textField(block.label, 200);
      const src = urlField(block.src, false), href = urlField(block.href, false);
      if (publishing && (!title.trim() || (!!label.trim() !== !!href))) throw new Error('Додайте заголовок банера та заповніть текст і посилання кнопки разом.');
      return { id: block.id, type: 'banner', title, text, src, label, href };
    }
    if (block.type === 'heading' || block.type === 'text') {
      if (typeof block.text !== 'string' || block.text.length > 30000 || (publishing && !block.text.trim())) throw new Error('Заповніть текстові блоки (до 30000 символів кожен).');
      return { id: block.id, type: block.type, text: block.text };
    }
    if (block.type === 'image') {
      if (typeof block.src !== 'string' || (block.src && !isSafePageUrl(block.src)) || (publishing && !block.src)) throw new Error('Вкажіть зображення: шлях від / або посилання https://.');
      if (typeof block.alt !== 'string' || block.alt.length > 500) throw new Error('Опис зображення може містити до 500 символів.');
      return { id: block.id, type: block.type, src: block.src, alt: block.alt };
    }
    if (block.type === 'button') {
      if (typeof block.label !== 'string' || block.label.length > 200 || (publishing && !block.label.trim())) throw new Error('Вкажіть текст кнопки (до 200 символів).');
      if (typeof block.href !== 'string' || (block.href && !isSafePageUrl(block.href)) || (publishing && !block.href)) throw new Error('Вкажіть посилання кнопки: шлях від / або https://.');
      return { id: block.id, type: block.type, label: block.label, href: block.href };
    }
    throw new Error('Невідомий тип блоку.');
  });
  if (publishing && !blocks.length) throw new Error('Додайте хоча б один блок перед публікацією.');
  let seo: VisualPage['seo'];
  if (page.seo !== undefined) {
    if (!page.seo || typeof page.seo.title !== 'string' || page.seo.title.length > 200 || typeof page.seo.image !== 'string' || (page.seo.image && !isSafePageUrl(page.seo.image)) || typeof page.seo.noIndex !== 'boolean') throw new Error('Перевірте SEO-поля сторінки.');
    seo = { title: page.seo.title.trim(), image: page.seo.image, noIndex: page.seo.noIndex };
  }
  return { slug: page.slug, title: page.title.trim(), description: page.description.trim(), blocks, ...(seo ? { seo } : {}) };
}

export function pageSnapshot(record: VisualPageRecord) {
  return { revision: record.revision, draft: record.draft, published: record.published, updatedAt: record.updatedAt };
}

export function reorderVisualBlocks(blocks: VisualBlock[], sourceId: string, targetId: string): VisualBlock[] {
  const from = blocks.findIndex((block) => block.id === sourceId);
  const to = blocks.findIndex((block) => block.id === targetId);
  if (from < 0 || to < 0 || from === to) return blocks;
  const next = [...blocks];
  const [source] = next.splice(from, 1);
  next.splice(to, 0, source);
  return next;
}
