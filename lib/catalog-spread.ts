/** Page indexes come from the book engine; the first page is a separate cover. */
export function getCatalogSpread(index: number, total: number, portrait: boolean) {
  const start = Math.min(Math.max(0, index), Math.max(0, total - 1));
  const first = portrait || start === 0 ? start : start % 2 === 0 ? start - 1 : start;
  return { first: first + 1, last: Math.min(total, portrait || first === 0 ? first + 1 : first + 2) };
}

export type CatalogLeaf = { src: string; pdfPage: number; part: 'full' | 'left' | 'right' };

export function buildCatalogLeaves(pages: { src: string; width: number; height: number }[]) {
  if (pages.length === 0) return { leaves: [], ratio: .677 };
  const ratio = Math.min(...pages.map((page) => page.width / page.height));
  const leaves: CatalogLeaf[] = [];
  pages.forEach((page, index) => {
    // Some print PDFs contain a single cover followed by already paired spreads.
    const parts: CatalogLeaf['part'][] = page.width / page.height > ratio * 1.6 ? ['left', 'right'] : ['full'];
    parts.forEach((part) => leaves.push({ src: page.src, pdfPage: index + 1, part }));
  });
  return { leaves, ratio };
}
