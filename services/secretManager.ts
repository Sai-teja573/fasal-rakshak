
import { getSupabase } from './supabaseClient';

// Default interface for our keys
export interface ApiKeys {
    gemini_key: string;
    youtube_key: string;
    weather_key: string;
    datagov_key: string;
    openrouter_key: string; // Primary Fallback
    openrouter_key_soil: string; // Dedicated for Soil Analysis
    openrouter_key_planning: string; // Dedicated for Crop Planning
    google_cloud_project_id: string;
    google_translate_key: string;
    google_maps_key: string;
}

// Fallback defaults - HARDCODED AS REQUESTED
// Keys provided by user for immediate functionality
let secrets: ApiKeys = {
    gemini_key: "AIzaSyCM3maEoilDMVFH5l3O8GaMORQBYldgJ1s", // Using provided Google Key for Gemini
    datagov_key: "",
    weather_key: "d90b38c99a754c188b9d516084f57d2f", // Provided Weatherbit Key
    youtube_key: "",
    openrouter_key: "",
    openrouter_key_soil: "",
    openrouter_key_planning: "",
    google_cloud_project_id: "fasal-rakshak-ai",
    google_translate_key: "AIzaSyCM3maEoilDMVFH5l3O8GaMORQBYldgJ1s", // Provided Translation Key
    google_maps_key: "AIzaSyCM3maEoilDMVFH5l3O8GaMORQBYldgJ1s" // Using provided Google Key for Maps
};

export const fetchSecrets = async (): Promise<boolean> => {
    const supabase = getSupabase();
    
    // If Supabase client isn't ready, we use defaults immediately
    if (!supabase) {
        console.log("Secret Manager: Client unavailable, using hardcoded defaults.");
        return true;
    }

    try {
        console.log("Initializing Secret Manager...");
        
        // RACE CONDITION FIXED: Distinct timeout error
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("SecretFetchTimeout")), 3000)
        );

        const fetchPromise = supabase
            .from('app_config')
            .select('config')
            .eq('id', 'api_keys')
            .single();

        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

        if (error) {
            console.warn("Secret Manager: DB fetch failed, using hardcoded defaults.", error.message);
            return true;
        }

        if (data && data.config) {
            let loadedConfig = data.config;
            if (typeof loadedConfig === 'string') {
                try { loadedConfig = JSON.parse(loadedConfig); } catch (e) {}
            }
            if (typeof loadedConfig === 'object') {
                // Merge DB keys with local hardcoded keys (DB takes precedence if value exists)
                secrets = { 
                    ...secrets, 
                    ...Object.fromEntries(
                        Object.entries(loadedConfig).filter(([_, v]) => v !== "" && v !== undefined)
                    ) 
                };
                console.log("Secrets merged successfully.");
            }
            return true;
        }
    } catch (e: any) {
        if (e.message === 'SecretFetchTimeout') {
            console.error("Secret Manager: Fetch timed out. Using hardcoded keys.");
            return true;
        }
        console.log("Secret Manager: Network slow/offline. Using hardcoded keys.");
        return true; 
    }
    
    return true;
};

export const saveSecrets = async (newKeys: ApiKeys): Promise<boolean> => {
    const supabase = getSupabase();
    if (!supabase) return false;

    try {
        const { error } = await supabase
            .from('app_config')
            .upsert({ id: 'api_keys', config: newKeys })
            .select();

        if (error) throw error;
        secrets = { ...secrets, ...newKeys };
        return true;
    } catch (e) {
        console.error("Failed to save secrets:", e);
        return false;
    }
};

export const getSecret = (key: keyof ApiKeys): string => {
    return secrets[key] || "";
};

export const getAllSecrets = (): ApiKeys => {
    return { ...secrets };
};
