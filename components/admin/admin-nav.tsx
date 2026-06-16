'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type AuthMePayload = {
  user?: {
    login?: string;
    role?: string;
  };
};

type MessagesPayload = {
  ok?: boolean;
  unprocessedCount?: number;
};

type NavItem = {
  href?: string;
  label: string;
  children?: NavItem[];
  badge?: number | string;
};

function getPathAndHash(value: string) {
  const [path, hash = ''] = value.split('#');
  return { path, hash };
}

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [currentLogin, setCurrentLogin] = useState<string>('');
  const [currentRole, setCurrentRole] = useState<string>('');
  const [unprocessedCount, setUnprocessedCount] = useState<number>(0);
  const [currentHash, setCurrentHash] = useState('');
  const [openGroupKeys, setOpenGroupKeys] = useState<Record<string, string>>({});

  useEffect(() => {
    const syncHash = () => setCurrentHash(window.location.hash.replace(/^#/, ''));
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      try {
        const [authResponse, messagesResponse] = await Promise.all([
          fetch('/api/admin/auth/me', { cache: 'no-store' }),
          fetch('/api/admin/messages?status=new&limit=1', { cache: 'no-store' })
        ]);
        if (cancelled) return;

        const payload = (await authResponse.json()) as AuthMePayload;
        const messagesPayload = (await messagesResponse.json()) as MessagesPayload;
        if (!authResponse.ok) return;

        const login = typeof payload.user?.login === 'string' ? payload.user.login : '';
        const role = typeof payload.user?.role === 'string' ? payload.user.role : '';
        const nextUnprocessedCount =
          messagesResponse.ok && Number.isFinite(messagesPayload.unprocessedCount)
            ? Number(messagesPayload.unprocessedCount)
            : 0;

        setCurrentLogin(login);
        setCurrentRole(role);
        setUnprocessedCount(nextUnprocessedCount);
      } catch {
        // ignore
      }
    }

    void loadMe();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login?next=/admin');
      router.refresh();
      setIsLoggingOut(false);
    }
  }

  const navGroups = useMemo<NavItem[]>(
    () => [
      { href: '/admin', label: 'Dashboard' },
      {
        label: 'Інвентар',
        children: [
          { href: '/admin/inventory', label: 'Огляд' },
          {
            label: 'Товари',
            children: [
              { href: '/admin/inventory/products', label: 'Список товарів' },
              { href: '/admin/inventory/products/create', label: 'Створити товар' },
              { href: '/admin/inventory/products/import', label: 'Імпорт товарів' }
            ]
          },
          {
            label: 'Партії',
            children: [
              { href: '/admin/inventory/batches', label: 'Усі партії' },
              { href: '/admin/inventory/batches/expiring', label: 'Закінчується термін' },
              { href: '/admin/inventory/batches/overdue', label: 'Прострочені' },
              { href: '/admin/inventory/batches/action-required', label: 'Потребують дії' },
              { href: '/admin/inventory/batches/written-off', label: 'Списані' }
            ]
          },
          { href: '/admin/inventory/tasks', label: 'Завдання' },
          { href: '/admin/inventory/employees', label: 'Працівники' },
          { href: '/admin/inventory/actions', label: 'Дії працівників' },
          { href: '/admin/inventory/notifications', label: 'Сповіщення' },
          { href: '/admin/network', label: 'Магазини' },
          { href: '/admin/inventory/analytics', label: 'Аналітика' }
        ]
      },
      {
        label: 'Маркетинг',
        children: [
          { href: '/admin/promotions', label: 'Акції' },
          { href: '/admin/home-slides', label: 'Банери' },
          { href: '/admin/media', label: 'Медіафайли' },
          { href: '/admin/seo', label: 'SEO' }
        ]
      },
      {
        label: 'Контент',
        children: [{ href: '/admin/content', label: 'Статті' }]
      },
      {
        href: '/admin/own-brand',
        label: 'Власне класне'
      },
      {
        href: '/admin/messages',
        label: 'Повідомлення',
        badge: unprocessedCount > 0 ? unprocessedCount : undefined
      },
      {
        label: 'Система',
        children: [
          { href: '/admin/users', label: 'Користувачі' },
          { href: '/admin/integrations', label: 'Інтеграції' },
          {
            label: 'Налаштування',
            children: [
              { href: '/admin/inventory/settings/schema', label: 'Схема' },
              { href: '/admin/inventory/settings/telegram', label: 'Telegram' }
            ]
          }
        ]
      }
    ],
    [unprocessedCount]
  );

  function isItemActive(href?: string) {
    if (!href) return false;
    const { path, hash } = getPathAndHash(href);
    if (path !== pathname) return false;
    if (!hash) return true;
    return currentHash === hash;
  }

  function hasActiveDescendant(item: NavItem): boolean {
    if (isItemActive(item.href)) return true;
    return item.children?.some(hasActiveDescendant) ?? false;
  }

  function clearDescendants(state: Record<string, string>, keyPrefix: string) {
    return Object.fromEntries(Object.entries(state).filter(([key]) => !key.startsWith(`${keyPrefix}:`)));
  }

  function toggleGroup(parentKey: string, itemKey: string) {
    setOpenGroupKeys((prev) => {
      const nextValue = prev[parentKey] === itemKey ? '' : itemKey;
      const nextState = clearDescendants({ ...prev }, itemKey);

      if (!nextValue) {
        delete nextState[parentKey];
        return nextState;
      }

      nextState[parentKey] = nextValue;
      return nextState;
    });
  }

  function handleItemClick(event: React.MouseEvent<HTMLAnchorElement>, href: string) {
    const { path, hash } = getPathAndHash(href);
    if (!hash || path !== pathname) return;

    event.preventDefault();
    const nextUrl = `${path}#${hash}`;
    window.history.pushState(null, '', nextUrl);
    setCurrentHash(hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }

  function renderItems(items: NavItem[], depth = 0, parentKey = 'root') {
    return (
      <ul className={depth === 0 ? 'space-y-1.5' : 'mt-2 space-y-1.5 border-l border-black/5 pl-3.5'}>
        {items.map((item, index) => {
          const active = isItemActive(item.href);
          const itemKey = `${parentKey}:${index}:${item.label}`;
          const isManuallyExpanded = openGroupKeys[parentKey] === itemKey;
          const expanded = hasActiveDescendant(item) || isManuallyExpanded;

          return (
            <li key={`${depth}:${item.label}:${item.href ?? 'group'}`}>
              {item.href ? (
                <Link
                  href={item.href}
                  scroll={false}
                  onClick={(event) => handleItemClick(event, item.href!)}
                  className={`flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-sm transition ${
                    active
                      ? 'border border-amber-200 bg-amber-50/90 font-semibold text-slate-950 shadow-sm'
                      : depth === 0
                        ? 'text-slate-900 hover:bg-black/[0.035]'
                        : 'text-slate-700 hover:bg-black/[0.035]'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge != null ? (
                    <span className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              ) : item.children?.length ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(parentKey, itemKey)}
                  aria-expanded={expanded}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-left text-sm transition ${
                    expanded ? 'bg-black/[0.04] font-semibold text-slate-950' : 'text-slate-900 hover:bg-black/[0.035]'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-slate-400">{expanded ? '−' : '+'}</span>
                </button>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-black/10 bg-slate-50 px-3.5 py-3 text-sm text-slate-400">
                  <span>{item.label}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">Поки ні</span>
                </div>
              )}

              {item.children?.length && expanded ? renderItems(item.children, depth + 1, itemKey) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <nav className="flex max-h-[calc(100vh-3rem)] flex-col rounded-[2rem] border border-black/5 bg-white/88 p-4 shadow-[0_18px_50px_rgba(24,24,18,0.08)] backdrop-blur xl:h-full xl:max-h-[calc(100vh-3rem)]">
      <div className="rounded-[1.5rem] border border-black/5 bg-[linear-gradient(135deg,_rgba(250,249,246,0.96),_rgba(255,255,255,0.92))] px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Admin Panel</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950">Pchilka Control</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Оновлена мінімалістична навігація для поступового переходу на новий інтерфейс.
        </p>
      </div>

      {currentLogin ? (
        <div className="mt-4 rounded-[1.5rem] border border-amber-200/70 bg-amber-50/70 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Session</p>
          <p className="mt-2 text-sm font-semibold text-slate-950">{currentLogin}</p>
          <p className="mt-1 text-xs text-slate-600">{currentRole || 'admin'}</p>
        </div>
      ) : null}

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">{renderItems(navGroups)}</div>

      <div className="mt-4 border-t border-black/5 pt-4">
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full rounded-2xl border border-black/10 bg-slate-950 px-3 py-3 text-sm font-semibold text-white transition enabled:hover:bg-slate-800 disabled:opacity-60"
        >
          {isLoggingOut ? 'Вихід...' : 'Вийти з адмінки'}
        </button>
      </div>
    </nav>
  );
}
