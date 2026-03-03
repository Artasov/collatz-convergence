const DB_NAME = 'collatz_convergence_explorer_cache';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

interface CacheRecord {
    key: string;
    value: string;
    bytes: number;
    created_at: number;
}

export interface ClientCacheStats {
    entries: number;
    bytes: number;
}

const memoryCache = new Map<string, unknown>();
let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
    if (dbPromise) {
        return dbPromise;
    }
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error ?? new Error('Cannot open IndexedDB.'));
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, {keyPath: 'key'});
            }
        };
        request.onsuccess = () => resolve(request.result);
    });
    return dbPromise;
}

function calculateBytes(payload: string): number {
    return new Blob([payload]).size;
}

export async function readClientCache<T>(key: string): Promise<T | null> {
    if (memoryCache.has(key)) {
        return memoryCache.get(key) as T;
    }
    const db = await openDatabase();
    return new Promise<T | null>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onerror = () => reject(request.error ?? new Error('Cannot read cache entry.'));
        request.onsuccess = () => {
            const record = request.result as CacheRecord | undefined;
            if (!record) {
                resolve(null);
                return;
            }
            const parsed = JSON.parse(record.value) as T;
            memoryCache.set(key, parsed);
            resolve(parsed);
        };
    });
}

export async function writeClientCache<T>(key: string, value: T): Promise<void> {
    memoryCache.set(key, value);
    const db = await openDatabase();
    const serialized = JSON.stringify(value);
    const record: CacheRecord = {
        key,
        value: serialized,
        bytes: calculateBytes(serialized),
        created_at: Date.now(),
    };
    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(record);
        request.onerror = () => reject(request.error ?? new Error('Cannot write cache entry.'));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Cache write transaction failed.'));
    });
}

export async function clearClientCacheStore(): Promise<void> {
    memoryCache.clear();
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        request.onerror = () => reject(request.error ?? new Error('Cannot clear cache.'));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Cache clear transaction failed.'));
    });
}

export async function getClientCacheStats(): Promise<ClientCacheStats> {
    const db = await openDatabase();
    return new Promise<ClientCacheStats>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();
        let entries = 0;
        let bytes = 0;

        request.onerror = () => reject(request.error ?? new Error('Cannot read cache stats.'));
        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) {
                resolve({entries, bytes});
                return;
            }
            const record = cursor.value as CacheRecord;
            entries += 1;
            bytes += record.bytes;
            cursor.continue();
        };
    });
}
