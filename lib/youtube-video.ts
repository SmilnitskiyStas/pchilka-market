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
