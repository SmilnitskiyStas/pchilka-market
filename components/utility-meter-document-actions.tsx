'use client';

import { useState } from 'react';

type Props = {
  pdfUrl: string;
  excelUrl: string;
  shareApiUrl?: string;
  sharePayload?: Record<string, string>;
};

export function UtilityMeterDocumentActions({ pdfUrl, excelUrl, shareApiUrl, sharePayload }: Props) {
  const [shareStatus, setShareStatus] = useState('');
  const [isGeneratingShareLink, setIsGeneratingShareLink] = useState(false);

  async function copyShareLink() {
    setShareStatus('');

    try {
      let urlToCopy = '';

      if (shareApiUrl) {
        setIsGeneratingShareLink(true);
        const response = await fetch(shareApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sharePayload ?? {})
        });
        const payload = (await response.json()) as { ok?: boolean; url?: string; error?: string };
        if (!response.ok || !payload.ok || !payload.url) {
          throw new Error(payload.error || 'Не вдалося сформувати посилання для перегляду.');
        }
        urlToCopy = payload.url;
      } else {
        urlToCopy = window.location.href;
      }

      await navigator.clipboard.writeText(urlToCopy);
      setShareStatus('Посилання скопійовано.');
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : 'Не вдалося скопіювати посилання.');
    } finally {
      setIsGeneratingShareLink(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <a href={pdfUrl} className="rounded-md bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
          Завантажити PDF
        </a>
        <a href={excelUrl} className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900">
          Завантажити Excel
        </a>
        <button
          type="button"
          onClick={() => { void copyShareLink(); }}
          disabled={isGeneratingShareLink}
          className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-60"
        >
          {isGeneratingShareLink ? 'Формування...' : 'Скопіювати посилання'}
        </button>
      </div>
      {shareStatus ? <div className="mt-3 text-sm font-medium text-slate-700">{shareStatus}</div> : null}
    </section>
  );
}
