'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { AdminPermission } from '@/lib/admin-permissions';
import { getAdminNavigation, type AdminNavItem as NavItem } from '@/lib/admin-navigation';

type MessagesPayload = {
  ok?: boolean;
  unprocessedCount?: number;
};

function getPathAndHash(value: string) {
  const [path, hash = ''] = value.split('#');
  return { path, hash };
}

export default function AdminNav() {
  const pathname = usePathname();
  const [currentRole, setCurrentRole] = useState<'admin' | 'editor'>('editor');
  const [currentPermissions, setCurrentPermissions] = useState<AdminPermission[]>([]);
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
    void fetch('/api/admin/auth/me', { cache: 'no-store' })
      .then(async (response) => ({ response, payload: await response.json() as { user?: { login?: string; role?: 'admin' | 'editor'; permissions?: AdminPermission[] } } }))
      .then(({ response, payload }) => {
        if (cancelled || !response.ok || !payload.user) return;
        setCurrentRole(payload.user.role ?? 'editor');
        setCurrentPermissions(payload.user.permissions ?? []);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadUnprocessedMessagesCount() {
      try {
        const messagesResponse = await fetch('/api/admin/messages?status=new&limit=1', { cache: 'no-store' });
        if (cancelled) return;

        const messagesPayload = (await messagesResponse.json()) as MessagesPayload;
        const nextUnprocessedCount =
          messagesResponse.ok && Number.isFinite(messagesPayload.unprocessedCount)
            ? Number(messagesPayload.unprocessedCount)
            : 0;

        setUnprocessedCount(nextUnprocessedCount);
      } catch {
        // ignore
      }
    }

    void loadUnprocessedMessagesCount();

    return () => {
      cancelled = true;
    };
  }, []);

  const navGroups = useMemo(() => getAdminNavigation(currentRole, currentPermissions, unprocessedCount), [currentRole, currentPermissions, unprocessedCount]);

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
    const allowedItems = items;
    return (
      <ul className={depth === 0 ? 'space-y-0.5' : 'mt-0.5 space-y-0.5 border-l border-slate-200 pl-2'}>
        {allowedItems.map((item) => {
          const active = isItemActive(item.href);
          const itemKey = `${parentKey}:${item.id || item.href || item.label}`;
          const isManuallyExpanded = openGroupKeys[parentKey] === itemKey;
          const expanded = hasActiveDescendant(item) || isManuallyExpanded;

          return (
            <li key={`${depth}:${item.label}:${item.href ?? 'group'}`}>
              {item.href ? (
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  scroll={false}
                  onClick={(event) => handleItemClick(event, item.href!)}
                  className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[13px] leading-5 transition ${
                    active
                      ? 'bg-brand/10 font-semibold text-brand'
                      : depth === 0
                        ? 'text-slate-900 hover:bg-slate-100'
                        : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge != null ? (
                    <span className="rounded-full border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              ) : item.children?.length ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(parentKey, itemKey)}
                  aria-expanded={expanded}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] leading-5 transition ${
                    expanded ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-900'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-slate-500">{expanded ? '-' : '+'}</span>
                </button>
              ) : (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[13px] leading-5 text-slate-400">
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
    <nav aria-label="Розділи адмінпанелі" className="flex max-h-[calc(100vh-2.5rem)] flex-col rounded-3xl border border-slate-200 bg-white p-2.5 shadow-sm xl:h-full xl:max-h-[calc(100vh-2.5rem)]">
      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">{renderItems(navGroups)}</div>

    </nav>
  );
}
