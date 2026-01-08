
// IndexedDB Wrapper for persistent translation caching
// This allows the PWA to work offline and saves massive API costs

const DB_NAME = 'fasal-translations-db';
const STORE_NAME = 'translations';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

const getDB = (): Promise<IDBDatabase> => {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };

        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onerror = (event) => {
            console.error("Translation DB Error", event);
            reject((event.target as IDBOpenDBRequest).error);
        };
    });

    return dbPromise;
};

export interface CachedTranslation {
    key: string;
    data: any;
    timestamp: number;
}

// TTL: 7 Days for translations (Languages don't change often)
const TTL = 1000 * 60 * 60 * 24 * 7; 

export const getCachedTranslation = async (id: string, lang: string): Promise<any | null> => {
    try {
        const db = await getDB();
        const key = `${id}_${lang}`;
        
        return new Promise((resolve) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onsuccess = () => {
                const result = request.result as CachedTranslation;
                if (result && (Date.now() - result.timestamp < TTL)) {
                    resolve(result.data);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => resolve(null);
        });
    } catch (e) {
        return null;
    }
};

export const saveCachedTranslation = async (id: string, lang: string, data: any): Promise<void> => {
    try {
        const db = await getDB();
        const key = `${id}_${lang}`;
        const entry: CachedTranslation = { key, data, timestamp: Date.now() };

        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.put(entry);
    } catch (e) {
        console.warn("Failed to cache translation", e);
    }
};

export const getCacheSize = async (): Promise<number> => {
    try {
        const db = await getDB();
        return new Promise((resolve) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const countRequest = store.count();
            countRequest.onsuccess = () => resolve(countRequest.result);
            countRequest.onerror = () => resolve(0);
        });
    } catch (e) { return 0; }
};

export const clearCache = async (): Promise<void> => {
    try {
        const db = await getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn("Failed to clear cache", e);
    }
};

export const clearExpiredTranslations = async () => {
    // Optional maintenance function
    try {
        const db = await getDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
            if (cursor) {
                if (Date.now() - cursor.value.timestamp > TTL) {
                    cursor.delete();
                }
                cursor.continue();
            }
        };
    } catch (e) {}
};
