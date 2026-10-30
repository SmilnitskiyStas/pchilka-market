'use client';

import { useEffect, useState } from 'react';
import { defaultHomeLoyaltyImage, validateHomeLoyaltyImage, type HomeLoyaltyImageSettings } from '@/lib/home-loyalty-image-settings';

const endpoint = '/api/admin/home-slides/loyalty-image';
const field = 'mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm';
export default function HomeLoyaltyImageManager() {
  const [settings, setSettings] = useState<HomeLoyaltyImageSettings>(defaultHomeLoyaltyImage);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  async function load(signal?: AbortSignal) {
    setLoading(true); setError('');
    try {
      const response = await fetch(endpoint, { cache: 'no-store', signal });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не вдалося завантажити налаштування.');
      if (!signal?.aborted) { setSettings(validateHomeLoyaltyImage(payload.settings)); setLoaded(true); }
    } catch (error) { if (!signal?.aborted) setError(error instanceof Error ? error.message : 'Помилка завантаження.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, []);
  function update(value: Partial<HomeLoyaltyImageSettings>) { setSettings(previous => ({ ...previous, ...value })); setSuccess(''); }
  async function upload(file?: File) {
    if (!file || busy) return;
    if (!/\.(png|jpe?g|webp|avif|gif)$/i.test(file.name)) { setError('Оберіть PNG, JPG, WebP, AVIF або GIF.'); return; }
    setBusy(true); setError(''); setSuccess('');
    try {
      const data = new FormData(); data.append('file', file); data.append('folder', 'home/loyalty');
      const response = await fetch('/api/admin/images', { method: 'POST', body: data });
      const payload = await response.json();
      if (!response.ok || !payload.ok || !payload.path) throw new Error(payload.error || 'Не вдалося завантажити файл.');
      update({ src: payload.path });
    } catch (error) { setError(error instanceof Error ? error.message : 'Помилка завантаження файлу.'); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!loaded || busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      const value = validateHomeLoyaltyImage(settings);
      const response = await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: value }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не вдалося зберегти зображення.');
      setSettings(validateHomeLoyaltyImage(payload.settings)); setSuccess('Зображення програми лояльності збережено.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Помилка збереження.'); }
    finally { setBusy(false); }
  }
  let preview: HomeLoyaltyImageSettings | null = null;
  try { preview = validateHomeLoyaltyImage(settings); } catch { /* Incomplete edits are not rendered as image URLs. */ }
  return <section className="mt-6 rounded-2xl border border-brand/30 bg-white p-4 sm:p-6" aria-labelledby="home-loyalty-image-title">
    <h2 id="home-loyalty-image-title" className="text-xl font-bold text-slate-900">Зображення програми лояльності на головній</h2>
    <p className="mt-2 text-sm text-slate-600">Це зображення в блоці «Програма лояльності Пчілка», під головними банерами. Завантажте новий файл або вкажіть його адресу та натисніть «Зберегти зображення». Рекомендований формат — широкий PNG із прозорим тлом.</p>
    {loading ? <p role="status" className="mt-3 text-sm">Завантаження…</p> : null}
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    {success ? <p role="status" className="mt-3 text-sm text-green-700">{success}</p> : null}
    {!loaded && !loading ? <button type="button" onClick={() => void load()} className="mt-3 rounded-full border px-3 py-2 text-sm">Повторити завантаження</button> : null}
    <fieldset disabled={loading || !loaded || busy} className="mt-4 space-y-3">
      <label className="block text-sm font-semibold">Адреса зображення<input value={settings.src} onChange={event => update({ src: event.target.value })} className={field} placeholder="/media/… або https://…" /></label>
      <label className="block text-sm font-semibold">Завантажити нове зображення<input type="file" accept=".png,.jpg,.jpeg,.webp,.avif,.gif" className={field} onChange={event => { void upload(event.target.files?.[0]); event.target.value = ''; }} /></label>
      <label className="block text-sm font-semibold">Опис зображення<input value={settings.alt} maxLength={500} onChange={event => update({ alt: event.target.value })} className={field} /></label>
      {preview ? <img src={preview.src} alt={preview.alt} className="mx-auto block h-auto w-full max-w-3xl" /> : null}
      <div className="flex flex-wrap gap-3"><button type="button" onClick={() => void save()} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white">Зберегти зображення</button><button type="button" onClick={() => { setSettings({ ...defaultHomeLoyaltyImage }); setSuccess(''); }} className="rounded-full border px-4 py-2 text-sm">Повернути початкове зображення</button></div>
    </fieldset>
    {busy ? <p role="status" className="mt-3 text-sm">Завантаження або збереження…</p> : null}
  </section>;
}
