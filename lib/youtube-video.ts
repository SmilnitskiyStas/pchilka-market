const youtubeHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);

export function isYouTubeUrl(value: string): boolean {
  try { return youtubeHosts.has(new URL(value).hostname); } catch { return false; }
}

// Build a player URL from a video ID; never embed arbitrary user-supplied URLs.
export function getYouTubeEmbedUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !youtubeHosts.has(url.hostname)) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    const short = url.hostname === 'youtu.be' || url.hostname === 'www.youtu.be';
    const id = short && parts.length === 1 ? parts[0]
      : url.pathname === '/watch' ? url.searchParams.get('v')
      : parts.length === 2 && ['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : null;
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    return `https://www.youtube.com/embed/${id}`;
  } catch { return null; }
}


// Accept YouTube's copied embed code without preserving any HTML attributes.
export function getYouTubeInputEmbedUrl(value: string): string | null {
  const input = value.trim();
  if (input.length > 10000) return null;
  if (!input.startsWith('<')) return getYouTubeEmbedUrl(input);
  const iframe = input.match(/^<iframe\b([^>]*)>[\s\S]*<\/iframe\s*>$/i);
  if (!iframe) return null;
  const attributes = iframe[1].matchAll(/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g);
  const sources = [...attributes].filter(attribute => attribute[1].toLowerCase() === 'src');
  if (sources.length !== 1) return null;
  const source = sources[0][2] ?? sources[0][3] ?? sources[0][4] ?? '';
  return getYouTubeEmbedUrl(source.replace(/&amp;/gi, '&'));
}
