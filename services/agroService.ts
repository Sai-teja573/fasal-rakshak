
// BARREL FILE FOR AGRO SERVICES
export * from './agro/utils';
export * from './agro/market';
export * from './agro/content';
export * from './agro/diagnoses';
export * from './agro/community';
export * from './agro/planning';

import { getSupabase, checkSupabaseConnection } from './supabaseClient';
import { addToQueue } from './offlineQueueService';

// --- AGENT PORTAL SERVICES ---

export const submitMandiPrice = async (userId: string, mandiName: string, cropData: any) => {
    const supabase = getSupabase();
    
    // Server-side validation simulation (Mock Logic)
    // In production, this would compare against historical averages in DB
    const avgPrice = 2200; 
    const inputPrice = parseFloat(cropData.modalPrice);
    const isOutlier = inputPrice > avgPrice * 1.15 || inputPrice < avgPrice * 0.85;
    
    // Flag high deviations for admin review instead of auto-verifying
    const entryStatus = isOutlier ? 'Flagged' : 'Verified';

    // Always log to local storage for "pending sync" simulation
    const localLog = JSON.parse(localStorage.getItem('agent_submissions') || '[]');
    const newEntry = {
        id: crypto.randomUUID(),
        user_id: userId,
        mandi: mandiName,
        ...cropData,
        status: entryStatus, 
        timestamp: Date.now()
    };
    localStorage.setItem('agent_submissions', JSON.stringify([newEntry, ...localLog]));

    // Try Cloud Save
    if (supabase && (await checkSupabaseConnection())) {
        try {
            await supabase.from('mandi_entries').insert({
                user_id: userId,
                mandi_name: mandiName,
                crop: cropData.crop,
                variety: cropData.variety,
                price_min: cropData.minPrice,
                price_max: cropData.maxPrice,
                price_modal: cropData.modalPrice,
                quantity: cropData.quantity,
                status: entryStatus // Use the computed status
            });
        } catch (e) {
            // No queue for agents in this demo, just local
            console.warn("Cloud sync failed for agent price, saved locally.");
        }
    }
    
    return true;
};

// Fixed: Now prioritizes Supabase DB fetch over LocalStorage for real agents
export const getAgentHistory = async (userId: string) => {
    const supabase = getSupabase();
    
    // Fallback to local storage
    const localData = JSON.parse(localStorage.getItem('agent_submissions') || '[]');

    if (supabase && (await checkSupabaseConnection())) {
        try {
            const { data, error } = await supabase
                .from('mandi_entries')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (!error && data) {
                // Map DB structure to App structure
                return data.map((d: any) => ({
                    id: d.id,
                    crop: d.crop,
                    variety: d.variety,
                    modalPrice: d.price_modal,
                    quantity: d.quantity,
                    status: d.status,
                    timestamp: new Date(d.created_at).getTime(),
                    mandi: d.mandi_name
                }));
            }
        } catch (e) {
            console.error("Agent history fetch failed, using local.", e);
        }
    }
    
    return localData;
};

export const getMasterMandiList = async (): Promise<string[]> => {
    const supabase = getSupabase();
    if (supabase && (await checkSupabaseConnection())) {
        try {
            // Fetch distinct mandi names to use as autocomplete source
            const { data } = await supabase.from('market_prices').select('mandi');
            if (data) {
                const names = new Set(data.map((d: any) => d.mandi));
                return Array.from(names) as string[];
            }
        } catch (e) {}
    }
    
    // Fallback static list to prevent empty dropdowns
    return [
        "Azadpur Mandi", "Vashi APMC", "Ghazipur Mandi", "Keshopur Mandi", 
        "Pune Market Yard", "Nashik Mandi", "Indore APMC", "Karnal Mandi",
        "Bhubaneswar Unit-1", "Cuttack Malgodown"
    ];
};
