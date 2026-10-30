export function isPdfDocumentUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 2000 || /[\s\\\u0000-\u001f]/.test(value)) return false;
  const local = value.startsWith('/') && !value.startsWith('//');
  try {
    const url = new URL(value, 'https://pdf.invalid');
    return (local || (value.startsWith('https://') && !url.username && !url.password)) && /\.pdf$/i.test(url.pathname);
  } catch { return false; }
}
export function createPdfMarkdown(src: string, title: string): string {
  const value = src.trim();
  if (!isPdfDocumentUrl(value)) throw new Error('Вкажіть посилання на PDF-файл від / або https://.');
  const encoded = encodeURI(value).replace(/%25([0-9a-f]{2})/gi, '%$1').replace(/\(/g, '%28').replace(/\)/g, '%29');
  const label = title.trim().replace(/[\[\]\r\n]/g, ' ') || 'PDF-документ';
  return `[${label}](${encoded})`;
}
