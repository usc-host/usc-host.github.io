/* Browser storage can be missing or throw (private mode, blocked site data).
   Reads fall back to null and writes fail silently. */
export function readJson<T>(store: Storage | undefined, key: string): T | null {
  try {
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(store: Storage | undefined, key: string, value: unknown) {
  try {
    store?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export function removeKey(store: Storage | undefined, key: string) {
  try {
    store?.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

export const local = typeof window !== 'undefined' ? safe(() => window.localStorage) : undefined;
export const session = typeof window !== 'undefined' ? safe(() => window.sessionStorage) : undefined;

function safe<T>(get: () => T): T | undefined {
  try {
    return get();
  } catch {
    return undefined;
  }
}
