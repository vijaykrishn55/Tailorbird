/** Tiny IndexedDB key-value wrapper. Stores: meta, profile, history, cache. Everything stays on this device. */
const DB = 'resume-agent';
const STORES = ['meta', 'profile', 'history', 'variants', 'docs'] as const;
export type StoreName = (typeof STORES)[number];

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    t.oncomplete = () => db.close();
  });
}

export const idbGet = <T>(store: StoreName, key: string) =>
  tx<T | undefined>(store, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>);
export const idbSet = (store: StoreName, key: string, value: unknown) =>
  tx(store, 'readwrite', (s) => s.put(value, key));
export const idbDelete = (store: StoreName, key: string) => tx(store, 'readwrite', (s) => s.delete(key));
export const idbAll = <T>(store: StoreName) =>
  tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);

export async function idbClearAll(): Promise<void> {
  for (const s of STORES) await tx(s, 'readwrite', (st) => st.clear());
}
