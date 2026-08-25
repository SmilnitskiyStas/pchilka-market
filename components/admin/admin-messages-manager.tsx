'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  incomingRequestStatuses,
  incomingRequestTypes,
  type IncomingRequestRecord,
  type IncomingRequestStatus,
  type IncomingRequestType
} from '@/lib/incoming-requests';

type IncomingRequestsPayload = {
  ok?: boolean;
  error?: string;
  requests?: IncomingRequestRecord[];
};

type AttachmentMetadata = {
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  url?: string;
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('uk-UA');
}

function formatFileSize(value?: number): string {
  if (!value || value <= 0) return '—';
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

function formatRequestType(value: IncomingRequestType): string {
  switch (value) {
    case 'header_feedback':
      return 'Зворотний зв’язок (header)';
    case 'cooperation_general':
      return 'Співпраця: загальна форма';
    case 'cooperation_product':
      return 'Співпраця: запропонувати товар';
    case 'cooperation_search_room':
      return 'Співпраця: шукаємо приміщення';
    case 'cooperation_marketing_services':
      return 'Співпраця: маркетингові послуги';
    case 'cooperation_rental':
      return 'Співпраця: оренда';
    case 'career_application':
      return 'Кар’єра: відгук на вакансію';
    default:
      return value;
  }
}

function formatStatus(value: IncomingRequestStatus): string {
  switch (value) {
    case 'new':
      return 'Нова';
    case 'in_progress':
      return 'В роботі';
    case 'done':
      return 'Завершена';
    case 'spam':
      return 'Спам';
    default:
      return value;
  }
}

function pickAttachment(metadata: IncomingRequestRecord['metadata']): AttachmentMetadata | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = (metadata as Record<string, unknown>).attachment;
  if (!raw || typeof raw !== 'object') return null;

  const data = raw as Record<string, unknown>;
  const rawUrl = typeof data.url === 'string' ? data.url : undefined;
  const normalizedUrl = rawUrl?.startsWith('/uploads/')
    ? `/media/${rawUrl.slice('/uploads/'.length).split('/').map((segment) => encodeURIComponent(segment)).join('/')}`
    : rawUrl;

  return {
    fileName: typeof data.fileName === 'string' ? data.fileName : undefined,
    fileSize: typeof data.fileSize === 'number' ? data.fileSize : undefined,
    fileType: typeof data.fileType === 'string' ? data.fileType : undefined,
    url: normalizedUrl
  };
}

