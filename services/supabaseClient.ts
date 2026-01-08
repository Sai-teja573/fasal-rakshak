
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_URL = "https://cmffxxirhtetvkvreznh.supabase.co";
const DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtZmZ4eGlyaHRldHZrdnJlem5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1Mjc0NjksImV4cCI6MjA4MDEwMzQ2OX0.P1cwsI1lPU4ViNl3nfhOMo6RZkP5xQ8u7uYM-x3b_xM";

let supabaseInstance: SupabaseClient | null = null;

// Connection Cache with TTL (Time To Live)
let cachedConnectionStatus: boolean | null = null;
let lastConnectionCheckTime = 0;
const CONNECTION_CHECK_TTL = 5000; // 5 seconds cache

export const getSupabaseConfig = () => {
    const url = localStorage.getItem('SUPABASE_URL') || DEFAULT_URL;
    const key = localStorage.getItem('SUPABASE_KEY') || DEFAULT_KEY;
    return { url, key };
}

export const getSupabase = (): SupabaseClient | null => {
    const { url, key } = getSupabaseConfig();
    if (!url || !key) return null;
    
    if (!supabaseInstance) {
        try {
            supabaseInstance = createClient(url, key, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                },
                // Reduced timeout to 5s to fail faster on poor connections and avoid App.tsx safety timeout
                global: {
                    fetch: (url, options) => {
                        const controller = new AbortController();
                        const id = setTimeout(() => controller.abort(), 5000); // 5s Timeout
                        return fetch(url, { ...options, signal: controller.signal })
                            .catch(err => {
                                // Silently handle offline/fetch errors to prevent console noise
                                throw new Error("Network request failed");
                            })
                            .finally(() => clearTimeout(id));
                    }
                }
            });
        } catch (e) {
            console.error("Supabase Init Failed", e);
            return null;
        }
    }
    return supabaseInstance;
}

// Check connection with TTL caching to avoid spamming checks and causing UI lag
export const checkSupabaseConnection = async (force: boolean = false): Promise<boolean> => {
    const now = Date.now();
    
    // Return cached result if valid and not expired
    if (!force && cachedConnectionStatus !== null && (now - lastConnectionCheckTime < CONNECTION_CHECK_TTL)) {
        return cachedConnectionStatus;
    }

    const sb = getSupabase();
    if (!sb) {
        console.error("Supabase Connection: Client not initialized");
        cachedConnectionStatus = false;
        lastConnectionCheckTime = now;
        return false;
    }

    try {
        const startTime = Date.now();
        // Quick lightweight check
        const { error } = await sb.from('profiles').select('count', { count: 'exact', head: true });
        
        if (error) {
             const msg = error.message?.toLowerCase() || "";
             // If it's a network/fetch error, we are offline. If it's a permission error, we are online.
             if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed') || msg.includes('abort')) {
                 cachedConnectionStatus = false;
             } else {
                 // Auth/RLS errors mean we are connected to the server
                 cachedConnectionStatus = true;
             }
        } else {
             cachedConnectionStatus = true;
        }
    } catch (e: any) {
        cachedConnectionStatus = false;
    }

    lastConnectionCheckTime = now;
    return cachedConnectionStatus;
};
