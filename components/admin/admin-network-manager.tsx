'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

import { normalizeSiteProfileSettings, type SiteProfileSettings } from '@/lib/site-profile-settings';
import { normalizeStore, type StoreRecord } from '@/lib/store-types';

function parseMultiline(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AdminNetworkManager() {
  const [settings, setSettings] = useState<SiteProfileSettings>(normalizeSiteProfileSettings(undefined));
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [newCityName, setNewCityName] = useState('');
  const [storeSearchQuery, setStoreSearchQuery] = useState('');
  const [collapsedCityGroups, setCollapsedCityGroups] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const contactPhonesText = useMemo(() => settings.contactPhones.join('\n'), [settings.contactPhones]);
  const contactsPageLinesText = useMemo(() => settings.contactsPageLines.join('\n'), [settings.contactsPageLines]);
  const cityOptions = useMemo(() => {
    const unique = new Set(
      stores
        .map((store) => store.city.trim())
        .filter(Boolean)
    );
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'uk'));
  }, [stores]);
  const workHoursOptions = useMemo(
    () => [
      '08:00-20:00',
      '08:00-21:00',
      '08:00-22:00',
      '09:00-21:00',
      '09:00-22:00',
      '10:00-22:00',
      'Цілодобово'
    ],
    []
  );
  const cityGroups = useMemo(() => {
    const normalizedQuery = storeSearchQuery.trim().toLowerCase();
    const grouped = new Map<string, number[]>();
    stores.forEach((store, index) => {
      if (normalizedQuery) {
        const haystack = [store.storeCode, store.region, store.addressLine].join(' ').toLowerCase();
        if (!haystack.includes(normalizedQuery)) {
          return;
        }
      }

      const key = store.city;
      const list = grouped.get(key) ?? [];
      list.push(index);
      grouped.set(key, list);
    });
    return Array.from(grouped.entries())
      .map(([cityKey, indices]) => ({
        cityKey,
        cityLabel: cityKey || 'Без міста',
        indices
      }))
      .sort((a, b) => a.cityLabel.localeCompare(b.cityLabel, 'uk'));
  }, [storeSearchQuery, stores]);

  useEffect(() => {
    setCollapsedCityGroups((prev) => {
      const next = { ...prev };
      for (const group of cityGroups) {
        const key = getCityGroupKey(group.cityKey);
        if (!(key in next)) {
          next[key] = true;
        }
      }
      return next;
    });
  }, [cityGroups]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const [settingsResponse, storesResponse] = await Promise.all([
          fetch('/api/admin/site-profile', { cache: 'no-store' }),
          fetch('/api/admin/stores', { cache: 'no-store' })
        ]);

        const settingsPayload = (await settingsResponse.json()) as { ok?: boolean; settings?: Partial<SiteProfileSettings>; error?: string };
        const storesPayload = (await storesResponse.json()) as { ok?: boolean; stores?: Partial<StoreRecord>[]; error?: string };

        if (!settingsResponse.ok || !settingsPayload.ok) {
          throw new Error(settingsPayload.error || 'Не вдалося завантажити налаштування контактів.');
        }
        if (!storesResponse.ok || !storesPayload.ok) {
          throw new Error(storesPayload.error || 'Не вдалося завантажити магазини.');
        }

        if (cancelled) return;
        setSettings(normalizeSiteProfileSettings(settingsPayload.settings));
        setStores(Array.isArray(storesPayload.stores) ? storesPayload.stores.map((item) => normalizeStore(item)) : []);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити дані.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateStore(index: number, patch: Partial<StoreRecord>) {
    setStores((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
    setIsSaved(false);
  }

  function removeStore(index: number) {
    setStores((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    setIsSaved(false);
  }

  function createDraftStore(city = ''): StoreRecord {
    return normalizeStore({
      id: `store_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      storeCode: '',
      name: 'Pchilka Market',
      region: '',
      city,
      addressLine: '',
      phone: '',
      latitude: '',
      longitude: '',
      workHours: '',
      isActive: true,
      sortOrder: stores.length
    });
  }

  function addAddressToCity(city: string) {
    setStores((prev) => [...prev, createDraftStore(city)]);
    setIsSaved(false);
  }

  function addCityGroup() {
    const city = newCityName.trim();
    if (!city) {
      setError('Вкажіть назву міста, щоб додати групу.');
      return;
    }

    setError('');
    setStores((prev) => [
      ...prev,
      createDraftStore(city)
    ]);
    setNewCityName('');
    setIsSaved(false);
  }

  function renameCity(currentCity: string, nextCity: string) {
    setStores((prev) => prev.map((item) => (item.city === currentCity ? { ...item, city: nextCity } : item)));
    setIsSaved(false);
  }

  function removeCityGroup(city: string) {
    setStores((prev) => prev.filter((item) => item.city !== city));
    setIsSaved(false);
  }

  function getCityGroupKey(city: string): string {
    return city || '__empty_city__';
  }

  function toggleCityGroup(city: string) {
    const key = getCityGroupKey(city);
    setCollapsedCityGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSaved(false);
    setIsSaving(true);

    const nextSettings = normalizeSiteProfileSettings({
      ...settings,
      contactPhones: parseMultiline(contactPhonesText),
      contactsPageLines: parseMultiline(contactsPageLinesText),
      updatedAt: new Date().toISOString()
    });

    const normalizedStores = stores.map((item, index) => normalizeStore({ ...item, sortOrder: index }));
    const incompleteRows: number[] = [];
    const nextStores: StoreRecord[] = [];

    normalizedStores.forEach((item, index) => {
      const hasCity = Boolean(item.city);
      const hasAddress = Boolean(item.addressLine);

      // Ignore fully empty draft rows, but block saving half-filled ones.
      if (!hasCity && !hasAddress) return;
      if (!hasCity || !hasAddress) {
        incompleteRows.push(index + 1);
        return;
      }

      nextStores.push(item);
    });

    if (incompleteRows.length > 0) {
      setError(`Заповніть місто та адресу для рядків: ${incompleteRows.join(', ')}.`);
      setIsSaving(false);
      return;
    }

    try {
      const [settingsResponse, storesResponse] = await Promise.all([
        fetch('/api/admin/site-profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: nextSettings })
        }),
        fetch('/api/admin/stores', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stores: nextStores })
        })
      ]);

      const settingsPayload = (await settingsResponse.json()) as { ok?: boolean; settings?: Partial<SiteProfileSettings>; error?: string };
      const storesPayload = (await storesResponse.json()) as { ok?: boolean; stores?: Partial<StoreRecord>[]; error?: string };

      if (!settingsResponse.ok || !settingsPayload.ok) {
        throw new Error(settingsPayload.error || 'Не вдалося зберегти налаштування контактів.');
      }
      if (!storesResponse.ok || !storesPayload.ok) {
        throw new Error(storesPayload.error || 'Не вдалося зберегти магазини.');
      }

      setSettings(normalizeSiteProfileSettings(settingsPayload.settings));
      setStores(Array.isArray(storesPayload.stores) ? storesPayload.stores.map((item) => normalizeStore(item)) : []);
      setIsSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не вдалося зберегти дані.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Admin / Мережа</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Контакти та магазини</h1>
      <p className="mt-3 text-sm text-slate-700 sm:text-base">
        Тут редагуються телефони, email, адреси, контент сторінки контактів і повний список магазинів для сторінки "Наші магазини".
      </p>
      {isLoading ? <p className="mt-2 text-sm font-semibold text-slate-600">Завантаження даних з БД...</p> : null}

      <form onSubmit={handleSubmit} className="mt-5 space-y-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <datalist id="store-city-options">
          {cityOptions.map((city) => (
            <option key={city} value={city} />
          ))}
        </datalist>
        <datalist id="store-work-hours-options">
          {workHoursOptions.map((hours) => (
            <option key={hours} value={hours} />
          ))}
        </datalist>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Профіль контактів</h2>

          <div className="grid gap-3 xl:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-900">Назва компанії</label>
              <input
                value={settings.companyName}
                onChange={(event) => {
                  setSettings((prev) => ({ ...prev, companyName: event.target.value }));
                  setIsSaved(false);
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900">Email</label>
              <input
                value={settings.contactEmail}
                onChange={(event) => {
                  setSettings((prev) => ({ ...prev, contactEmail: event.target.value }));
                  setIsSaved(false);
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
              />
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-900">Адреса</label>
              <input
                value={settings.contactAddress}
                onChange={(event) => {
                  setSettings((prev) => ({ ...prev, contactAddress: event.target.value }));
                  setIsSaved(false);
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900">Адреса для карти контактів</label>
              <input
                value={settings.contactsMapAddress}
                onChange={(event) => {
                  setSettings((prev) => ({ ...prev, contactsMapAddress: event.target.value }));
                  setIsSaved(false);
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
              />
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-900">Заголовок сторінки контактів</label>
              <input
                value={settings.contactsPageTitle}
                onChange={(event) => {
                  setSettings((prev) => ({ ...prev, contactsPageTitle: event.target.value }));
                  setIsSaved(false);
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900">Заголовок сторінки "Наші магазини"</label>
              <input
                value={settings.storesPageTitle}
                onChange={(event) => {
                  setSettings((prev) => ({ ...prev, storesPageTitle: event.target.value }));
                  setIsSaved(false);
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
              />
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-900">Заголовок блоку карти магазинів</label>
              <input
                value={settings.storesMapTitle}
                onChange={(event) => {
                  setSettings((prev) => ({ ...prev, storesMapTitle: event.target.value }));
                  setIsSaved(false);
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900">Embed URL карти магазинів (iframe src)</label>
              <input
                value={settings.storesMapEmbedUrl}
                onChange={(event) => {
                  setSettings((prev) => ({ ...prev, storesMapEmbedUrl: event.target.value }));
                  setIsSaved(false);
                }}
                placeholder="https://www.google.com/maps/embed?pb=..."
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
              />
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-900">Телефони (по одному в рядку)</label>
              <textarea
                rows={5}
                value={contactPhonesText}
                onChange={(event) => {
                  setSettings((prev) => ({ ...prev, contactPhones: parseMultiline(event.target.value) }));
                  setIsSaved(false);
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900">Опис сторінки магазинів</label>
              <textarea
                rows={5}
                value={settings.storesPageDescription}
                onChange={(event) => {
                  setSettings((prev) => ({ ...prev, storesPageDescription: event.target.value }));
                  setIsSaved(false);
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900">Блок тексту сторінки контактів (по одному рядку)</label>
            <textarea
              rows={6}
              value={contactsPageLinesText}
              onChange={(event) => {
                setSettings((prev) => ({ ...prev, contactsPageLines: parseMultiline(event.target.value) }));
                setIsSaved(false);
              }}
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand"
            />
          </div>
        </section>

        <section className="space-y-3 border-t border-slate-200 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Список магазинів</h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={storeSearchQuery}
                onChange={(event) => setStoreSearchQuery(event.target.value)}
                placeholder="Пошук: код, регіон, адреса"
                className="min-w-[240px] rounded-xl border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand"
              />
              <input
                value={newCityName}
                onChange={(event) => setNewCityName(event.target.value)}
                list="store-city-options"
                placeholder="Нове місто"
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={addCityGroup}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
              >
                Додати місто
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {cityGroups.map((group) => (
              <article key={group.cityKey || '__empty_city__'} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-[220px] flex-1">
                    <input
                      value={group.cityKey}
                      onChange={(event) => renameCity(group.cityKey, event.target.value)}
                      list="store-city-options"
                      placeholder="Місто *"
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-sm font-semibold outline-none focus:border-brand"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-600">Адрес у місті: {group.indices.length}</p>
                    <button
                      type="button"
                      onClick={() => toggleCityGroup(group.cityKey)}
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                    >
                      {collapsedCityGroups[getCityGroupKey(group.cityKey)] ? 'Розгорнути' : 'Згорнути'}
                    </button>
                    <button
                      type="button"
                      onClick={() => addAddressToCity(group.cityKey)}
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                    >
                      Додати адресу
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCityGroup(group.cityKey)}
                      className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                    >
                      Видалити місто
                    </button>
                  </div>
                </div>

                {collapsedCityGroups[getCityGroupKey(group.cityKey)] ? null : (
                  <div className="mt-3 space-y-2">
                    {group.indices.map((storeIndex) => {
                      const store = stores[storeIndex];
                      if (!store) return null;
                      return (
                        <div key={`${store.id}_${storeIndex}`} className="rounded-lg border border-slate-200 bg-white p-3">
                          <div className="grid gap-2 xl:grid-cols-[180px_minmax(0,1fr)_180px]">
                            <input
                              value={store.storeCode}
                              onChange={(event) => updateStore(storeIndex, { storeCode: event.target.value })}
                              placeholder="Код магазину"
                              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
                            />
                            <input
                              value={store.name}
                              onChange={(event) => updateStore(storeIndex, { name: event.target.value })}
                              placeholder="Назва магазину"
                              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
                            />
                            <input
                              value={store.region}
                              onChange={(event) => updateStore(storeIndex, { region: event.target.value })}
                              placeholder="Регіон"
                              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
                            />
                          </div>

                          <div className="mt-2 grid gap-2 xl:grid-cols-[minmax(0,1fr)_220px_180px]">
                            <input
                              value={store.addressLine}
                              onChange={(event) => updateStore(storeIndex, { addressLine: event.target.value })}
                              placeholder="Адреса *"
                              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
                            />
                            <input
                              value={store.phone}
                              onChange={(event) => updateStore(storeIndex, { phone: event.target.value })}
                              placeholder="Телефон"
                              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
                            />
                            <input
                              value={store.workHours}
                              onChange={(event) => updateStore(storeIndex, { workHours: event.target.value })}
                              list="store-work-hours-options"
                              placeholder="Години роботи"
                              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
                            />
                          </div>

                          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                            <input
                              value={store.latitude}
                              onChange={(event) => updateStore(storeIndex, { latitude: event.target.value })}
                              placeholder="Широта"
                              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
                            />
                            <input
                              value={store.longitude}
                              onChange={(event) => updateStore(storeIndex, { longitude: event.target.value })}
                              placeholder="Довгота"
                              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
                            />
                            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                              <input
                                type="checkbox"
                                checked={store.isActive}
                                onChange={(event) => updateStore(storeIndex, { isActive: event.target.checked })}
                                className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                              />
                              Активний
                            </label>
                          </div>
                          <div className="mt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => removeStore(storeIndex)}
                              className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                            >
                              Видалити адресу
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            ))}
            {stores.length === 0 ? <p className="text-sm text-slate-600">Магазини ще не додано.</p> : null}
            {stores.length > 0 && cityGroups.length === 0 ? (
              <p className="text-sm text-slate-600">За цим пошуком магазини не знайдено.</p>
            ) : null}
          </div>
        </section>

        {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
        {isSaved ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">Дані збережено в БД.</p> : null}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Зберегти
          </button>
        </div>
      </form>
    </div>
  );
}
