type StoredEnvelope<T> = {
  updatedAt: string;
  value: T;
};

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readLocalDraft<T>(key: string): T | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredEnvelope<T> | T;
    if (parsed && typeof parsed === 'object' && 'value' in parsed) {
      return (parsed as StoredEnvelope<T>).value;
    }
    return parsed as T;
  } catch {
    return null;
  }
}

export function writeLocalDraft<T>(key: string, value: T) {
  if (!isBrowser()) return;

  try {
    const envelope: StoredEnvelope<T> = {
      updatedAt: new Date().toISOString(),
      value
    };
    window.localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Ignore quota and serialization errors for draft storage.
  }
}

export function removeLocalDraft(key: string) {
  if (!isBrowser()) return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage cleanup errors.
  }
}
