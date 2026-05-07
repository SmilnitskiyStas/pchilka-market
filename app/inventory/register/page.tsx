'use client';

import { FormEvent, useEffect, useState } from 'react';

type StoreView = {
  id: string;
  storeCode: string;
  city: string;
  addressLine: string;
};

type ContextPayload = {
  ok?: boolean;
  alreadyRegistered?: boolean;
  user?: {
    id: number;
    name: string;
    surname: string;
    positionTitle?: string;
    role: string;
  } | null;
  tokenPayload?: {
    firstName?: string;
    lastName?: string;
    username?: string;
  };
  stores?: StoreView[];
  positionTitles?: string[];
  error?: string;
};

const CUSTOM_POSITION_VALUE = '__custom_position__';

export default function InventoryRegisterPage() {
  const [token, setToken] = useState('');
  const [stores, setStores] = useState<StoreView[]>([]);
  const [positionTitles, setPositionTitles] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [selectedPositionTitle, setSelectedPositionTitle] = useState('');
  const [customPositionTitle, setCustomPositionTitle] = useState('');
  const [storeId, setStoreId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const url = new URL(window.location.href);
    const tokenFromUrl = url.searchParams.get('token') ?? '';
    setToken(tokenFromUrl);

    async function load() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/inventory/register/context?token=${encodeURIComponent(tokenFromUrl)}`, {
          cache: 'no-store'
        });
        const payload = (await response.json()) as ContextPayload;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || 'Не вдалося підготувати реєстрацію.');
        }

        setStores(payload.stores ?? []);
        setPositionTitles(payload.positionTitles ?? []);
        setAlreadyRegistered(Boolean(payload.alreadyRegistered));
        setName(String(payload.tokenPayload?.firstName ?? ''));
        setSurname(String(payload.tokenPayload?.lastName ?? ''));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Не вдалося підготувати реєстрацію.');
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    const finalPositionTitle =
      selectedPositionTitle === CUSTOM_POSITION_VALUE ? customPositionTitle.trim() : selectedPositionTitle.trim();

    if (!name.trim() || !surname.trim()) {
      setError("Заповніть обов'язкові поля: ім'я та прізвище.");
      setIsSubmitting(false);
      return;
    }
    if (!storeId) {
      setError('Оберіть магазин.');
      setIsSubmitting(false);
      return;
    }
    if (!finalPositionTitle) {
      setError('Оберіть посаду зі списку або вкажіть свій варіант.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/inventory/register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, surname, positionTitle: finalPositionTitle, storeId })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Не вдалося завершити реєстрацію.');
      }

      setSuccess('Реєстрацію завершено. Тепер можна повернутися в Telegram і продовжити роботу.');
      setAlreadyRegistered(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не вдалося завершити реєстрацію.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="w-full max-w-xl rounded-3xl border border-brand/25 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Inventory</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Реєстрація користувача з Telegram</h1>
        <p className="mt-2 text-sm text-slate-600">
          Заповніть дані один раз. Після створення облікового запису доступні базові права працівника, а розширені ролі
          призначаються окремо.
        </p>

        {isLoading ? <p className="mt-4 text-sm text-slate-600">Завантаження...</p> : null}
        {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
        {success ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
            {success}
          </p>
        ) : null}

        {!isLoading && !error && alreadyRegistered ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
              Цей Telegram уже зареєстрований у системі.
            </p>
            {token ? (
              <a
                href={`/inventory/intake?token=${encodeURIComponent(token)}`}
                className="inline-flex rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/5"
              >
                Перейти до внесення нової партії
              </a>
            ) : null}
          </div>
        ) : null}

        {!isLoading && !error && !alreadyRegistered ? (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900">
                Ім&apos;я <span className="text-red-600">*</span>
              </label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900">
                Прізвище <span className="text-red-600">*</span>
              </label>
              <input
                value={surname}
                onChange={(event) => setSurname(event.target.value)}
                required
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900">
                Посада <span className="text-red-600">*</span>
              </label>
              <select
                value={selectedPositionTitle}
                onChange={(event) => setSelectedPositionTitle(event.target.value)}
                required
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
              >
                <option value="">Оберіть посаду</option>
                {positionTitles.map((title) => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
                <option value={CUSTOM_POSITION_VALUE}>Свій варіант</option>
              </select>
              {selectedPositionTitle === CUSTOM_POSITION_VALUE ? (
                <input
                  value={customPositionTitle}
                  onChange={(event) => setCustomPositionTitle(event.target.value)}
                  placeholder="Вкажіть свою посаду"
                  required
                  className="mt-2.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
                />
              ) : null}
              <p className="mt-1 text-xs text-slate-500">
                Якщо введете нову посаду, вона збережеться у спільному списку для наступних реєстрацій.
              </p>
            </div>

            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
              Роль адміністратора магазину не можна вибрати під час самостійної реєстрації.
            </p>

            <div>
              <label className="block text-sm font-semibold text-slate-900">
                Магазин <span className="text-red-600">*</span>
              </label>
              <select
                value={storeId}
                onChange={(event) => setStoreId(event.target.value)}
                required
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
              >
                <option value="">Оберіть магазин</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {[store.storeCode, store.city, store.addressLine].filter(Boolean).join(' | ')}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-xs text-slate-500">Поля з позначкою * є обов&apos;язковими.</p>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:opacity-60"
            >
              {isSubmitting ? 'Збереження...' : 'Завершити реєстрацію'}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
