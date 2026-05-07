export type StoreRecord = {
  id: string;
  storeCode: string;
  name: string;
  region: string;
  city: string;
  addressLine: string;
  phone: string;
  latitude: string;
  longitude: string;
  workHours: string;
  isActive: boolean;
  sortOrder: number;
};

export function normalizeStore(raw: Partial<StoreRecord>): StoreRecord {
  return {
    id: String(raw.id ?? `store_${Date.now()}`),
    storeCode: String(raw.storeCode ?? '').trim(),
    name: String(raw.name ?? '').trim(),
    region: String(raw.region ?? '').trim(),
    city: String(raw.city ?? '').trim(),
    addressLine: String(raw.addressLine ?? '').trim(),
    phone: String(raw.phone ?? '').trim(),
    latitude: String(raw.latitude ?? '').trim(),
    longitude: String(raw.longitude ?? '').trim(),
    workHours: String(raw.workHours ?? '').trim(),
    isActive: raw.isActive !== false,
    sortOrder: Number.isFinite(raw.sortOrder) ? Number(raw.sortOrder) : 0
  };
}
