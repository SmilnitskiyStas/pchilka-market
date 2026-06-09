'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

export type PizzaItem = {
  name: string;
  weight: string;
  ingredients: string;
  imageUrl: string | null;
  bju: string | null;
  calories: string | null;
};

type PizzaMenuGridProps = {
  items: PizzaItem[];
};

export default function PizzaMenuGrid({ items }: PizzaMenuGridProps) {
  const [selected, setSelected] = useState<PizzaItem | null>(null);

  useEffect(() => {
    if (!selected) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelected(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected]);

  return (
    <>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((pizza) => (
          <li key={`${pizza.name}_${pizza.weight}`}>
            <button
              type="button"
              onClick={() => setSelected(pizza)}
              className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition duration-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:border-brand"
            >
              {pizza.imageUrl ? (
                <div className="relative h-36 overflow-hidden bg-slate-50">
                  <Image
                    src={pizza.imageUrl}
                    alt={`${pizza.name} ${pizza.weight}`.trim()}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    quality={60}
                    className="object-contain p-2"
                  />
                </div>
              ) : null}

              <div className="p-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  {pizza.name} {pizza.weight ? <span className="text-slate-600">{pizza.weight}</span> : null}
                </h3>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {selected ? (
        <div className="fixed inset-0 z-[220] bg-slate-900/45 p-4" onClick={() => setSelected(null)}>
          <div
            className="mx-auto mt-6 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:mt-10 sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {selected.name} {selected.weight ? <span className="text-slate-600">{selected.weight}</span> : null}
                </h3>
                <p className="mt-1 text-sm text-slate-600">Детальна інформація про піцу</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
              >
                Закрити
              </button>
            </div>

            {selected.imageUrl ? (
              <div className="relative mt-4 h-56 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:h-72">
                <Image
                  src={selected.imageUrl}
                  alt={`${selected.name} ${selected.weight}`.trim()}
                  fill
                  sizes="(max-width: 640px) 100vw, 768px"
                  quality={70}
                  priority
                  className="object-contain p-3"
                />
              </div>
            ) : null}

            <div className="mt-4 space-y-3 text-sm text-slate-800">
              <p>
                <span className="font-semibold">Склад:</span>{' '}
                {selected.ingredients || 'Дані по складу додаються.'}
              </p>
              <p>
                <span className="font-semibold">БЖУ:</span> {selected.bju ?? 'Дані додаються.'}
              </p>
              <p>
                <span className="font-semibold">Калорійність:</span> {selected.calories ?? 'Дані додаються.'}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
