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
        label: 'Р†РЅРІРµРЅС‚Р°СЂ',
        children: [
          { href: '/admin/inventory', label: 'РћРіР»СЏРґ' },
          {
            label: 'РўРѕРІР°СЂРё',
            children: [
              { href: '/admin/inventory/products', label: 'РЎРїРёСЃРѕРє С‚РѕРІР°СЂС–РІ' },
              { href: '/admin/inventory/products/create', label: 'РЎС‚РІРѕСЂРёС‚Рё С‚РѕРІР°СЂ' },
              { href: '/admin/inventory/products/import', label: 'Р†РјРїРѕСЂС‚ С‚РѕРІР°СЂС–РІ' }
            ]
          },
          {
            label: 'РџР°СЂС‚С–С—',
            children: [
              { href: '/admin/inventory/batches', label: 'РЈСЃС– РїР°СЂС‚С–С—' },
              { href: '/admin/inventory/batches/expiring', label: 'Р—Р°РєС–РЅС‡СѓС”С‚СЊСЃСЏ С‚РµСЂРјС–РЅ' },
              { href: '/admin/inventory/batches/overdue', label: 'РџСЂРѕСЃС‚СЂРѕС‡РµРЅС–' },
              { href: '/admin/inventory/batches/action-required', label: 'РџРѕС‚СЂРµР±СѓСЋС‚СЊ РґС–С—' },
              { href: '/admin/inventory/batches/written-off', label: 'РЎРїРёСЃР°РЅС–' }
            ]
          },
          { href: '/admin/inventory/tasks', label: 'Р—Р°РІРґР°РЅРЅСЏ' },
          { href: '/admin/inventory/employees', label: 'РџСЂР°С†С–РІРЅРёРєРё' },
          { href: '/admin/inventory/actions', label: 'Р”С–С— РїСЂР°С†С–РІРЅРёРєС–РІ' },
          { href: '/admin/inventory/notifications', label: 'РЎРїРѕРІС–С‰РµРЅРЅСЏ' },
          { href: '/admin/network', label: 'РњР°РіР°Р·РёРЅРё' },
          { href: '/admin/inventory/analytics', label: 'РђРЅР°Р»С–С‚РёРєР°' }
        ]
      },
      {
        label: 'РњР°СЂРєРµС‚РёРЅРі',
        children: [
          { href: '/admin/promotions', label: 'РђРєС†С–С—' },
          { href: '/admin/home-slides', label: 'Р‘Р°РЅРµСЂРё' },
          { href: '/admin/media', label: 'РњРµРґС–Р°С„Р°Р№Р»Рё' },
          { href: '/admin/seo', label: 'SEO' }
        ]
      },
      {
        label: 'РљРѕРЅС‚РµРЅС‚',
        children: [{ href: '/admin/content', label: 'РЎС‚Р°С‚С‚С–' }]
      },
      {
        href: '/admin/own-brand',
        label: 'Р’Р»Р°СЃРЅРµ РєР»Р°СЃРЅРµ'
      },
      {
        href: '/admin/messages',
        label: 'РџРѕРІС–РґРѕРјР»РµРЅРЅСЏ',
        badge: unprocessedCount > 0 ? unprocessedCount : undefined
      },
      {
        label: 'РЎРёСЃС‚РµРјР°',
        children: [
          { href: '/admin/users', label: 'РљРѕСЂРёСЃС‚СѓРІР°С‡С–' },
          { href: '/admin/integrations', label: 'Р†РЅС‚РµРіСЂР°С†С–С—' },
          {
            label: 'РќР°Р»Р°С€С‚СѓРІР°РЅРЅСЏ',
            children: [
              { href: '/admin/inventory/settings/schema', label: 'РЎС…РµРјР°' },
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
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">РџРѕРєРё РЅС–</span>
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
          {isLoggingOut ? 'Р’РёС…С–Рґ...' : 'Р’РёР№С‚Рё Р· Р°РґРјС–РЅРєРё'}
        </button>
      </div>
    </nav>
  );
}
