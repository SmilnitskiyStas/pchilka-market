// Encode Markdown delimiters in media URLs while preserving already escaped paths.
export function insertContentImage(body: string, url: string, start: number, end: number): string {
  const encoded = encodeURI(url).replace(/%25([0-9a-f]{2})/gi, '%$1').replace(/\(/g, '%28').replace(/\)/g, '%29');
  const from = Math.max(0, Math.min(body.length, start));
  const to = Math.max(from, Math.min(body.length, end));
  return `${body.slice(0, from)}\n\n![Зображення|w=640](${encoded})\n\n${body.slice(to)}`;
}
