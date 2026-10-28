'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { defaultOfferProductSettings, type OfferProductSettings, type CooperationDepartment } from '@/lib/offer-product-settings';

const inputClass = 'mt-1 block w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm font-normal';
function move<T>(items: T[], index: number, offset: number) {
  const next = [...items];
  const destination = index + offset;
  if (destination < 0 || destination >= next.length) return next;
  [next[index], next[destination]] = [next[destination], next[index]];
  return next;
}

export default function AdminOfferProductManager() {
  const [settings, setSettings] = useState<OfferProductSettings>(() => structuredClone(defaultOfferProductSettings));
  const [saved, setSaved] = useState<OfferProductSettings>(() => structuredClone(defaultOfferProductSettings));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/admin/cooperation/offer-product', { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не вдалося завантажити сторінку.');
      if (!controller.signal.aborted) { setSettings(payload.settings); setSaved(payload.settings); }
    }).catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Не вдалося завантажити сторінку.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    const loadImages = () => { void fetch('/api/admin/assets', { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json() as { assets?: { url: string }[] };
      if (!controller.signal.aborted) setImages((payload.assets ?? []).map((asset) => asset.url).filter((url) => /\.(png|jpe?g|webp|gif|svg|avif)(\?.*)?$/i.test(url)));
    }).catch(() => {}); };
    loadImages();
    window.addEventListener('focus', loadImages);
    return () => { controller.abort(); window.removeEventListener('focus', loadImages); };
  }, []);

  function update(next: OfferProductSettings) { setSettings(next); setSuccess(''); }
  function patchDepartment(index: number, patch: Partial<CooperationDepartment>) {
    update({ ...settings, departments: settings.departments.map((department, i) => i === index ? { ...department, ...patch } : department) });
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/admin/cooperation/offer-product', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не вдалося зберегти сторінку.');
      setSettings(payload.settings); setSaved(payload.settings); setSuccess('Сторінку збережено. Зміни вже доступні на сайті.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Не вдалося зберегти сторінку.'); }
    finally { setSaving(false); }
  }

  return <div>
    <h1 className="text-2xl font-bold text-slate-900">Співпраця: запропонувати товар</h1>
    <p className="mt-2 text-sm text-slate-600">Змінюйте тексти, ілюстрації, відділи та контакти. Порядок у редакторі відповідає порядку на сайті. Контакти з позначкою «Додати до форми» стають напрямами звернень.</p>
    <Link href="/cooperation/offer-product" target="_blank" className="mt-3 inline-block font-semibold text-brand underline">Переглянути сторінку ↗</Link>
    {loading ? <p role="status" className="mt-4 text-sm">Завантаження...</p> : null}
    {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
    {success ? <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{success}</p> : null}
    <form onSubmit={save} className="mt-5"><fieldset disabled={loading || saving} className="min-w-0 space-y-5 disabled:opacity-60">
      <div className="grid gap-4 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">Заголовок сторінки<input required maxLength={150} className={inputClass} value={settings.pageTitle} onChange={(e) => update({ ...settings, pageTitle: e.target.value })} /></label>
        <label className="text-sm font-semibold">Назва пропозиції<input required maxLength={200} className={inputClass} value={settings.title} onChange={(e) => update({ ...settings, title: e.target.value })} /></label>
        <label className="text-sm font-semibold sm:col-span-2">Вступний текст<textarea rows={5} maxLength={8000} className={inputClass} value={settings.intro} onChange={(e) => update({ ...settings, intro: e.target.value })} /></label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={settings.showForm} onChange={(e) => update({ ...settings, showForm: e.target.checked })} />Показувати форму звернення під контактами</label>
      </div>
      {settings.departments.map((department, departmentIndex) => <section key={department.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Відділ {departmentIndex + 1}: {department.title || 'Новий відділ'}</h2><div className="flex gap-2">
          <button type="button" aria-label={`Підняти відділ ${departmentIndex + 1}`} disabled={departmentIndex === 0} className="rounded-full border px-3 py-1 disabled:opacity-40" onClick={() => update({ ...settings, departments: move(settings.departments, departmentIndex, -1) })}>↑</button>
          <button type="button" aria-label={`Опустити відділ ${departmentIndex + 1}`} disabled={departmentIndex === settings.departments.length - 1} className="rounded-full border px-3 py-1 disabled:opacity-40" onClick={() => update({ ...settings, departments: move(settings.departments, departmentIndex, 1) })}>↓</button>
          <button type="button" className="rounded-full border border-red-300 px-3 py-1 text-sm text-red-700" onClick={() => update({ ...settings, departments: settings.departments.filter((item) => item.id !== department.id) })}>Видалити відділ</button>
        </div></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">Назва відділу<input required maxLength={200} className={inputClass} value={department.title} onChange={(e) => patchDepartment(departmentIndex, { title: e.target.value })} /></label>
          <label className="text-sm font-semibold">Опис відділу<textarea rows={2} maxLength={4000} className={inputClass} value={department.description} onChange={(e) => patchDepartment(departmentIndex, { description: e.target.value })} /></label>
          <div className="space-y-2"><label className="block text-sm font-semibold">Посилання на ілюстрацію<input maxLength={2000} className={inputClass} value={department.imageUrl} onChange={(e) => patchDepartment(departmentIndex, { imageUrl: e.target.value })} /></label>
            {images.length ? <label className="block text-sm">Обрати з медіафайлів<select value="" className={inputClass} onChange={(e) => { if (e.target.value) patchDepartment(departmentIndex, { imageUrl: e.target.value }); }}><option value="">Оберіть зображення</option>{images.map((url) => <option key={url} value={url}>{url}</option>)}</select></label> : null}
            <Link href="/admin/media" target="_blank" className="inline-block text-sm text-brand underline">Завантажити нове зображення в медіафайли ↗</Link>
            <label className="block text-sm font-semibold">Опис зображення<input maxLength={300} className={inputClass} value={department.imageAlt} onChange={(e) => patchDepartment(departmentIndex, { imageAlt: e.target.value })} /></label>
          </div>
          {department.imageUrl ? <img src={department.imageUrl} alt={department.imageAlt || 'Ілюстрація відділу'} className="h-40 w-full rounded-xl bg-white object-contain" /> : null}
        </div>
        <div className="mt-5 space-y-3">{department.contacts.map((contact, contactIndex) => <div key={contact.id} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Контакт {contactIndex + 1}</h3><div className="flex flex-wrap gap-2">
            <button type="button" aria-label={`Підняти контакт ${contactIndex + 1} у відділі ${departmentIndex + 1}`} disabled={contactIndex === 0} className="rounded-full border px-3 py-1 disabled:opacity-40" onClick={() => patchDepartment(departmentIndex, { contacts: move(department.contacts, contactIndex, -1) })}>↑</button>
            <button type="button" aria-label={`Опустити контакт ${contactIndex + 1} у відділі ${departmentIndex + 1}`} disabled={contactIndex === department.contacts.length - 1} className="rounded-full border px-3 py-1 disabled:opacity-40" onClick={() => patchDepartment(departmentIndex, { contacts: move(department.contacts, contactIndex, 1) })}>↓</button>
            <button type="button" className="rounded-full border border-red-300 px-3 py-1 text-sm text-red-700" onClick={() => patchDepartment(departmentIndex, { contacts: department.contacts.filter((item) => item.id !== contact.id) })}>Видалити контакт</button>
          </div></div>
          <div className="grid gap-3 lg:grid-cols-3">
            {(['title', 'name', 'email'] as const).map((field) => <label key={field} className="text-sm font-semibold">{{ title: 'Напрям або посада', name: 'Ім’я менеджера', email: 'Email' }[field]}<input type={field === 'email' ? 'email' : 'text'} required={field === 'email' || field === 'title' && contact.includeInForm} maxLength={field === 'email' ? 254 : field === 'title' ? 300 : 200} className={inputClass} value={contact[field]} onChange={(e) => patchDepartment(departmentIndex, { contacts: department.contacts.map((item) => item.id === contact.id ? { ...item, [field]: e.target.value } : item) })} /></label>)}
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={contact.includeInForm} onChange={(e) => patchDepartment(departmentIndex, { contacts: department.contacts.map((item) => item.id === contact.id ? { ...item, includeInForm: e.target.checked } : item) })} />Додати до форми звернення як напрям</label>
        </div>)}</div>
        <button type="button" disabled={department.contacts.length >= 100} className="mt-4 rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand" onClick={() => patchDepartment(departmentIndex, { contacts: [...department.contacts, { id: crypto.randomUUID(), title: '', name: '', email: '', includeInForm: true }] })}>+ Додати контакт</button>
      </section>)}
      <button type="button" disabled={settings.departments.length >= 20} className="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand" onClick={() => update({ ...settings, departments: [...settings.departments, { id: crypto.randomUUID(), title: '', description: '', imageUrl: '', imageAlt: '', contacts: [] }] })}>+ Додати відділ</button>
      <div className="sticky bottom-3 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"><button type="submit" className="rounded-full bg-brand px-5 py-2.5 font-semibold text-white">{saving ? 'Збереження...' : 'Зберегти сторінку'}</button><button type="button" className="rounded-full border border-slate-300 px-4 py-2 text-sm" onClick={() => { setSettings(structuredClone(saved)); setError(''); setSuccess(''); }}>Скасувати зміни</button></div>
    </fieldset></form>
  </div>;
}
