'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ADMIN_PERMISSION_OPTIONS, type AdminAction, type AdminPermission } from '@/lib/admin-permissions';

type AdminUserView = {
  id: number;
  login: string;
  displayName: string | null;
  role: 'admin' | 'editor';
  permissions: AdminPermission[];
  authProvider: 'local' | 'google';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

type CurrentUser = {
  id: number | null;
  login: string;
  role: 'admin' | 'editor';
};

type UsersPayload = {
  users: AdminUserView[];
  currentUser: CurrentUser;
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('uk-UA');
}

export default function AdminUsersManager() {
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'admin' | 'editor'>('editor');
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [permissionDrafts, setPermissionDrafts] = useState<Record<number, AdminPermission[]>>({});
  const [savingPermissionsId, setSavingPermissionsId] = useState<number | null>(null);

  async function loadUsers() {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/users', { cache: 'no-store' });
      const payload = (await response.json()) as { ok?: boolean; error?: string } & Partial<UsersPayload>;
      if (!response.ok || !payload.ok || !Array.isArray(payload.users) || !payload.currentUser) {
        throw new Error(payload.error || 'Не вдалося завантажити користувачів.');
      }

      setUsers(payload.users);
      setPermissionDrafts(Object.fromEntries(payload.users.map((user) => [user.id, user.permissions ?? []])));
      setCurrentUser(payload.currentUser);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити користувачів.');
    } finally {
      setIsLoading(false);
    }
  }

  function togglePermission(userId: number, permission: AdminPermission, enabled: boolean) {
    setPermissionDrafts((previous) => {
      const current = previous[userId] ?? [];
      return { ...previous, [userId]: enabled ? [...new Set([...current, permission])] : current.filter((value) => value !== permission) };
    });
  }

  async function savePermissions(userId: number) {
    setError('');
    setSuccess('');
    setSavingPermissionsId(userId);
    try {
      const response = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, permissions: permissionDrafts[userId] ?? [] }) });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не вдалося зберегти доступи.');
      setSuccess('Доступи оновлено. Для застосування змін користувачеві потрібно увійти повторно.');
      await loadUsers();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не вдалося зберегти доступи.');
    } finally {
      setSavingPermissionsId(null);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsCreating(true);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login,
          password,
          displayName,
          role
        })
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Не вдалося створити користувача.');
      }

      setLogin('');
      setPassword('');
      setDisplayName('');
      setRole('editor');
      setSuccess('Користувача створено.');
      await loadUsers();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Не вдалося створити користувача.');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(userId: number) {
    setError('');
    setSuccess('');
    setDeletingId(userId);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Не вдалося видалити користувача.');
      }

      setSuccess('Користувача видалено.');
      await loadUsers();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Не вдалося видалити користувача.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Admin / Користувачі</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Доступи до адмін-панелі</h1>
      <p className="mt-3 text-sm text-slate-700 sm:text-base">
        Додавайте нових користувачів та керуйте доступом до адмінки.
      </p>

      {currentUser ? (
        <div className="mt-4 rounded-xl border border-brand/30 bg-brand/5 px-3 py-2 text-sm font-semibold text-slate-800">
          Ви залогінені як: <span className="text-brand">{currentUser.login}</span> ({currentUser.role})
        </div>
      ) : null}

      <form onSubmit={handleCreate} className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Створити користувача</h2>

        <div>
          <label htmlFor="user-login" className="block text-sm font-semibold text-slate-900">Логін</label>
          <input
            id="user-login"
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            placeholder="new.admin"
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
            required
          />
        </div>

        <div>
          <label htmlFor="user-password" className="block text-sm font-semibold text-slate-900">Пароль</label>
          <input
            id="user-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="мінімум 8 символів"
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
            required
          />
        </div>

        <div>
          <label htmlFor="user-display-name" className="block text-sm font-semibold text-slate-900">Ім'я (необов'язково)</label>
          <input
            id="user-display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
          />
        </div>

        <div>
          <label htmlFor="user-role" className="block text-sm font-semibold text-slate-900">Роль</label>
          <select
            id="user-role"
            value={role}
            onChange={(event) => setRole(event.target.value as 'admin' | 'editor')}
            className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
          >
            <option value="editor">editor</option>
            <option value="admin">admin</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isCreating}
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCreating ? 'Створення...' : 'Додати користувача'}
        </button>
      </form>

      {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
      {success ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{success}</p> : null}

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Список користувачів</h2>
          <p className="text-xs font-semibold text-slate-600">Усього: {users.length}</p>
        </div>

        {isLoading ? <p className="mt-3 text-sm text-slate-600">Завантаження...</p> : null}

        {!isLoading && users.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Користувачів поки немає.</p>
        ) : null}

        {!isLoading && users.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {users.map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{item.login}</p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Роль: {item.role} • Провайдер: {item.authProvider} • Статус: {item.isActive ? 'active' : 'inactive'}
                </p>
                <p className="mt-1 text-xs text-slate-600">Останній вхід: {formatDate(item.lastLoginAt)}</p>
                <p className="mt-1 text-xs text-slate-600">Створено: {formatDate(item.createdAt)}</p>

                {item.role === 'admin' ? (
                  <p className="mt-3 rounded-lg bg-brand/10 px-2 py-1.5 text-xs font-semibold text-brand">Повний доступ адміністратора</p>
                ) : (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold text-slate-900">Доступи до модулів</p>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full min-w-[450px] text-xs">
                        <thead className="text-left text-slate-500"><tr><th className="pb-1">Модуль</th>{(['read', 'write', 'delete'] as AdminAction[]).map((action) => <th key={action} className="pb-1 text-center">{action === 'read' ? 'Перегляд' : action === 'write' ? 'Редагування' : 'Видалення'}</th>)}</tr></thead>
                        <tbody>{ADMIN_PERMISSION_OPTIONS.filter(({ resource }) => resource !== 'users' && resource !== 'system').map(({ resource, label }) => <tr key={resource} className="border-t border-slate-100"><td className="py-1.5 pr-3">{label}</td>{(['read', 'write', 'delete'] as AdminAction[]).map((action) => { const permission = `${resource}:${action}` as AdminPermission; return <td key={action} className="py-1.5 text-center"><input type="checkbox" checked={(permissionDrafts[item.id] ?? []).includes(permission)} onChange={(event) => togglePermission(item.id, permission, event.target.checked)} /></td>; })}</tr>)}</tbody>
                      </table>
                    </div>
                    <button type="button" onClick={() => void savePermissions(item.id)} disabled={savingPermissionsId === item.id} className="mt-3 rounded-full border border-brand px-3 py-1 text-xs font-semibold text-brand disabled:opacity-60">{savingPermissionsId === item.id ? 'Збереження...' : 'Зберегти доступи'}</button>
                  </div>
                )}

                <div className="mt-2">
                  <button
                    type="button"
                    disabled={deletingId === item.id || currentUser?.id === item.id}
                    onClick={() => handleDelete(item.id)}
                    className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 transition enabled:hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingId === item.id ? 'Видалення...' : currentUser?.id === item.id ? 'Поточний користувач' : 'Видалити'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
