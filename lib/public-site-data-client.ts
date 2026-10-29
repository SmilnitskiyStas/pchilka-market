'use client';

type PublicDataUrl = '/api/site/content' | '/api/site/menu' | '/api/admin/seo/rules';
type CachedResponse = { value?: unknown; expiresAt: number; pending?: Promise<unknown> };
const cache = new Map<PublicDataUrl, CachedResponse>();
const TTL_MS = 30_000;

// Only public navigation data is cached, in this browser tab and for a short time.
export function clearPublicSiteData() { cache.clear(); }

export async function fetchPublicSiteData<T>(url: PublicDataUrl, force = false): Promise<T> {
  const existing = cache.get(url);
  if (existing?.pending) return existing.pending as Promise<T>;
  if (!force && existing && existing.expiresAt > Date.now()) return existing.value as T;

  const entry: CachedResponse = { expiresAt: 0 };
  cache.set(url, entry);
  const pending = (async () => {
    try {
      // A shared request outlives route-effect cleanup; the next page can reuse it.
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Public site data: HTTP ${response.status}`);
      const value: unknown = await response.json();
      if (cache.get(url) === entry) { entry.value = value; entry.expiresAt = Date.now() + TTL_MS; }
      return value;
    } catch (error) {
      if (cache.get(url) === entry) cache.delete(url);
      throw error;
    } finally { entry.pending = undefined; }
  })();
  entry.pending = pending;
  return pending as Promise<T>;
}
