'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useMemo, useState } from 'react';

function normalizeNextPath(raw: string | null): string {
  if (!raw) return '/admin';
  if (!raw.startsWith('/')) return '/admin';
  if (raw.startsWith('//')) return '/admin';
  return raw;
}

type Mode = 'login' | 'register';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => normalizeNextPath(searchParams.get('next')), [searchParams]);

  const [mode, setMode] = useState<Mode>('login');

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [registerLogin, setRegisterLogin] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerDisplayName, setRegisterDisplayName] = useState('');
  const [registerBootstrapToken, setRegisterBootstrapToken] = useState('');
  const [isRegisterSubmitting, setIsRegisterSubmitting] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Не вдалося увійти.');
      }

      router.replace(nextPath);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не вдалося увійти.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsRegisterSubmitting(true);

    try {
      const response = await fetch('/api/admin/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: registerLogin,
          password: registerPassword,
          displayName: registerDisplayName,
          bootstrapToken: registerBootstrapToken
        })
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Не вдалося створити користувача.');
      }

      setSuccess('Admin-користувача створено. Виконуємо вхід...');
      router.replace(nextPath);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не вдалося створити користувача.');
    } finally {
      setIsRegisterSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="w-full max-w-md rounded-3xl border border-brand/25 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Admin</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Безпечний вхід в адмін-панель</h1>
        <p className="mt-2 text-sm text-slate-600">
          Авторизація працює через користувачів у БД та хешовані паролі.
        </p>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
              setSuccess('');
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              mode === 'login' ? 'border-brand bg-brand/10 text-brand' : 'border-slate-300 text-slate-700'
            }`}
          >
            Вхід
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
              setSuccess('');
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              mode === 'register' ? 'border-brand bg-brand/10 text-brand' : 'border-slate-300 text-slate-700'
            }`}
          >
            Реєстрація admin
          </button>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-slate-900">
                Логін
              </label>
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-900">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Вхід...' : 'Увійти'}
            </button>

            <button
              type="button"
              disabled
              title="Потрібно налаштувати GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET."
              className="w-full rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-500"
            >
              Google Sign-In (підготовлено, ще не увімкнено)
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="mt-5 space-y-4">
            <div>
              <label htmlFor="register-login" className="block text-sm font-semibold text-slate-900">
                Логін
              </label>
              <input
                id="register-login"
                value={registerLogin}
                onChange={(event) => setRegisterLogin(event.target.value)}
                placeholder="admin"
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
              />
            </div>

            <div>
              <label htmlFor="register-password" className="block text-sm font-semibold text-slate-900">
                Пароль
              </label>
              <input
                id="register-password"
                type="password"
                value={registerPassword}
                onChange={(event) => setRegisterPassword(event.target.value)}
                placeholder="мінімум 8 символів"
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
              />
            </div>

            <div>
              <label htmlFor="register-display-name" className="block text-sm font-semibold text-slate-900">
                Ім'я (необов'язково)
              </label>
              <input
                id="register-display-name"
                value={registerDisplayName}
                onChange={(event) => setRegisterDisplayName(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
              />
            </div>

            <div>
              <label htmlFor="register-bootstrap" className="block text-sm font-semibold text-slate-900">
                Bootstrap token
              </label>
              <input
                id="register-bootstrap"
                type="password"
                value={registerBootstrapToken}
                onChange={(event) => setRegisterBootstrapToken(event.target.value)}
                placeholder="ADMIN_BOOTSTRAP_TOKEN"
                className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none transition focus:border-brand"
              />
            </div>

            <button
              type="submit"
              disabled={isRegisterSubmitting}
              className="w-full rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRegisterSubmitting ? 'Створення...' : 'Створити admin'}
            </button>
          </form>
        )}

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>
        ) : null}

        {success ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{success}</p>
        ) : null}

        <p className="mt-4 text-xs text-slate-500">
          Повернутись на сайт:{' '}
          <Link href="/" className="font-semibold text-brand hover:underline">
            головна
          </Link>
        </p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="mx-auto min-h-screen max-w-6xl px-4 py-8" />}>
      <LoginPageContent />
    </Suspense>
  );
}
