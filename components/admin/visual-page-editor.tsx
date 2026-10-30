'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { normalizeSlug } from '@/lib/content-entries';
import { visualPageHref, reorderVisualBlocks, type VisualPage, type VisualPageRecord, type VisualBlock, type PageSaveAction } from '@/lib/visual-pages';
import VisualPageBody from '@/components/visual-page-body';
import VisualBlockFields from '@/components/admin/visual-block-fields';
import VisualPagePublishing from '@/components/admin/visual-page-publishing';
import { visualPageTemplates, copyVisualPage } from '@/lib/visual-page-templates';

const emptyPage = (): VisualPage => ({ slug: '', title: '', description: '', blocks: [] });
const blockLabels = { heading: 'Заголовок', text: 'Текст', image: 'Зображення', button: 'Кнопка', columns: 'Дві колонки', banner: 'Банер', video: 'Відео', form: 'Форма оренди' };
const inputClass = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm disabled:bg-slate-100';
const buttonClass = 'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50';

export default function VisualPageEditor({ canWrite, initialSlug = '' }: { canWrite: boolean; initialSlug?: string }) {
  const [pages, setPages] = useState<VisualPageRecord[]>([]);
  const [page, setPage] = useState<VisualPage>(emptyPage);
  const [record, setRecord] = useState<VisualPageRecord | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [manualSlug, setManualSlug] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mobile, setMobile] = useState(false);
  const [reload, setReload] = useState(0);
  const [draggedId, setDraggedId] = useState('');
  const [templateId, setTemplateId] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setReady(false);
      setError('');
      try {
        const response = await fetch('/api/admin/pages', { cache: 'no-store', signal: controller.signal });
        const payload = await response.json();
        if (!response.ok || !payload.ok || !Array.isArray(payload.pages)) throw new Error(payload.error || 'Не вдалося завантажити сторінки.');
        if (controller.signal.aborted) return;
        setPages(payload.pages);
        const found = (payload.pages as VisualPageRecord[]).find((item) => item.draft.slug === initialSlug);
        if (found) {
          setRecord(found); setPage(found.draft); setSelectedId(found.draft.blocks[0]?.id || ''); setManualSlug(true);
        } else if (initialSlug === 'rental-intro') {
          setPage({ slug: 'rental-intro', title: 'Умови оренди', description: '', blocks: [] });
          setManualSlug(true);
        } else if (initialSlug) setError('Сторінку не знайдено. Можна створити нову.');
        setReady(true);
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Не вдалося завантажити сторінки.');
      }
    }
    void load();
    return () => controller.abort();
  }, [initialSlug, reload]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const guardLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
      if (event.target.closest('[data-page-preview]')) return;
      const link = event.target.closest('a');
      if (!link || link.target === '_blank' || link.hasAttribute('download') || link.href === window.location.href) return;
      if (!window.confirm('Є незбережені зміни. Залишити редактор без збереження?')) {
        event.preventDefault(); event.stopPropagation();
      } else {
        window.removeEventListener('beforeunload', warn);
        setDirty(false);
      }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', guardLink, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', guardLink, true); };
  }, [dirty]);

  function open(next: VisualPageRecord | null) {
    if (dirty && !window.confirm('Є незбережені зміни. Залишити їх і відкрити іншу сторінку?')) return;
    setRecord(next); setPage(next ? structuredClone(next.draft) : emptyPage());
    setSelectedId(next?.draft.blocks[0]?.id || ''); setManualSlug(!!next);
    setDirty(false); setError(''); setNotice('');
    window.history.replaceState(null, '', next ? `/admin/pages?slug=${next.draft.slug}` : '/admin/pages');
  }
  function update(next: VisualPage) { setPage(next); setDirty(true); setNotice(''); }
  function addBlock(type: VisualBlock['type']) {
    const id = crypto.randomUUID();
    let block: VisualBlock;
    if (type === 'image') block = { id, type, src: '', alt: '' };
    else if (type === 'columns') block = { id, type, left: '', right: '' };
    else if (type === 'video') block = { id, type, src: '', title: '' };
    else if (type === 'banner') block = { id, type, title: 'Новий банер', text: '', src: '', label: '', href: '' };
    else if (type === 'form') block = { id, type, form: 'rental' };
    else if (type === 'button') block = { id, type, label: 'Дізнатися більше', href: '' };
    else block = { id, type, text: type === 'heading' ? 'Новий заголовок' : '' };
    update({ ...page, blocks: [...page.blocks, block] }); setSelectedId(id);
  }
  const selected = page.blocks.find((block) => block.id === selectedId);
  const selectedIndex = page.blocks.findIndex((block) => block.id === selectedId);
  function updateBlock(block: VisualBlock) {
    setPage((previous) => ({ ...previous, blocks: previous.blocks.map((item) => item.id === block.id ? block : item) }));
    setDirty(true); setNotice('');
  }
  function moveBlock(direction: number) {
    const nextIndex = selectedIndex + direction;
    if (selectedIndex < 0 || nextIndex < 0 || nextIndex >= page.blocks.length) return;
    const blocks = [...page.blocks];
    [blocks[selectedIndex], blocks[nextIndex]] = [blocks[nextIndex], blocks[selectedIndex]];
    update({ ...page, blocks });
  }
  async function save(action: PageSaveAction) {
    if (!canWrite || !ready || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/pages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page, revision: record?.revision ?? 0, action }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не вдалося зберегти сторінку.');
      const saved = payload.page as VisualPageRecord;
      setRecord(saved); setPage(saved.draft); setDirty(false); setManualSlug(true);
      setPages((previous) => [saved, ...previous.filter((item) => item.draft.slug !== saved.draft.slug)]);
      setNotice(action === 'publish' ? 'Сторінку опубліковано.' : action === 'unpublish' ? 'Сторінку знято з публікації. Чернетка збережена.' : 'Чернетку збережено. Опублікована версія не змінилася.');
      window.history.replaceState(null, '', `/admin/pages?slug=${saved.draft.slug}`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Не вдалося зберегти сторінку.'); }
    finally { setBusy(false); }
  }

  async function manage(action: 'rename' | 'restore', value: string | number) {
    if (!record || busy || dirty || !canWrite) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/pages', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, slug: record.draft.slug, revision: record.revision, ...(action === 'rename' ? { newSlug: value } : { restoreRevision: value }) }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не вдалося виконати дію.');
      const saved = payload.page as VisualPageRecord;
      setRecord(saved); setPage(saved.draft); setSelectedId(saved.draft.blocks[0]?.id || '');
      setPages((previous) => [saved, ...previous.filter((item) => item.draft.slug !== record.draft.slug && item.draft.slug !== saved.draft.slug)]);
      setNotice(action === 'rename' ? 'Адресу змінено. Старе посилання перенаправлятиме на нове.' : 'Версію відновлено в чернетку. Для зміни сайту опублікуйте її.');
      window.history.replaceState(null, '', `/admin/pages?slug=${saved.draft.slug}`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Помилка операції.'); }
    finally { setBusy(false); }
  }
  function duplicate() {
    if (dirty && !window.confirm('Створити копію поточного вмісту? Незбережені правки залишаться тільки в копії.')) return;
    const copy = copyVisualPage(page, () => crypto.randomUUID());
    copy.slug = normalizeSlug(copy.title).slice(0, 100).replace(/-+$/, '');
    setRecord(null); setPage(copy); setSelectedId(copy.blocks[0]?.id || ''); setManualSlug(true); setDirty(true); setNotice('Копію створено в редакторі. Перевірте адресу й збережіть чернетку.');
    window.history.replaceState(null, '', '/admin/pages');
  }

  return <div>
    <h1 className="text-2xl font-bold text-slate-900">{page.slug === 'rental-intro' ? 'Оренда: вміст сторінки' : 'Редактор сторінок'}</h1>
    <p className="mt-2 text-sm text-slate-600">Створіть сторінку, додайте блоки й одразу перевірте їхній вигляд. Натисніть на блок у попередньому перегляді, щоб вибрати його для редагування.</p>
    {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
    {!ready ? <div className="mt-4"><p>Завантаження сторінок…</p>{error ? <button className={buttonClass} onClick={() => setReload((value) => value + 1)}>Повторити завантаження</button> : null}</div> : null}
    {notice ? <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{notice}</p> : null}
    <div className="mt-5 flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 text-sm font-semibold">Відкрити сторінку
        <select className={inputClass} disabled={!ready || busy} value={record?.draft.slug || ''} onChange={(event) => open(pages.find((item) => item.draft.slug === event.target.value) || null)}>
          <option value="">Нова сторінка</option>
          {pages.map((item) => <option key={item.draft.slug} value={item.draft.slug}>{item.draft.title} — {item.published ? 'опублікована' : 'чернетка'}</option>)}
        </select>
      </label>
      <button type="button" disabled={!ready || busy || !canWrite} className={buttonClass} onClick={() => open(null)}>Створити сторінку</button>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      <span className="rounded-full bg-slate-100 px-3 py-1">{record?.published ? 'Опублікована + чернетка' : 'Чернетка'}</span>
      {dirty ? <span className="text-amber-800">Є незбережені зміни</span> : null}
      {record ? <>
        <Link className="text-brand underline" href={`${visualPageHref(record.draft.slug)}?preview=1`} target="_blank" rel="noreferrer">Переглянути збережену чернетку</Link>
        {record.published ? <Link className="text-brand underline" href={visualPageHref(record.draft.slug)} target="_blank" rel="noreferrer">Відкрити сторінку</Link> : null}
      </> : null}
    </div>
    <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
      <fieldset disabled={!ready || busy || !canWrite} className="min-w-0 space-y-5 disabled:opacity-70">
        <legend className="sr-only">Налаштування сторінки та блоків</legend>
        <section className="space-y-3 rounded-2xl border border-slate-200 p-3">
          <label className="block text-sm font-semibold">Почати з шаблону<select className={inputClass} value={templateId} onChange={(event) => setTemplateId(event.target.value)}><option value="">Оберіть шаблон</option>{visualPageTemplates.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}</select></label>
          <button type="button" className={buttonClass} disabled={!templateId} onClick={() => {
            const template = visualPageTemplates.find((item) => item.id === templateId);
            if (!template) return;
            if (page.blocks.length && !window.confirm('Замінити блоки поточної чернетки шаблоном?')) return;
            const blocks = structuredClone(template.blocks).map((block) => ({ ...block, id: crypto.randomUUID() }));
            update({ ...page, blocks }); setSelectedId(blocks[0]?.id || '');
          }}>Застосувати шаблон</button>
          <button type="button" className={buttonClass} disabled={!page.title} onClick={duplicate}>Створити копію сторінки</button>
          <p className="text-xs text-slate-500">Будь-яку збережену сторінку можна відкрити та використати як шаблон через створення копії.</p>
        </section>
        <label className="block text-sm font-semibold">Назва сторінки
          <input className={inputClass} maxLength={200} value={page.title} onChange={(event) => update({ ...page, title: event.target.value, slug: !record && !manualSlug ? normalizeSlug(event.target.value) : page.slug })} />
        </label>
        <label className="block text-sm font-semibold">Адреса сторінки: /pages/
          <input className={inputClass} value={page.slug} disabled={!!record || page.slug === 'rental-intro'} maxLength={100} placeholder="nova-storinka" onChange={(event) => { setManualSlug(true); update({ ...page, slug: normalizeSlug(event.target.value) }); }} />
          <span className="mt-1 block text-xs font-normal text-slate-500">{record ? 'Адреса зафіксована після першого збереження.' : 'Адреса формується з назви; її можна змінити перед першим збереженням.'}</span>
        </label>
        <label className="block text-sm font-semibold">Опис для пошуку
          <textarea className={inputClass} maxLength={500} rows={2} value={page.description} onChange={(event) => update({ ...page, description: event.target.value })} />
        </label>
        <VisualPagePublishing key={`${record?.draft.slug || 'new'}-${record?.revision || 0}`} page={page} record={record} dirty={dirty} onChange={update} onManage={(action, value) => void manage(action, value)} />
        <section className="rounded-2xl border border-slate-200 p-3">
          <h2 className="font-semibold">Додати блок</h2>
          <div className="mt-3 flex flex-wrap gap-2">{Object.entries(blockLabels).map(([type, label]) => <button key={type} type="button" className={buttonClass} disabled={page.blocks.length >= 100 || (type === 'form' && page.blocks.some((block) => block.type === 'form'))} onClick={() => addBlock(type as VisualBlock['type'])}>+ {label}</button>)}</div>
          <ol className="mt-4 space-y-2">{page.blocks.map((block, index) => <li key={block.id} onDragOver={(event) => { if (draggedId && canWrite && !busy) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); if (draggedId && canWrite && !busy) { update({ ...page, blocks: reorderVisualBlocks(page.blocks, draggedId, block.id) }); setDraggedId(''); } }}><button type="button" draggable={canWrite && ready && !busy} onDragStart={(event) => { setDraggedId(block.id); event.dataTransfer.setData('text/plain', block.id); event.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDraggedId('')} aria-label={String(index + 1) + '. ' + blockLabels[block.type] + '. Перетягніть або використайте кнопки Вище та Нижче'} aria-pressed={selectedId === block.id} className={`w-full rounded-xl border p-2 text-left text-sm ${selectedId === block.id ? 'border-brand bg-brand/10' : 'border-slate-200'}`} onClick={() => setSelectedId(block.id)}>{index + 1}. {blockLabels[block.type]}: {'text' in block ? block.text.slice(0, 40) : block.type === 'image' ? block.alt || 'Без опису' : block.type === 'button' ? block.label : block.type === 'video' ? block.title : block.type === 'columns' ? 'Ліва та права' : 'Запит на оренду'}</button></li>)}</ol>
          {!page.blocks.length ? <p className="mt-3 text-sm text-slate-500">Додайте перший блок.</p> : null}
        </section>
        {selected ? <section className="space-y-3 rounded-2xl border border-brand/30 p-3">
          <h2 className="font-semibold">{blockLabels[selected.type]}</h2>
          <VisualBlockFields key={selected.id} block={selected} onChange={updateBlock} onBusy={setBusy} />
          <div className="flex flex-wrap gap-2">
            <button className={buttonClass} disabled={selectedIndex === 0} onClick={() => moveBlock(-1)}>↑ Вище</button>
            <button className={buttonClass} disabled={selectedIndex === page.blocks.length - 1} onClick={() => moveBlock(1)}>↓ Нижче</button>
            <button className={`${buttonClass} text-red-700`} onClick={() => { update({ ...page, blocks: page.blocks.filter((block) => block.id !== selectedId) }); setSelectedId(''); }}>Прибрати блок</button>
          </div>
        </section> : null}
        <div className="flex flex-wrap gap-2">
          <button className={buttonClass} onClick={() => void save('save')}>Зберегти чернетку</button>
          <button className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white" onClick={() => void save('publish')}>{record?.published ? 'Опублікувати зміни' : 'Опублікувати сторінку'}</button>
          {record?.published ? <button className={`${buttonClass} text-red-700`} onClick={() => void save('unpublish')}>Зняти з публікації</button> : null}
        </div>
        {busy ? <p role="status">Виконується операція…</p> : null}
      </fieldset>
      <section className="min-w-0 lg:sticky lg:top-5 lg:self-start">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Попередній перегляд</h2>
          <div className="flex gap-2"><button className={buttonClass} aria-pressed={!mobile} onClick={() => setMobile(false)}>Комп’ютер</button><button className={buttonClass} aria-pressed={mobile} onClick={() => setMobile(true)}>Телефон</button></div>
        </div>
        <div className="max-h-[80vh] overflow-auto rounded-2xl bg-slate-100 p-3 sm:p-5">
          <div data-page-preview className="mx-auto transition-[max-width]" style={{ maxWidth: mobile ? 375 : '100%' }} onClick={(event) => {
            if (event.target instanceof Element) {
              if (event.target.closest('a')) event.preventDefault();
              const block = event.target.closest('[data-page-block]');
              if (block && !busy) setSelectedId(block.getAttribute('data-page-block') || '');
            }
          }}>
            <VisualPageBody page={page} selectedBlockId={selectedId} editing />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">Це вміст сторінки. Шапка та підвал сайту додаються при відкритті сторінки. Посилання в цьому перегляді вибирають блок для редагування.</p>
      </section>
    </div>
  </div>;
}
