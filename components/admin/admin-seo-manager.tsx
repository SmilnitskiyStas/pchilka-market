'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { mainMenu } from '@/content/menu';
import {
  buildAutoSeoDraft,
  getEffectiveSeo,
  isValidCanonical,
  loadSeoRulesFromStorage,
  normalizePath,
  normalizeRule,
  parseSeoRulesFromUnknown,
  saveSeoRulesToStorage,
  type SeoRobotsValue,
  type SeoRule,
  type SitemapChangeFrequency
} from '@/lib/seo-settings';

type RouteOption = {
  label: string;
  href: string;
};

type TokenField = 'title' | 'description' | 'canonical';

type TokenMenuState = {
  field: TokenField;
  start: number;
  end: number;
  query: string;
};

type SeoPageBlueprint = {
  pageType: string;
  routePattern: string;
  dataSource: string;
  titleTemplate: string;
  descriptionTemplate: string;
  canonicalTemplate: string;
  imageFields: string[];
  previewTitle: string;
};

const seoPageBlueprints: SeoPageBlueprint[] = [
  {
    pageType: 'Сторінка блогу (список)',
    routePattern: '/blog',
    dataSource: 'seo_pages (type=blog_list)',
    titleTemplate: '[title] | Блог | [Brand]',
    descriptionTemplate: '[description]',
    canonicalTemplate: '[domain]/blog',
    imageFields: ['og_image_url', 'og_image_alt'],
    previewTitle: 'Блог мережі | Блог | Pchilka Market'
  },
  {
    pageType: 'Стаття блогу',
    routePattern: '/blog/[slug]',
    dataSource: 'blog_posts + seo_overrides',
    titleTemplate: '[title] | Блог | [Brand]',
    descriptionTemplate: '[excerpt]',
    canonicalTemplate: '[domain]/blog/[slug]',
    imageFields: ['cover_image_url', 'cover_image_alt', 'cover_image_title', 'cover_image_caption'],
    previewTitle: 'Нова акція тижня | Блог | Pchilka Market'
  },
  {
    pageType: 'Сторінка фото/медіа',
    routePattern: '/media/[slug]',
    dataSource: 'media_assets + seo_overrides',
    titleTemplate: '[image_title] | [section] | [Brand]',
    descriptionTemplate: '[image_description]',
    canonicalTemplate: '[domain]/media/[slug]',
    imageFields: ['file_url', 'alt', 'title', 'caption'],
    previewTitle: 'Новий банер Milka | Акції | Pchilka Market'
  }
];

const seoTokens = ['[title]', '[description]', '[slug]', '[Brand]', '[domain]', '[section]', '[image_title]', '[image_description]'];
const sitemapFrequencies: SitemapChangeFrequency[] = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];

function getTokenMenuState(field: TokenField, value: string, cursor: number): TokenMenuState | null {
  const safeCursor = Math.max(0, Math.min(cursor, value.length));
  const beforeCursor = value.slice(0, safeCursor);
  const openIndex = beforeCursor.lastIndexOf('[');
  if (openIndex < 0) return null;

  const closeIndex = beforeCursor.lastIndexOf(']');
  if (closeIndex > openIndex) return null;

  return {
    field,
    start: openIndex,
    end: safeCursor,
    query: value.slice(openIndex + 1, safeCursor).trim().toLowerCase()
  };
}

function buildRouteOptions(): RouteOption[] {
  const values: RouteOption[] = [];

  mainMenu.forEach((item) => {
    if (item.href && item.href !== '#') values.push({ label: item.label, href: item.href });

    (item.children ?? []).forEach((child) => {
      if (child.href && child.href !== '#') values.push({ label: `${item.label} -> ${child.label}`, href: child.href });
    });
  });

  const unique = new Map<string, RouteOption>();
  values.forEach((value) => {
    if (!unique.has(value.href)) unique.set(value.href, value);
  });

  return Array.from(unique.values()).sort((a, b) => a.href.localeCompare(b.href));
}

