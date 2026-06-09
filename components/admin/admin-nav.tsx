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
          { href: '/admin/banners', label: 'Банери' },
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
      <ul className={depth === 0 ? 'space-y-1.5' : 'mt-1 space-y-1 border-l border-slate-200 pl-3'}>
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
                  className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    active
                      ? 'bg-brand/10 font-semibold text-brand'
                      : depth === 0
                        ? 'text-slate-900 hover:bg-slate-100'
                        : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge != null ? (
                    <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              ) : item.children?.length ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(parentKey, itemKey)}
                  aria-expanded={expanded}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    expanded ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-900'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-slate-500">{expanded ? '-' : '+'}</span>
                </button>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-400">
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
    <nav className="flex max-h-[calc(100vh-2.5rem)] flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:h-full xl:max-h-[calc(100vh-2.5rem)]">
      {currentLogin ? (
        <div className="rounded-2xl border border-brand/20 bg-brand/5 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Admin Session</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{currentLogin}</p>
          <p className="mt-1 text-xs text-slate-600">{currentRole || 'admin'}</p>
        </div>
      ) : null}

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">{renderItems(navGroups)}</div>

      <div className="mt-4 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition enabled:hover:border-red-400 enabled:hover:text-red-700 disabled:opacity-60"
        >
          {isLoggingOut ? 'Вихід...' : 'Вийти з адмінки'}
        </button>
      </div>
    </nav>
  );
}