export default function AdminMessagesManager() {
  const [requests, setRequests] = useState<IncomingRequestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<IncomingRequestRecord | null>(null);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState<'all' | IncomingRequestStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | IncomingRequestType>('all');
  const [query, setQuery] = useState('');
  const activeFiltersRef = useRef({ status: 'all' as 'all' | IncomingRequestStatus, type: 'all' as 'all' | IncomingRequestType, query: '' });
  const isPollingRef = useRef(false);

  const requestTypeOptions = useMemo(() => ['all', ...incomingRequestTypes] as const, []);
  const statusOptions = useMemo(() => ['all', ...incomingRequestStatuses] as const, []);
  const newRequestsCount = requests.filter((request) => request.status === 'new').length;

  async function loadRequests(silent = false) {
    if (silent && isPollingRef.current) return;
    const filters = activeFiltersRef.current;
    if (silent) isPollingRef.current = true;
    else { setIsLoading(true); setError(''); }

    try {
      const params = new URLSearchParams();
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.type !== 'all') params.set('type', filters.type);
      if (filters.query.trim()) params.set('q', filters.query.trim());

      const response = await fetch(`/api/admin/messages?${params.toString()}`, { cache: 'no-store' });
      const payload = (await response.json()) as IncomingRequestsPayload;
      if (!response.ok || !payload.ok || !Array.isArray(payload.requests)) {
        throw new Error(payload.error || 'Не вдалося завантажити повідомлення.');
      }

      setRequests(payload.requests);
      setSelectedRequest((prev) => {
        if (!prev) return prev;
        return payload.requests?.find((item) => item.id === prev.id) ?? null;
      });
    } catch (loadError) {
      if (!silent) setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити повідомлення.');
    } finally {
      if (silent) isPollingRef.current = false;
      else setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadRequests(true);
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, []);

  async function applyFilters() {
    activeFiltersRef.current = { status: statusFilter, type: typeFilter, query };
    await loadRequests();
  }

  async function updateStatus(id: string, status: IncomingRequestStatus) {
    setIsUpdatingId(id);
    setError('');
    try {
      const response = await fetch('/api/admin/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(id), status })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; request?: IncomingRequestRecord };
      if (!response.ok || !payload.ok || !payload.request) {
        throw new Error(payload.error || 'Не вдалося змінити статус.');
      }

      setRequests((prev) => prev.map((item) => (item.id === id ? payload.request! : item)));
      setSelectedRequest((prev) => (prev?.id === id ? payload.request! : prev));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Не вдалося змінити статус.');
    } finally {
      setIsUpdatingId(null);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Admin / Повідомлення</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Вхідні заявки з сайту</h1>
      <p className="mt-3 text-sm text-slate-700 sm:text-base">
        Компактний список заявок. Відкривайте деталі лише для потрібного звернення.
      </p>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="grid gap-3 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Статус</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | IncomingRequestStatus)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-2.5 text-sm outline-none focus:border-brand"
            >
              {statusOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Тип</label>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as 'all' | IncomingRequestType)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 p-2.5 text-sm outline-none focus:border-brand"
            >
              {requestTypeOptions.map((item) => (
                <option key={item} value={item}>
                  {item === 'all' ? 'all' : formatRequestType(item)}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Пошук</label>
            <div className="mt-1.5 flex gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ім'я, email, телефон, текст..."
                className="w-full rounded-xl border border-slate-300 p-2.5 text-sm outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={() => void applyFilters()}
                className="rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
              >
                Фільтр
              </button>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>
      ) : null}

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold text-slate-900">Список заявок</h2><p className="mt-0.5 text-xs text-slate-500">Оновлюється автоматично кожні 5 секунд.</p></div>
          <div className="text-right text-xs font-semibold text-slate-600"><p>Усього: {requests.length}</p>{newRequestsCount > 0 ? <p className="mt-1 text-amber-700">Нові: {newRequestsCount}</p> : null}</div>
        </div>

        {isLoading ? <p className="mt-4 text-sm text-slate-600">Завантаження...</p> : null}

        {!isLoading && requests.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">Заявок поки немає.</p>
        ) : null}

        {!isLoading && requests.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {requests.map((item) => (
              <li key={item.id} className={`rounded-xl border p-3 ${item.status === 'new' ? 'border-amber-300 bg-amber-50 shadow-sm ring-1 ring-amber-100' : item.status === 'in_progress' ? 'border-sky-300 bg-sky-50 shadow-sm ring-1 ring-sky-100' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-slate-900">{formatRequestType(item.requestType)}</p>{item.status === 'new' ? <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Нова</span> : null}{item.status === 'in_progress' ? <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">В роботі</span> : null}</div>
                    <p className={`mt-0.5 truncate text-xs ${item.status === 'new' || item.status === 'in_progress' ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                      #{item.id} • {item.fullName || item.contactPerson || item.companyName || item.email || 'без імені'}
                    </p>
                    <p className={`mt-0.5 text-xs ${item.status === 'new' ? 'text-amber-800' : item.status === 'in_progress' ? 'text-sky-800' : 'text-slate-500'}`}>{formatDateTime(item.createdAt)}</p>
                  </div>

                  <div className="w-full sm:w-52">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Статус</label>
                    <select
                      value={item.status}
                      disabled={isUpdatingId === item.id}
                      onChange={(event) => void updateStatus(item.id, event.target.value as IncomingRequestStatus)}
                      className={`mt-1.5 w-full rounded-xl border p-2.5 text-sm outline-none focus:border-brand disabled:opacity-60 ${item.status === 'new' ? 'border-amber-400 bg-white font-semibold text-amber-900' : item.status === 'in_progress' ? 'border-sky-400 bg-white font-semibold text-sky-900' : 'border-slate-300'}`}
                    >
                      {incomingRequestStatuses.map((status) => (
                        <option key={status} value={status}>
                          {formatStatus(status)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedRequest(item)}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                  >
                    Відкрити
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {selectedRequest ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{formatRequestType(selectedRequest.requestType)}</p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">Заявка #{selectedRequest.id}</h3>
                <p className="mt-1 text-xs text-slate-600">Створено: {formatDateTime(selectedRequest.createdAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-brand hover:text-brand"
              >
                Закрити
              </button>
            </div>

            <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              {selectedRequest.fullName ? <p>Ім'я: {selectedRequest.fullName}</p> : null}
              {selectedRequest.contactPerson ? <p>Контактна особа: {selectedRequest.contactPerson}</p> : null}
              {selectedRequest.companyName ? <p>Компанія: {selectedRequest.companyName}</p> : null}
              {selectedRequest.phone ? <p>Телефон: {selectedRequest.phone}</p> : null}
              {selectedRequest.email ? <p>Email: {selectedRequest.email}</p> : null}
              {selectedRequest.city ? <p>Місто: {selectedRequest.city}</p> : null}
              {selectedRequest.vacancy ? <p>Вакансія: {selectedRequest.vacancy}</p> : null}
              {selectedRequest.targetStore ? <p>Локація: {selectedRequest.targetStore}</p> : null}
              {selectedRequest.subject ? <p>Тема: {selectedRequest.subject}</p> : null}
              {selectedRequest.sourcePage ? <p>Сторінка: {selectedRequest.sourcePage}</p> : null}
            </div>

            {selectedRequest.message ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Повідомлення</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{selectedRequest.message}</p>
              </div>
            ) : null}

            {(() => {
              const attachment = pickAttachment(selectedRequest.metadata);
              if (!attachment) return null;

              const canPreviewPdf = Boolean(attachment.url && attachment.fileType?.includes('pdf'));
              const canPreviewImage = Boolean(attachment.url && attachment.fileType?.startsWith('image/'));

              return (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Файл</p>
                  <div className="mt-2 space-y-1 text-sm text-slate-800">
                    <p>Назва: {attachment.fileName || '—'}</p>
                    <p>Розмір: {formatFileSize(attachment.fileSize)}</p>
                    <p>Тип: {attachment.fileType || '—'}</p>
                  </div>

                  {attachment.url ? (
                    <div className="mt-3">
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
                      >
                        Відкрити файл
                      </a>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-amber-700">Для цієї заявки збережено тільки метадані файлу, без вмісту.</p>
                  )}

                  {canPreviewPdf ? <iframe src={attachment.url} className="mt-3 h-80 w-full rounded-lg border border-slate-200" title="PDF preview" /> : null}
                  {canPreviewImage ? <img src={attachment.url} alt={attachment.fileName || 'attachment'} className="mt-3 max-h-80 rounded-lg border border-slate-200 object-contain" /> : null}
                </div>
              );
            })()}

            {selectedRequest.metadata ? (
              <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">Технічні метадані</summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-slate-700">
                  {JSON.stringify(selectedRequest.metadata, null, 2)}
                </pre>
              </details>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