async function fetchSeoRules(): Promise<SeoRule[]> {
  const response = await fetch('/api/admin/seo/rules', { cache: 'no-store' });
  const payload = (await response.json()) as { ok?: boolean; rules?: unknown; error?: string };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Не вдалося завантажити SEO-правила з БД.');
  }

  return parseSeoRulesFromUnknown(payload.rules);
}

async function saveSeoRules(rules: SeoRule[]): Promise<SeoRule[]> {
  const response = await fetch('/api/admin/seo/rules', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules })
  });

  const payload = (await response.json()) as { ok?: boolean; rules?: unknown; error?: string };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || 'Не вдалося зберегти SEO-правила у БД.');
  }

  return parseSeoRulesFromUnknown(payload.rules);
}

export default function AdminSeoManager() {
  const [rules, setRules] = useState<SeoRule[]>(() => loadSeoRulesFromStorage());
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [routeTemplate, setRouteTemplate] = useState('');
  const [path, setPath] = useState('/');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [canonical, setCanonical] = useState('');
  const [robots, setRobots] = useState<SeoRobotsValue>('index,follow');

  const [includeInSitemap, setIncludeInSitemap] = useState(true);
  const [changeFrequency, setChangeFrequency] = useState<SitemapChangeFrequency>('weekly');
  const [priority, setPriority] = useState('0.7');

  const [manualTitle, setManualTitle] = useState(false);
  const [manualDescription, setManualDescription] = useState(false);
  const [manualCanonical, setManualCanonical] = useState(false);
  const [expertRobots, setExpertRobots] = useState(false);

  const [error, setError] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tokenMenu, setTokenMenu] = useState<TokenMenuState | null>(null);

  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const canonicalInputRef = useRef<HTMLInputElement | null>(null);

  const autoDraft = useMemo(() => buildAutoSeoDraft(path), [path]);
  const routeOptions = useMemo(() => buildRouteOptions(), []);
  const isEditing = editingRuleId !== null;

  const sortedRules = useMemo(() => [...rules].sort((a, b) => a.path.localeCompare(b.path)), [rules]);

  const filteredTokens = useMemo(() => {
    if (!tokenMenu) return [];
    if (!tokenMenu.query) return seoTokens;
    return seoTokens.filter((token) => token.toLowerCase().includes(tokenMenu.query));
  }, [tokenMenu]);

  useEffect(() => {
    let cancelled = false;

    async function loadFromApi() {
      setIsLoading(true);
      try {
        const remoteRules = await fetchSeoRules();
        if (cancelled) return;
        setRules(remoteRules);
        saveSeoRulesToStorage(remoteRules);
      } catch (loadError) {
        if (cancelled) return;
        const message = loadError instanceof Error ? loadError.message : 'Не вдалося завантажити SEO-правила.';
        setError(message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadFromApi();

    return () => {
      cancelled = true;
    };
  }, []);

  function resetForm() {
    setEditingRuleId(null);
    setRouteTemplate('');
    setPath('/');
    setTitle('');
    setDescription('');
    setCanonical('');
    setRobots('index,follow');
    setIncludeInSitemap(true);
    setChangeFrequency('weekly');
    setPriority('0.7');
    setManualTitle(false);
    setManualDescription(false);
    setManualCanonical(false);
    setExpertRobots(false);
    setError('');
    setTokenMenu(null);
  }

  async function persist(next: SeoRule[]) {
    setIsSyncing(true);

    try {
      const saved = await saveSeoRules(next);
      setRules(saved);
      saveSeoRulesToStorage(saved);
      setIsSaved(true);
    } catch (persistError) {
      const message = persistError instanceof Error ? persistError.message : 'Не вдалося зберегти SEO-правила.';
      setError(message);
    } finally {
      setIsSyncing(false);
    }
  }

  function handleRouteTemplateChange(value: string) {
    setRouteTemplate(value);
    if (value) setPath(value);
    setIsSaved(false);
    if (error) setError('');
  }

  function updateTokenMenu(field: TokenField, value: string, cursor: number | null) {
    if (cursor === null) {
      setTokenMenu(null);
      return;
    }
    setTokenMenu(getTokenMenuState(field, value, cursor));
  }

  function getFieldValue(field: TokenField) {
    if (field === 'title') return title;
    if (field === 'description') return description;
    return canonical;
  }

  function setFieldValue(field: TokenField, value: string) {
    if (field === 'title') setTitle(value);
    if (field === 'description') setDescription(value);
    if (field === 'canonical') setCanonical(value);
  }

  function getFieldRef(field: TokenField) {
    if (field === 'title') return titleInputRef.current;
    if (field === 'description') return descriptionInputRef.current;
    return canonicalInputRef.current;
  }

  function insertToken(field: TokenField, token: string) {
    const element = getFieldRef(field);
    const currentValue = getFieldValue(field);
    const cursor = element?.selectionStart ?? currentValue.length;
    const menuState = getTokenMenuState(field, currentValue, cursor);
    const start = menuState?.start ?? cursor;
    const end = menuState?.end ?? cursor;

    const nextValue = `${currentValue.slice(0, start)}${token}${currentValue.slice(end)}`;
    const nextCursor = start + token.length;

    setFieldValue(field, nextValue);
    setIsSaved(false);
    setTokenMenu(null);

    if (element) {
      requestAnimationFrame(() => {
        element.focus();
        element.setSelectionRange(nextCursor, nextCursor);
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedPath = normalizePath(path);
    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();
    const normalizedCanonical = canonical.trim();
    const normalizedPriority = Number(priority.trim());

    if (!normalizedPath.startsWith('/')) {
      setError('Маршрут має починатися з /.');
      return;
    }

    if (manualTitle && !normalizedTitle) {
      setError('Вкажіть Meta title або вимкніть ручне редагування title.');
      return;
    }

    if (manualDescription && !normalizedDescription) {
      setError('Вкажіть Meta description або вимкніть ручне редагування description.');
      return;
    }

    if (manualCanonical && !isValidCanonical(normalizedCanonical)) {
      setError('Canonical має бути відносним (/path) або абсолютним (https://...).');
      return;
    }

    if (!Number.isFinite(normalizedPriority) || normalizedPriority < 0 || normalizedPriority > 1) {
      setError('Sitemap priority має бути числом від 0.0 до 1.0.');
      return;
    }

    const duplicate = rules.find((rule) => rule.path === normalizedPath && rule.id !== editingRuleId);
    if (duplicate) {
      setError('Для цього маршруту вже існує SEO-правило. Відредагуйте існуюче.');
      return;
    }

    const draft = normalizeRule({
      id: editingRuleId ?? `seo_${Date.now()}`,
      path: normalizedPath,
      title: manualTitle ? normalizedTitle : '',
      description: manualDescription ? normalizedDescription : '',
      canonical: manualCanonical ? normalizedCanonical : '',
      robots: expertRobots ? robots : 'index,follow',
      includeInSitemap,
      changeFrequency,
      priority: normalizedPriority,
      updatedAt: new Date().toISOString()
    });

    const next = isEditing ? rules.map((rule) => (rule.id === editingRuleId ? draft : rule)) : [draft, ...rules];

    setError('');
    await persist(next);
    resetForm();
  }

  function handleEdit(rule: SeoRule) {
    setEditingRuleId(rule.id);
    setRouteTemplate(rule.path);
    setPath(rule.path);
    setTitle(rule.title);
    setDescription(rule.description);
    setCanonical(rule.canonical);
    setRobots(rule.robots);
    setIncludeInSitemap(rule.includeInSitemap);
    setChangeFrequency(rule.changeFrequency);
    setPriority(String(rule.priority));

    setManualTitle(Boolean(rule.title));
    setManualDescription(Boolean(rule.description));
    setManualCanonical(Boolean(rule.canonical));
    setExpertRobots(rule.robots === 'noindex,nofollow');

    setError('');
    setIsSaved(false);
    setTokenMenu(null);
  }

  async function handleDelete(ruleId: string) {
    const next = rules.filter((rule) => rule.id !== ruleId);
    await persist(next);
    if (editingRuleId === ruleId) resetForm();
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Admin / SEO</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">SEO-налаштування</h1>
      <p className="mt-3 text-sm text-slate-700 sm:text-base">
        SEO-правила зберігаються у БД і впливають на `sitemap.xml`, `robots.txt` та метадані сторінок.
      </p>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Що формується автоматично</h2>
        <ul className="mt-3 space-y-1 text-sm text-slate-700">
          <li>- `Meta title` (на основі маршруту + секції + бренду).</li>
          <li>- `Meta description` (базовий опис сторінки за типом).</li>
          <li>- `Canonical URL` (канонічний URL для маршруту).</li>
          <li>- `Robots` = `index,follow` (безпечний режим за замовчуванням).</li>
          <li>- `Sitemap`: включення сторінки + `changeFrequency` + `priority`.</li>
        </ul>
        <p className="mt-3 text-sm text-slate-700">Рекомендовано вручну коригувати тільки важливі сторінки та ключові SEO-маршрути.</p>
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Макет формування SEO з БД</h2>
        <ul className="mt-4 space-y-3">
          {seoPageBlueprints.map((item) => (
            <li key={item.routePattern} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p><span className="font-semibold text-slate-900">Тип:</span> {item.pageType}</p>
              <p><span className="font-semibold text-slate-900">Route:</span> {item.routePattern}</p>
              <p><span className="font-semibold text-slate-900">Джерело даних:</span> {item.dataSource}</p>
              <p><span className="font-semibold text-slate-900">Title template:</span> {item.titleTemplate}</p>
              <p><span className="font-semibold text-slate-900">Description template:</span> {item.descriptionTemplate}</p>
              <p><span className="font-semibold text-slate-900">Canonical template:</span> {item.canonicalTemplate}</p>
              <p><span className="font-semibold text-slate-900">SEO поля зображення:</span> {item.imageFields.join(', ')}</p>
              <p><span className="font-semibold text-slate-900">Приклад title:</span> {item.previewTitle}</p>
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div>
          <label htmlFor="seo-route-template" className="block text-sm font-semibold text-slate-900">Швидкий вибір маршруту</label>
          <select
            id="seo-route-template"
            value={routeTemplate}
            onChange={(event) => handleRouteTemplateChange(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
          >
            <option value="">Оберіть зі структури меню</option>
            {routeOptions.map((option) => (
              <option key={option.href} value={option.href}>{option.label} ({option.href})</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="seo-path" className="block text-sm font-semibold text-slate-900">Маршрут сторінки</label>
          <input
            id="seo-path"
            value={path}
            onChange={(event) => {
              setPath(event.target.value);
              setIsSaved(false);
            }}
            placeholder="/blog"
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p><span className="font-semibold text-slate-900">Авто title:</span> {autoDraft.title}</p>
          <p className="mt-1"><span className="font-semibold text-slate-900">Авто description:</span> {autoDraft.description}</p>
          <p className="mt-1"><span className="font-semibold text-slate-900">Авто canonical:</span> {autoDraft.canonical}</p>
          <p className="mt-1"><span className="font-semibold text-slate-900">Авто robots:</span> {autoDraft.robots}</p>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={manualTitle}
              onChange={(event) => {
                setManualTitle(event.target.checked);
                if (!event.target.checked) {
                  setTitle('');
                  setTokenMenu(null);
                }
                setIsSaved(false);
              }}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            Редагувати Meta title вручну
          </label>
          <input
            id="seo-title"
            ref={titleInputRef}
            value={manualTitle ? title : autoDraft.title}
            disabled={!manualTitle}
            onChange={(event) => {
              const nextValue = event.target.value;
              setTitle(nextValue);
              setIsSaved(false);
              updateTokenMenu('title', nextValue, event.target.selectionStart);
            }}
            onClick={(event) => manualTitle && updateTokenMenu('title', event.currentTarget.value, event.currentTarget.selectionStart)}
            onKeyUp={(event) => manualTitle && updateTokenMenu('title', event.currentTarget.value, event.currentTarget.selectionStart)}
            placeholder="[title] | Блог | [Brand]"
            className={`mt-1.5 w-full rounded-xl border p-3 text-sm outline-none transition ${
              manualTitle ? 'border-slate-300 bg-white focus:border-brand' : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
            }`}
          />
          {manualTitle && tokenMenu?.field === 'title' && filteredTokens.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
              {filteredTokens.map((token) => (
                <button
                  key={`title-${token}`}
                  type="button"
                  onClick={() => insertToken('title', token)}
                  className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                >{token}</button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={manualDescription}
              onChange={(event) => {
                setManualDescription(event.target.checked);
                if (!event.target.checked) {
                  setDescription('');
                  setTokenMenu(null);
                }
                setIsSaved(false);
              }}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            Редагувати Meta description вручну
          </label>
          <textarea
            id="seo-description"
            ref={descriptionInputRef}
            value={manualDescription ? description : autoDraft.description}
            disabled={!manualDescription}
            onChange={(event) => {
              const nextValue = event.target.value;
              setDescription(nextValue);
              setIsSaved(false);
              updateTokenMenu('description', nextValue, event.target.selectionStart);
            }}
            onClick={(event) => manualDescription && updateTokenMenu('description', event.currentTarget.value, event.currentTarget.selectionStart)}
            onKeyUp={(event) => manualDescription && updateTokenMenu('description', event.currentTarget.value, event.currentTarget.selectionStart)}
            rows={3}
            placeholder="[description]"
            className={`mt-1.5 w-full rounded-xl border p-3 text-sm outline-none transition ${
              manualDescription ? 'border-slate-300 bg-white focus:border-brand' : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
            }`}
          />
          {manualDescription && tokenMenu?.field === 'description' && filteredTokens.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
              {filteredTokens.map((token) => (
                <button
                  key={`description-${token}`}
                  type="button"
                  onClick={() => insertToken('description', token)}
                  className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                >{token}</button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={manualCanonical}
              onChange={(event) => {
                setManualCanonical(event.target.checked);
                if (!event.target.checked) {
                  setCanonical('');
                  setTokenMenu(null);
                }
                setIsSaved(false);
              }}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            Редагувати Canonical вручну
          </label>
          <input
            id="seo-canonical"
            ref={canonicalInputRef}
            value={manualCanonical ? canonical : autoDraft.canonical}
            disabled={!manualCanonical}
            onChange={(event) => {
              const nextValue = event.target.value;
              setCanonical(nextValue);
              setIsSaved(false);
              updateTokenMenu('canonical', nextValue, event.target.selectionStart);
            }}
            onClick={(event) => manualCanonical && updateTokenMenu('canonical', event.currentTarget.value, event.currentTarget.selectionStart)}
            onKeyUp={(event) => manualCanonical && updateTokenMenu('canonical', event.currentTarget.value, event.currentTarget.selectionStart)}
            placeholder="[domain]/blog"
            className={`mt-1.5 w-full rounded-xl border p-3 text-sm outline-none transition ${
              manualCanonical ? 'border-slate-300 bg-white focus:border-brand' : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
            }`}
          />
          {manualCanonical && tokenMenu?.field === 'canonical' && filteredTokens.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
              {filteredTokens.map((token) => (
                <button
                  key={`canonical-${token}`}
                  type="button"
                  onClick={() => insertToken('canonical', token)}
                  className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                >{token}</button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={expertRobots}
              onChange={(event) => {
                setExpertRobots(event.target.checked);
                if (!event.target.checked) setRobots('index,follow');
                setIsSaved(false);
              }}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            Режим експерта: редагувати Robots
          </label>
          <select
            id="seo-robots"
            value={expertRobots ? robots : 'index,follow'}
            disabled={!expertRobots}
            onChange={(event) => {
              setRobots(event.target.value as SeoRobotsValue);
              setIsSaved(false);
            }}
            className={`mt-1.5 w-full rounded-xl border p-3 text-sm outline-none transition ${
              expertRobots ? 'border-slate-300 bg-white focus:border-brand' : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500'
            }`}
          >
            <option value="index,follow">index,follow</option>
            <option value="noindex,nofollow">noindex,nofollow</option>
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
            <span className="block font-semibold text-slate-900">Sitemap: включення</span>
            <span className="mt-1 block text-xs text-slate-600">Якщо вимкнено, сторінка не потрапить у sitemap.xml.</span>
            <input
              type="checkbox"
              checked={includeInSitemap}
              onChange={(event) => {
                setIncludeInSitemap(event.target.checked);
                setIsSaved(false);
              }}
              className="mt-3 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
          </label>

          <label className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
            <span className="block font-semibold text-slate-900">Change frequency</span>
            <span className="mt-1 block text-xs text-slate-600">Рекомендована частота оновлення сторінки для пошуковиків.</span>
            <select
              value={changeFrequency}
              onChange={(event) => {
                setChangeFrequency(event.target.value as SitemapChangeFrequency);
                setIsSaved(false);
              }}
              className="mt-3 w-full rounded-xl border border-slate-300 p-2 text-sm outline-none transition focus:border-brand"
            >
              {sitemapFrequencies.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
            <span className="block font-semibold text-slate-900">Priority (0.0 - 1.0)</span>
            <span className="mt-1 block text-xs text-slate-600">Пріоритет URL у sitemap.xml.</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={priority}
              onChange={(event) => {
                setPriority(event.target.value);
                setIsSaved(false);
              }}
              className="mt-3 w-full rounded-xl border border-slate-300 p-2 text-sm outline-none transition focus:border-brand"
            />
          </label>
        </div>

        {isLoading ? <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">Завантаження SEO-правил з БД...</p> : null}
        {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
        {isSaved ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">SEO-правило збережено у БД.</p> : null}

        <div className="flex items-center justify-end gap-2">
          {isEditing ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
            >
              Скасувати редагування
            </button>
          ) : null}
          <button
            type="submit"
            disabled={isSyncing}
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSyncing ? 'Збереження...' : isEditing ? 'Зберегти зміни' : 'Додати правило'}
          </button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Збережені правила</h2>
          <p className="text-xs font-semibold text-slate-600">Усього: {sortedRules.length}</p>
        </div>

        {sortedRules.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Поки що немає жодного SEO-правила.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {sortedRules.map((rule) => {
              const effective = getEffectiveSeo(rule);
              return (
                <li key={rule.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <p><span className="font-semibold text-slate-900">Path:</span> {rule.path}</p>
                  <p><span className="font-semibold text-slate-900">Title:</span> {effective.title}</p>
                  <p><span className="font-semibold text-slate-900">Description:</span> {effective.description}</p>
                  <p><span className="font-semibold text-slate-900">Canonical:</span> {effective.canonical}</p>
                  <p><span className="font-semibold text-slate-900">Robots:</span> {effective.robots}</p>
                  <p><span className="font-semibold text-slate-900">Sitemap:</span> {rule.includeInSitemap ? `yes (${rule.changeFrequency}, ${rule.priority})` : 'no'}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(rule)}
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                    >
                      Редагувати
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDelete(rule.id);
                      }}
                      className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                    >
                      Видалити
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
