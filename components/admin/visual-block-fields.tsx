'use client';

import { useRef, useState } from 'react';
import type { VisualBlock } from '@/lib/visual-pages';

const input = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm';
const button = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50';

function RichField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  function format(prefix: string, suffix = prefix) {
    const start = ref.current?.selectionStart ?? value.length;
    const end = ref.current?.selectionEnd ?? start;
    const selected = value.slice(start, end);
    const inserted = prefix + selected + suffix;
    onChange(value.slice(0, start) + inserted + value.slice(end));
    requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(start + prefix.length, start + prefix.length + selected.length); });
  }
  return <div><label className="block text-sm">{label}<textarea ref={ref} className={input} rows={6} maxLength={30000} value={value} onChange={(event) => onChange(event.target.value)} /></label>
    <div role="group" aria-label={`Форматування: ${label}`} className="mt-2 flex flex-wrap gap-2">
      <button type="button" className={button} onClick={() => format('**')}>Жирний</button>
      <button type="button" className={button} onClick={() => format('_')}>Курсив</button>
      <button type="button" className={button} onClick={() => format('\n- ', '')}>Список</button>
      <button type="button" className={button} onClick={() => format('[', '](/)')}>Посилання</button>
    </div>
  </div>;
}

function MediaField({ value, kind, onChange, onBusy }: { value: string; kind: 'image' | 'video'; onChange: (value: string) => void; onBusy: (value: boolean) => void }) {
  const [items, setItems] = useState<string[] | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const matches = (path: string) => kind === 'video' ? /\.(mp4|webm)(?:[?#]|$)/i.test(path) : /\.(png|jpe?g|webp|avif|gif)(?:[?#]|$)/i.test(path);
  async function library() {
    setBusy(true); onBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/images', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.ok || !Array.isArray(payload.images)) throw new Error('Не вдалося відкрити медіабібліотеку.');
      setItems(payload.images.filter((path: unknown): path is string => typeof path === 'string' && matches(path)).map((path: string) => path.split('/').map((part) => {
        try { return encodeURIComponent(decodeURIComponent(part)); } catch { return encodeURIComponent(part); }
      }).join('/')));
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Помилка медіабібліотеки.'); }
    finally { setBusy(false); onBusy(false); }
  }
  async function upload(file?: File) {
    if (!file) return;
    if (!matches(file.name) || file.size > 50 * 1024 * 1024) { setError('Оберіть підтримуваний файл до 50 МБ.'); return; }
    setBusy(true); onBusy(true); setError('');
    try {
      const data = new FormData(); data.append('file', file); data.append('folder', 'visual-pages');
      const response = await fetch('/api/admin/images', { method: 'POST', body: data });
      const payload = await response.json();
      if (!response.ok || !payload.ok || !payload.path) throw new Error(payload.error || 'Не вдалося завантажити файл. Потрібен доступ до медіафайлів.');
      onChange(payload.path); setItems(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Помилка завантаження.'); }
    finally { setBusy(false); onBusy(false); }
  }
  return <div>
    <label className="block text-sm">{kind === 'video' ? 'Посилання YouTube або відеофайл MP4 / WebM' : 'Зображення'}<input className={input} value={value} placeholder="/media/… або https://…" onChange={(event) => onChange(event.target.value)} /></label>
    {kind === 'video' ? <p className="mt-1 text-xs text-slate-600">Вставте посилання на відео YouTube: youtube.com/watch?v=…, youtu.be/…, Shorts або трансляцію. Також можна обрати чи завантажити MP4 / WebM нижче.</p> : null}
    <fieldset disabled={busy} className="mt-2 flex flex-wrap gap-2"><button type="button" className={button} onClick={() => void library()}>Обрати з бібліотеки</button>
      <label className={`${button} cursor-pointer`}>Завантажити файл<input aria-label="Завантажити медіафайл" type="file" accept={kind === 'video' ? '.mp4,.webm' : '.jpg,.jpeg,.png,.webp,.avif,.gif'} className="sr-only" onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ''; }} /></label>
    </fieldset>
    {busy ? <p role="status" className="mt-2 text-sm">Завантаження…</p> : null}
    {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
    {items ? <section className="mt-3 rounded-xl border border-slate-200 p-2" aria-label="Медіабібліотека">
      <div className="flex items-center justify-between"><h3 className="font-semibold">Медіабібліотека</h3><button type="button" className={button} onClick={() => setItems(null)}>Закрити</button></div>
      <input className={input} aria-label="Пошук медіафайлів" placeholder="Пошук за назвою" value={search} onChange={(event) => setSearch(event.target.value)} />
      <ul className="mt-2 max-h-80 space-y-2 overflow-auto">{items.filter((path) => path.toLowerCase().includes(search.toLowerCase())).map((path) => <li key={path}><button type="button" className="w-full break-all rounded-lg border p-2 text-left text-xs" onClick={() => { onChange(path); setItems(null); }}>
        {kind === 'image' ? <img src={path} alt="" loading="lazy" className="mb-1 h-20 w-full object-contain" /> : null}{path}
      </button></li>)}</ul>
      {!items.filter((path) => path.toLowerCase().includes(search.toLowerCase())).length ? <p className="mt-2 text-sm">{items.length ? 'За вашим запитом нічого не знайдено.' : 'Файлів цього типу ще немає.'}</p> : null}
    </section> : null}
  </div>;
}

export default function VisualBlockFields({ block, onChange, onBusy }: { block: VisualBlock; onChange: (block: VisualBlock) => void; onBusy: (value: boolean) => void }) {
  if (block.type === 'text') return <RichField label="Текст" value={block.text} onChange={(text) => onChange({ ...block, text })} />;
  if (block.type === 'heading') return <label className="block text-sm">Текст заголовка<input className={input} value={block.text} maxLength={30000} onChange={(event) => onChange({ ...block, text: event.target.value })} /></label>;
  if (block.type === 'image') return <><MediaField onBusy={onBusy} value={block.src} kind="image" onChange={(src) => onChange({ ...block, src })} /><label className="block text-sm">Опис зображення<input className={input} value={block.alt} maxLength={500} onChange={(event) => onChange({ ...block, alt: event.target.value })} /></label></>;
  if (block.type === 'video') return <><MediaField onBusy={onBusy} value={block.src} kind="video" onChange={(src) => onChange({ ...block, src })} /><label className="block text-sm">Назва відео<input className={input} value={block.title} maxLength={200} onChange={(event) => onChange({ ...block, title: event.target.value })} /></label></>;
  if (block.type === 'columns') return <><RichField label="Ліва колонка" value={block.left} onChange={(left) => onChange({ ...block, left })} /><RichField label="Права колонка" value={block.right} onChange={(right) => onChange({ ...block, right })} /></>;
  if (block.type === 'form') return <p className="text-sm text-slate-600">Готова форма запиту на оренду. Вона використовує наявні перевірки, вкладення та надсилання заявок. На сторінці оренди форма вже є.</p>;
  if (block.type === 'banner') return <>
    <label className="block text-sm">Заголовок банера<input className={input} value={block.title} maxLength={200} onChange={(event) => onChange({ ...block, title: event.target.value })} /></label>
    <RichField label="Текст банера" value={block.text} onChange={(text) => onChange({ ...block, text })} />
    <MediaField onBusy={onBusy} kind="image" value={block.src} onChange={(src) => onChange({ ...block, src })} />
    <label className="block text-sm">Текст кнопки<input className={input} value={block.label} maxLength={200} onChange={(event) => onChange({ ...block, label: event.target.value })} /></label>
    <label className="block text-sm">Посилання кнопки<input className={input} value={block.href} onChange={(event) => onChange({ ...block, href: event.target.value })} /></label>
  </>;
  return <><label className="block text-sm">Текст кнопки<input className={input} value={block.label} maxLength={200} onChange={(event) => onChange({ ...block, label: event.target.value })} /></label><label className="block text-sm">Посилання<input className={input} value={block.href} onChange={(event) => onChange({ ...block, href: event.target.value })} /></label></>;
}
