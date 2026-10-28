'use client';

import { useEffect, useState } from 'react';
import type { VideoOptimizationJob } from '@/lib/video-optimization-types';

export default function VideoOptimizationHistory({ refreshKey = 0 }: { refreshKey?: number }) {
  const [jobs, setJobs] = useState<VideoOptimizationJob[]>([]);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const active = jobs.some((job) => job.status === 'queued' || job.status === 'running');
  useEffect(() => {
    const controller = new AbortController();
    const load = () => { void fetch('/api/admin/video-optimization', { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error('Не вдалося перевірити обробку відео.');
      if (!controller.signal.aborted) { setJobs(payload.jobs); setError(''); }
    }).catch((e) => { if (!controller.signal.aborted) setError(e.message); }); };
    load(); const timer = active ? setInterval(load, 3000) : null;
    return () => { controller.abort(); if (timer) clearInterval(timer); };
  }, [active, refresh, refreshKey]);
  return <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Оптимізація відео</h2><button type="button" onClick={() => setRefresh((value) => value + 1)} className="rounded-full border px-3 py-1 text-sm">Оновити стан</button></div>
    {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
    {!jobs.length ? <p className="mt-2 text-sm text-slate-500">Завдань поки немає. Увімкніть оптимізацію під час завантаження або оберіть відео нижче.</p> : <ul className="mt-3 space-y-3">{jobs.map((job) => <li key={job.id} className="rounded-xl bg-slate-50 p-3 text-sm">
      <p className="break-all font-semibold">{job.originalUrl.split('/').pop()}</p>
      <p className="mt-1">{{ queued: 'У черзі', running: 'Обробляється', completed: 'Готово', failed: 'Помилка' }[job.status]}{job.originalBytes && job.outputBytes ? ` · ${(job.originalBytes / 1048576).toFixed(2)} → ${(job.outputBytes / 1048576).toFixed(2)} МБ` : ''}</p>
      {job.message ? <p className="mt-1 text-slate-600">{job.message}</p> : null}
      {job.outputUrl ? <a href={job.outputUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-brand underline">{job.outputUrl}</a> : null}
    </li>)}</ul>}
  </section>;
}
