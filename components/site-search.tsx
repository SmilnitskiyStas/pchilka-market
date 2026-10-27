'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { mainMenu } from '@/content/menu';

const pages = Array.from(new Map(mainMenu.flatMap((item) => [item, ...(item.children ?? [])])
  .filter((item) => item.href.startsWith('/') && item.href !== '/promotions')
  .map((item) => [item.href, { title: item.label, href: item.href }])).values());

export default function SiteSearch() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isOpen]);

  const normalizedQuery = query.trim().toLocaleLowerCase('uk-UA');
  const results = pages.filter((page) => normalizedQuery.split(/\s+/).every((word) => page.title.toLocaleLowerCase('uk-UA').includes(word)));
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button type="button" className="site-search-trigger" aria-label="Пошук" aria-haspopup="dialog" onClick={() => {
        setQuery('');
        dialogRef.current?.showModal();
        setIsOpen(true);
        inputRef.current?.focus();
      }}>
        <span>Пошук</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 6 6" /></svg>
      </button>
      <dialog ref={dialogRef} className="site-search-dialog" aria-labelledby="site-search-title" onClose={() => setIsOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
        <div className="site-search-panel">
          <div className="site-search-heading">
            <h2 id="site-search-title">Що ви шукаєте?</h2>
            <button type="button" onClick={close} className="site-dialog-close" aria-label="Закрити пошук">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <label htmlFor="site-search-input" className="sr-only">Пошук сторінок сайту</label>
          <input ref={inputRef} id="site-search-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Наприклад, магазини або акції" autoComplete="off" />
          <p className="site-search-hint" aria-live="polite">{normalizedQuery ? `Знайдено сторінок: ${results.length}` : 'Популярні розділи сайту'}</p>
          <ul className="site-search-results">
            {(normalizedQuery ? results : pages.filter((page) => ['/promotions/catalog', '/about/stores', '/loyalty/mobile-app', '/about/contacts'].includes(page.href))).map((page) => (
              <li key={page.href}><Link href={page.href} onClick={close}>{page.title}<span aria-hidden="true">↗</span></Link></li>
            ))}
          </ul>
          {normalizedQuery && results.length === 0 ? <p className="site-search-empty">Нічого не знайдено. Спробуйте іншу назву розділу.</p> : null}
        </div>
      </dialog>
    </>
  );
}
