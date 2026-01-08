
// Intelligent Caching & Request Deduplication Layer
// Handles SaaS-level traffic by preventing redundant network calls.

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

// In-memory cache for the current session
const memoryCache = new Map<string, CacheEntry<any>>();

// Tracks in-flight promises to deduplicate simultaneous requests
const inflightRequests = new Map<string, Promise<any>>();

export interface QueryOptions {
    ttl?: number; // Time to live in ms
    persist?: boolean; // Save to localStorage?
    forceRefresh?: boolean; // Ignore cache?
}

const DEFAULT_TTL = 60 * 1000; // 1 Minute default

export const fetchQuery = async <T>(
    key: string,
    fn: () => Promise<T>,
    options: QueryOptions = {}
): Promise<T> => {
    const { ttl = DEFAULT_TTL, persist = false, forceRefresh = false } = options;
    const now = Date.now();

    // 1. Check Memory Cache
    if (!forceRefresh) {
        const memEntry = memoryCache.get(key);
        if (memEntry && (now - memEntry.timestamp < ttl)) {
            return memEntry.data;
        }

        // 2. Check Persistent Storage (if enabled)
        if (persist) {
            const stored = localStorage.getItem(`qc:${key}`);
            if (stored) {
                try {
                    const parsed: CacheEntry<T> = JSON.parse(stored);
                    if (now - parsed.timestamp < ttl) {
                        // Rehydrate memory cache
                        memoryCache.set(key, parsed);
                        return parsed.data;
                    }
                } catch (e) {
                    localStorage.removeItem(`qc:${key}`);
                }
            }
        }
    }

    // 3. Request Deduplication (Join existing in-flight request)
    if (inflightRequests.has(key)) {
        return inflightRequests.get(key);
    }

    // 4. Network Request
    const promise = fn()
        .then((data) => {
            const entry = { data, timestamp: Date.now() };
            
            // Update Caches
            memoryCache.set(key, entry);
            if (persist) {
                try {
                    localStorage.setItem(`qc:${key}`, JSON.stringify(entry));
                } catch (e) {
                    // Handle quota exceeded
                    console.warn("LocalStorage full, clearing old cache");
                    localStorage.clear();
                }
            }
            
            // Remove from flight tracking
            inflightRequests.delete(key);
            return data;
        })
        .catch((err) => {
            inflightRequests.delete(key);
            throw err;
        });

    inflightRequests.set(key, promise);
    return promise;
};

// Clear specific cache key (e.g. on user update)
export const invalidateQuery = (key: string) => {
    memoryCache.delete(key);
    localStorage.removeItem(`qc:${key}`);
};

// Clear all data
export const clearCache = () => {
    memoryCache.clear();
    // Only clear query client keys
    Object.keys(localStorage).forEach(k => {
        if(k.startsWith('qc:')) localStorage.removeItem(k);
    });
};
