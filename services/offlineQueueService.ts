
import { getSupabase } from "./supabaseClient";
import { getRealMarketPrices } from "./agro/market";
import { getAgroStateNews } from "./agro/content";
import { getMyChats } from "./chatService";
import { getSessionUser } from "./authService";

interface QueuedAction {
    id: string;
    type: 'SAVE_DIAGNOSIS' | 'SAVE_PLAN' | 'POST_COMMUNITY';
    payload: any;
    timestamp: number;
}

const QUEUE_KEY = 'fasal_offline_queue';

export const addToQueue = (type: QueuedAction['type'], payload: any) => {
    const queue = getQueue();
    const action: QueuedAction = {
        id: crypto.randomUUID(),
        type,
        payload,
        timestamp: Date.now()
    };
    queue.push(action);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    console.log(`[OfflineQueue] Action ${type} queued. Total pending: ${queue.length}`);
};

export const getQueue = (): QueuedAction[] => {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
};

export const clearQueue = () => {
    localStorage.setItem(QUEUE_KEY, '[]');
};

// 1. Sync UP (Client -> Server)
export const syncOfflineQueue = async () => {
    if (!navigator.onLine) return;
    
    const queue = getQueue();
    if (queue.length === 0) return;

    console.log(`[OfflineQueue] Attempting to sync ${queue.length} items...`);
    const supabase = getSupabase();
    if (!supabase) return;

    const remainingItems: QueuedAction[] = [];

    for (const item of queue) {
        try {
            let error = null;
            
            if (item.type === 'SAVE_DIAGNOSIS') {
                const { error: e } = await supabase.from('diagnoses').insert(item.payload);
                error = e;
            } else if (item.type === 'SAVE_PLAN') {
                const { error: e } = await supabase.from('crop_plans').upsert(item.payload);
                error = e;
            } else if (item.type === 'POST_COMMUNITY') {
                const { error: e } = await supabase.from('community_posts').insert(item.payload);
                error = e;
            }

            if (error) {
                console.error(`[OfflineQueue] Sync failed for ${item.id}`, error);
                remainingItems.push(item); // Keep in queue to retry
            } else {
                console.log(`[OfflineQueue] Synced ${item.type}`);
            }
        } catch (e) {
            console.error(`[OfflineQueue] Exception for ${item.id}`, e);
            remainingItems.push(item);
        }
    }

    localStorage.setItem(QUEUE_KEY, JSON.stringify(remainingItems));
    
    if (remainingItems.length === 0) {
        console.log("[OfflineQueue] All items synced successfully.");
    }
};

// 2. Sync DOWN (Server -> Client Cache)
// Fetches fresh data when online so it's ready for next offline session
export const syncDownData = async () => {
    if (!navigator.onLine) return;

    // BANDWIDTH CHECK (Optimization for Slow Networks)
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const isLowBandwidth = connection ? (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') : false;

    if (isLowBandwidth) {
        console.log("[OfflineQueue] Low bandwidth detected. Skipping active background sync.");
        return;
    }

    console.log("[OfflineQueue] Starting downward data sync...");
    
    try {
        const user = await getSessionUser();
        if (!user) return;

        // A. Refresh Market Prices (using forceRefresh implicitly via short TTL or direct call if we modified getRealMarketPrices)
        // Note: getRealMarketPrices has a forceRefresh option we can use if we exposed it, 
        // but by default calling it will refresh if cache expired.
        // We simulate a refresh here by calling it for user's location.
        if (user.location) {
             const { district, state } = user.location;
             if (district && state) {
                 await getRealMarketPrices(district, state, user.crops_grown || []);
             }
        }

        // B. Refresh News
        if (user.location?.state) {
            await getAgroStateNews(user.crops_grown || [], user.location.state, 'en');
        }

        // C. Refresh Chats
        await getMyChats(user.id);

        console.log("[OfflineQueue] Downward sync complete.");
    } catch (e) {
        console.warn("[OfflineQueue] Downward sync failed", e);
    }
};

// Auto-sync on load & network recovery
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        syncOfflineQueue(); // Push pending actions
        syncDownData();     // Pull fresh data
    });
    
    // Initial check
    setTimeout(() => {
        syncOfflineQueue();
        syncDownData();
    }, 5000);
}
