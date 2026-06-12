function toBase64UrlFromBuffer(src: string): string | null {
  const isNodeRuntime =
    typeof process !== 'undefined' &&
    typeof process.versions === 'object' &&
    process.versions !== null &&
    typeof process.versions.node === 'string';

  if (!isNodeRuntime || typeof Buffer === 'undefined') {
    return null;
  }

  try {
    return Buffer.from(src, 'utf8').toString('base64url');
  } catch {
    return null;
  }
}

function toBase64UrlFromBrowser(src: string): string {
  const bytes = new TextEncoder().encode(src);
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function buildSiteImageProxyUrl(src: string, cacheKey?: string): string {
  if (!src.startsWith('/media/') && !src.startsWith('/img/') && !src.startsWith('http://') && !src.startsWith('https://')) {
    return src;
  }

  const ref = toBase64UrlFromBuffer(src) ?? toBase64UrlFromBrowser(src);
  const suffix = cacheKey ? `&v=${encodeURIComponent(cacheKey)}` : '';
  return `/api/site-image?ref=${encodeURIComponent(ref)}${suffix}`;
}
