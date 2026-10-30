'use client';

import { useEffect, useState } from 'react';
import OwnBrandImageCatalog from '@/components/admin/own-brand-image-catalog';
import OwnBrandPizzaStoresManager from '@/components/admin/own-brand-pizza-stores-manager';

type OwnBrandPizzaRecord = {
  id: string;
  name: string;
  weight: string;
  ingredients: string;
  imageUrl: string;
  bju: string;
  calories: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type Payload = {
  ok?: boolean;
  pizzas?: OwnBrandPizzaRecord[];
  error?: string;
};

function createDraftPizza(nextSortOrder: number): OwnBrandPizzaRecord {
  const now = new Date().toISOString();
  return {
    id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    weight: '',
    ingredients: '',
    imageUrl: '',
    bju: '',
    calories: '',
    sortOrder: nextSortOrder,
    isActive: true,
    createdAt: now,
    updatedAt: now
  };
}

export default function AdminOwnBrandManager() {
  const [pizzas, setPizzas] = useState<OwnBrandPizzaRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [imagePizzaId, setImagePizzaId] = useState<string | null>(null);
  const [expandedPizzaIds, setExpandedPizzaIds] = useState<Set<string>>(() => new Set());

  async function loadPizzas() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/own-brand/pizzas', { cache: 'no-store' });
      const payload = (await response.json()) as Payload;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Не вдалося завантажити список піц.');
      }

      setPizzas(Array.isArray(payload.pizzas) ? payload.pizzas : []);
      setExpandedPizzaIds(new Set());
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити список піц.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPizzas();
  }, []);

  function updatePizza(id: string, field: keyof OwnBrandPizzaRecord, value: string | number | boolean) {
    setSuccess('');
    setPizzas((prev) =>
      prev.map((pizza) =>
        pizza.id === id
          ? {
              ...pizza,
              [field]: value
            }
          : pizza
      )
    );
  }

  function addPizza() {
    const draft = createDraftPizza(pizzas.length);
    setPizzas((prev) => [...prev, draft]);
    setExpandedPizzaIds((prev) => new Set([...prev, draft.id]));
    setSuccess('');
  }

  function removePizza(id: string) {
    setPizzas((prev) => prev.filter((pizza) => pizza.id !== id));
    setExpandedPizzaIds((prev) => new Set([...prev].filter((pizzaId) => pizzaId !== id)));
    if (imagePizzaId === id) setImagePizzaId(null);
    setSuccess('');
  }

  async function savePizzas() {
    if (pizzas.some((pizza) => !pizza.name.trim())) {
      setExpandedPizzaIds((prev) => new Set([...prev, ...pizzas.filter((pizza) => !pizza.name.trim()).map((pizza) => pizza.id)]));
      setError('Укажіть назву для кожної піци перед збереженням.');
      setSuccess('');
      return;
    }
    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/admin/own-brand/pizzas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pizzas: pizzas.map((pizza, index) => ({
            ...pizza,
            sortOrder: Number.isFinite(Number(pizza.sortOrder)) ? Number(pizza.sortOrder) : index
          }))
        })
      });
      const payload = (await response.json()) as Payload;

      if (!response.ok || !payload.ok || !Array.isArray(payload.pizzas)) {
        throw new Error(payload.error || 'Не вдалося зберегти список піц.');
      }

      setPizzas(payload.pizzas);
      setSuccess('Список піц успішно збережено.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не вдалося зберегти список піц.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Admin / Власне класне</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Керування піцами для Піца та кав&apos;ярня</h1>
      <p className="mt-3 text-sm text-slate-700 sm:text-base">
        Тут можна додавати нові піци, редагувати назву, вагу, опис, зображення і порядок показу на сторінці. На сайті показуються активні піци після збереження змін.
      </p>

      <OwnBrandPizzaStoresManager />

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => addPizza()}
          disabled={isLoading || isSaving}
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          Додати піцу
        </button>
        <button
          type="button"
          onClick={() => void savePizzas()}
          disabled={isLoading || isSaving}
          className="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/5 disabled:opacity-60"
        >
          {isSaving ? 'Збереження...' : 'Зберегти зміни'}
        </button>
        <button type="button" disabled={isLoading || !expandedPizzaIds.size} onClick={() => setExpandedPizzaIds(new Set())} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50">Згорнути всі піци</button>
      </div>

      {isLoading ? <p className="mt-4 text-sm text-slate-600">Завантаження...</p> : null}
      {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
      {success ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{success}</p> : null}

      {!isLoading ? (
        <div className="mt-6 space-y-4">
          {pizzas.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
              Поки що жодної піци не додано.
            </div>
          ) : (
            pizzas.map((pizza, index) => (
              <article key={pizza.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="min-w-0 flex-1 text-base font-semibold text-slate-900">
                    <button type="button" aria-expanded={expandedPizzaIds.has(pizza.id)} aria-controls={`pizza-editor-${pizza.id}`} onClick={() => setExpandedPizzaIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(pizza.id)) next.delete(pizza.id); else next.add(pizza.id);
                      return next;
                    })} className="flex w-full items-center gap-3 py-1 text-left">
                      <span aria-hidden="true" className="text-brand">{expandedPizzaIds.has(pizza.id) ? '▼' : '▶'}</span>
                      <span className="min-w-0 break-words">{pizza.name || `Нова піца #${index + 1}`}<span className="ml-2 text-xs font-normal text-slate-500">{pizza.weight}{pizza.isActive ? '' : ' · Неактивна'}</span></span>
                    </button>
                  </h2>
                  <button
                    type="button"
                    onClick={() => removePizza(pizza.id)}
                    className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                  >
                    Видалити
                  </button>
                </div>

                {expandedPizzaIds.has(pizza.id) ? <div id={`pizza-editor-${pizza.id}`} className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-900">
                    Назва
                    <input
                      value={pizza.name}
                      onChange={(event) => updatePizza(pizza.id, 'name', event.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-900">
                    Вага
                    <input
                      value={pizza.weight}
                      onChange={(event) => updatePizza(pizza.id, 'weight', event.target.value)}
                      placeholder="500г"
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
                    />
                  </label>
                  <div className="text-sm font-semibold text-slate-900 md:col-span-2">
                    <label htmlFor={`pizza-image-${pizza.id}`}>
                      Посилання на зображення
                    </label>
                    <input
                      id={`pizza-image-${pizza.id}`}
                      value={pizza.imageUrl}
                      onChange={(event) => updatePizza(pizza.id, 'imageUrl', event.target.value)}
                      placeholder="https://..."
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
                    />
                    <button
                      type="button"
                      onClick={() => setImagePizzaId(pizza.id)}
                      className="mt-2 rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/5"
                    >
                      Обрати з каталогу
                    </button>
                    {pizza.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pizza.imageUrl} alt={pizza.name || 'Зображення піци'} className="mt-3 h-28 w-40 rounded-xl border border-slate-200 bg-white object-contain" />
                    ) : null}
                  </div>
                  <label className="text-sm font-semibold text-slate-900 md:col-span-2">
                    Склад / опис
                    <textarea
                      value={pizza.ingredients}
                      onChange={(event) => updatePizza(pizza.id, 'ingredients', event.target.value)}
                      rows={3}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-900">
                    БЖУ
                    <input
                      value={pizza.bju}
                      onChange={(event) => updatePizza(pizza.id, 'bju', event.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-900">
                    Калорійність
                    <input
                      value={pizza.calories}
                      onChange={(event) => updatePizza(pizza.id, 'calories', event.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-900">
                    Порядок показу
                    <input
                      type="number"
                      value={pizza.sortOrder}
                      onChange={(event) => updatePizza(pizza.id, 'sortOrder', Number(event.target.value))}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <input
                      type="checkbox"
                      checked={pizza.isActive}
                      onChange={(event) => updatePizza(pizza.id, 'isActive', event.target.checked)}
                    />
                    Активна
                  </label>
                </div> : null}
              </article>
            ))
          )}
        </div>
      ) : null}
      {imagePizzaId ? (
        <OwnBrandImageCatalog
          onSelect={(url) => {
            updatePizza(imagePizzaId, 'imageUrl', url);
            setImagePizzaId(null);
          }}
          onClose={() => setImagePizzaId(null)}
        />
      ) : null}
    </div>
  );
}
