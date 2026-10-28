import type { VideoOptimizationJob } from '@/lib/video-optimization-types';

export async function waitForVideoOptimization(job: VideoOptimizationJob, onProgress?: (message: string) => void) {
  let current = job;
  const started = Date.now();
  while (current.status === 'queued' || current.status === 'running') {
    onProgress?.(current.status === 'queued' ? 'Відео в черзі на оптимізацію...' : 'Сервер оптимізує відео. Це може тривати кілька хвилин...');
    if (Date.now() - started > 30 * 60 * 1000) throw new Error('Обробка триває на сервері. Перевірте результат у розділі «Оптимізація відео» в медіафайлах.');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const response = await fetch(`/api/admin/video-optimization?id=${encodeURIComponent(job.id)}`, { cache: 'no-store' });
    const payload = await response.json() as { ok?: boolean; job?: VideoOptimizationJob; error?: string };
    if (!response.ok || !payload.ok || !payload.job) throw new Error(payload.error || 'Не вдалося перевірити оптимізацію. Вона може продовжуватися на сервері.');
    current = payload.job;
  }
  if (current.status === 'failed' || !current.outputUrl) throw new Error(`${current.message || 'Не вдалося оптимізувати відео.'} Файл: ${current.originalUrl}`);
  onProgress?.(current.message || 'Відео оптимізовано.');
  return current;
}
