export type InventoryProductRecord = {
  id: string;
  article: string;
  barcode: string;
  barcodes: string[];
  barcodeEntries?: InventoryBarcodeEntry[];
  productName: string;
  unitsOfMeasurement: string;
  category: string;
  notifiedDaysDefault: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventoryProductInput = {
  article?: string;
  barcode?: string;
  barcodes?: string[];
  barcodeEntries?: InventoryBarcodeEntry[];
  productName?: string;
  unitsOfMeasurement?: string;
  category?: string;
  notifiedDaysDefault?: number;
  isActive?: boolean;
};

export type InventoryBarcodeEntry = {
  barcode: string;
  unitsOfMeasurement: string;
};

export function normalizeInventoryBarcode(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/\.0+$/, '');
}

export function parseInventoryBarcodes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => normalizeInventoryBarcode(item)).filter(Boolean)));
  }

  const raw = String(value ?? '').trim();
  if (!raw) return [];

  return Array.from(
    new Set(
      raw
        .split(/[\n,;]+/)
        .map((item) => normalizeInventoryBarcode(item))
        .filter(Boolean)
    )
  );
}

export function parseInventoryBarcodeEntries(
  barcodes: unknown,
  unitsOfMeasurement: unknown,
  fallbackEntries?: unknown
): InventoryBarcodeEntry[] {
  if (Array.isArray(fallbackEntries)) {
    const normalized = fallbackEntries
      .map((item) => {
        const barcode = normalizeInventoryBarcode((item as InventoryBarcodeEntry | null | undefined)?.barcode);
        if (!barcode) return null;

        return {
          barcode,
          unitsOfMeasurement: String((item as InventoryBarcodeEntry | null | undefined)?.unitsOfMeasurement ?? '').trim()
        };
      })
      .filter((item): item is InventoryBarcodeEntry => Boolean(item));

    const deduped = new Map<string, InventoryBarcodeEntry>();
    for (const entry of normalized) {
      deduped.set(entry.barcode, entry);
    }
    return Array.from(deduped.values());
  }

  const normalizedUnits = String(unitsOfMeasurement ?? '').trim();
  return parseInventoryBarcodes(barcodes).map((barcode) => ({
    barcode,
    unitsOfMeasurement: normalizedUnits
  }));
}

export function normalizeInventoryProductInput(raw: InventoryProductInput | null | undefined) {
  const parsedDays = Number(raw?.notifiedDaysDefault ?? 7);
  const normalizedBarcodeEntries = parseInventoryBarcodeEntries(
    raw?.barcodes?.length ? raw?.barcodes : raw?.barcode,
    raw?.unitsOfMeasurement,
    raw?.barcodeEntries
  );
  const normalizedBarcodes = normalizedBarcodeEntries.map((item) => item.barcode);
  const normalizedUnits = String(raw?.unitsOfMeasurement ?? normalizedBarcodeEntries[0]?.unitsOfMeasurement ?? '').trim();

  return {
    article: String(raw?.article ?? '').trim(),
    barcode: normalizedBarcodes[0] ?? '',
    barcodes: normalizedBarcodes,
    barcodeEntries: normalizedBarcodeEntries,
    productName: String(raw?.productName ?? '').trim(),
    unitsOfMeasurement: normalizedUnits,
    category: String(raw?.category ?? '').trim(),
    notifiedDaysDefault: Number.isFinite(parsedDays) ? Math.min(Math.max(Math.round(parsedDays), 1), 90) : 7,
    isActive: raw?.isActive !== false
  };
}
