
import { ApiLog, AppConfig, CMSContent, CropImageDef, Plan, User } from '../types';
import { getSessionUser } from './authService';
import { getSupabase } from './supabaseClient';

const CMS_KEY = 'fasal_cms_content';
const PLANS_KEY = 'fasal_plans';
const ANALYTICS_KEY = 'fasal_analytics';
const GUEST_USAGE_KEY = 'fasal_guest_usage';
const API_LOGS_KEY = 'fasal_api_logs';
const DAILY_QUOTA_KEY = 'fasal_daily_quota';
const APP_CONFIG_KEY = 'fasal_app_config';

// Default Data
const DEFAULT_CMS: CMSContent = {
    hero: {
        title_line1: "Grow Smarter.",
        title_line2: "Harvest Better.",
        subtitle: "Your personal AI Crop Doctor. Diagnose diseases instantly, get real-time market prices, and secure your harvest with cutting-edge technology.",
        cta_primary: "Get Started Free",
        cta_secondary: "Try Guest Scan"
    },
    vision: {
        title: "Bridging Nature & Technology",
        description: "We envision a future where every farmer has an expert agronomist in their pocket—powered by AI, grounded in science, and accessible in their local language."
    },
    features: {
        step1_title: "Snap a Photo",
        step1_desc: "Take a picture of the affected crop leaf or stem using our in-app camera.",
        step2_title: "AI Diagnosis",
        step2_desc: "Our advanced Gemini AI analyzes the image against millions of data points.",
        step3_title: "Get Solutions",
        step3_desc: "Receive instant treatment plans, medicine links, and expert video guides."
    },
    contact: {
        email: "support@fasalrakshak.com",
        phone: "+91 1800-FASAL-AI",
        address: "A208 Developers HQ, Bangalore, India"
    },
    images: {
        login_bg: "https://images.unsplash.com/photo-1495107334309-fcf20504a5ab?q=80&w=2000&auto=format&fit=crop", // Updated to valid image
        hero_bg_pattern: "https://grain-bg.vercel.app/noise.png",
        simulator_screen: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?q=80&w=800&auto=format&fit=crop",
        landing_bg: "https://grain-bg.vercel.app/noise.png"
    },
    // DEFAULT LOGOS
    logos: {
        main: "https://cdn-icons-png.flaticon.com/512/10609/10609658.png", // Default Leaf
        navbar: "", // Use empty to fallback to text
        favicon: "https://cdn-icons-png.flaticon.com/512/10609/10609658.png",
        pwa: "https://cdn-icons-png.flaticon.com/512/10609/10609658.png"
    },
    links: {
        twitter: "https://twitter.com/fasalrakshak",
        linkedin: "https://linkedin.com/company/fasalrakshak",
        instagram: "https://instagram.com/fasalrakshak"
    }
};

// Updated Crop Images with reliable Unsplash IDs
export const DEFAULT_CROP_IMAGES: CropImageDef[] = [
    { id: 'rice', name_en: 'Rice (Paddy)', category: 'Cereal', image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80' },
    { id: 'wheat', name_en: 'Wheat', category: 'Cereal', image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=400&q=80' },
    { id: 'maize', name_en: 'Maize', category: 'Cereal', image: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=400&q=80' },
    { id: 'millet', name_en: 'Millet (Bajra)', category: 'Cereal', image: 'https://images.unsplash.com/photo-1667669888803-3d9692955c4d?auto=format&fit=crop&w=400&q=80' },
    { id: 'cotton', name_en: 'Cotton', category: 'Cash Crop', image: 'https://images.unsplash.com/photo-1594315590298-04f0d367c3b9?auto=format&fit=crop&w=400&q=80' },
    { id: 'sugarcane', name_en: 'Sugarcane', category: 'Cash Crop', image: 'https://images.unsplash.com/photo-1601625463687-25541fb72f62?auto=format&fit=crop&w=400&q=80' },
    { id: 'tomato', name_en: 'Tomato', category: 'Vegetable', image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=400&q=80' },
    { id: 'potato', name_en: 'Potato', category: 'Vegetable', image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=400&q=80' },
    { id: 'onion', name_en: 'Onion', category: 'Vegetable', image: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=400&q=80' }
];

const DEFAULT_PLANS: Plan[] = [
    {
        id: 'basic',
        name: 'Free Starter',
        price: 0,
        interval: 'month',
        features: ['3 AI Scans / Day', 'Community Access', 'Market Prices (Delayed)', 'Basic Weather'],
        limits: { max_scans: 3, allow_weather: true, allow_expert_chat: false, allow_market_history: false, priority_support: false },
        recommended: false
    },
    {
        id: 'plus',
        name: 'Kisan Plus',
        price: 199,
        interval: 'month',
        features: ['15 AI Scans / Day', 'Real-time Market Rates', 'Audio/Voice Reports', '3 Day Weather Forecast', 'Ad-free Experience'],
        limits: { max_scans: 15, allow_weather: true, allow_expert_chat: false, allow_market_history: true, priority_support: false },
        recommended: true
    },
    {
        id: 'pro',
        name: 'Fasal Pro',
        price: 499,
        interval: 'month',
        features: ['40 AI Scans / Day', 'Video Diagnosis', 'IoT Sensor Support', 'Expert AI Council Chat', 'Disease Heatmaps'],
        limits: { max_scans: 40, allow_weather: true, allow_expert_chat: true, allow_market_history: true, priority_support: true },
        recommended: false
    }
];

let cachedPlans: Plan[] = [...DEFAULT_PLANS];

// --- APP CONFIG ---
export const getAppConfig = (): AppConfig => {
    const stored = localStorage.getItem(APP_CONFIG_KEY);
    const config = stored ? JSON.parse(stored) : {};
    return {
        showCouncilLog: config.showCouncilLog ?? true,
        customLinks: config.customLinks || [],
        cropImages: config.cropImages && config.cropImages.length > 0 ? config.cropImages : DEFAULT_CROP_IMAGES,
        translationProvider: config.translationProvider || 'Gemini', // Default to Gemini
        apiControl: config.apiControl || { forceCacheMode: true, dashboardProvider: 'OpenRouter' } // DEFAULT TO SAFE MODE
    };
};

export const fetchAppConfig = async (): Promise<AppConfig> => {
    const supabase = getSupabase();
    if (supabase) {
        try {
            const { data, error } = await supabase.from('app_config').select('config').eq('id', 'global').single();
            if (!error && data?.config) {
                // Ensure new fields exist in fetched data
                const merged = { ...getAppConfig(), ...data.config };
                localStorage.setItem(APP_CONFIG_KEY, JSON.stringify(merged));
                return merged;
            }
        } catch(e) {}
    }
    return getAppConfig();
};

export const saveAppConfig = async (config: AppConfig) => {
    localStorage.setItem(APP_CONFIG_KEY, JSON.stringify(config));
    const supabase = getSupabase();
    if(supabase) await supabase.from('app_config').upsert({ id: 'global', config }).select();
};

// --- CROPS DATABASE MANAGEMENT ---
export const fetchCrops = async (): Promise<CropImageDef[]> => {
    const supabase = getSupabase();
    if (supabase) {
        try {
            const { data, error } = await supabase.from('crops').select('*').order('name_en', { ascending: true });
            
            if (!error) {
                if (data && data.length > 0) {
                    return data.map((c: any) => ({
                        id: c.id,
                        name_en: c.name_en,
                        category: c.category,
                        image: c.image
                    }));
                } else {
                    // DB Connected but table empty -> Auto-Seed with defaults
                    console.log("Crops table empty. Seeding defaults into DB...");
                    const rows = DEFAULT_CROP_IMAGES.map(c => ({
                        id: c.id,
                        name_en: c.name_en,
                        category: c.category,
                        image: c.image
                    }));
                    
                    const { error: insertError } = await supabase.from('crops').insert(rows);
                    if (!insertError) {
                        return DEFAULT_CROP_IMAGES;
                    } else {
                        console.error("Failed to seed crops", insertError);
                    }
                }
            }
        } catch (e) {
            console.warn("Error fetching crops from DB", e);
        }
    }
    // Return default if DB fails or empty (and seeding failed)
    return DEFAULT_CROP_IMAGES;
};

export const saveCrop = async (crop: CropImageDef): Promise<void> => {
    const supabase = getSupabase();
    if (supabase) {
        // Ensure ID is url safe
        const cleanId = crop.id || crop.name_en.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        await supabase.from('crops').upsert({
            id: cleanId,
            name_en: crop.name_en,
            category: crop.category,
            image: crop.image
        });
    }
};

export const deleteCrop = async (id: string): Promise<void> => {
    const supabase = getSupabase();
    if (supabase) {
        await supabase.from('crops').delete().eq('id', id);
    }
};

// --- CMS CONTENT MANAGEMENT ---
export const fetchCMSContent = async (): Promise<CMSContent> => {
    const supabase = getSupabase();
    if (supabase) {
        try {
            const { data, error } = await supabase.from('cms_content').select('content').eq('id', 'global').single();
            if (!error && data?.content) {
                // Merge with default to ensure no keys are missing
                const merged = { ...DEFAULT_CMS, ...data.content };
                
                // Deep merge specific objects to avoid overwriting partial updates with old defaults if keys missing
                merged.images = { ...DEFAULT_CMS.images, ...(data.content.images || {}) };
                merged.hero = { ...DEFAULT_CMS.hero, ...(data.content.hero || {}) };
                merged.contact = { ...DEFAULT_CMS.contact, ...(data.content.contact || {}) };
                merged.logos = { ...DEFAULT_CMS.logos, ...(data.content.logos || {}) };
                
                localStorage.setItem(CMS_KEY, JSON.stringify(merged));
                return merged;
            }
        } catch(e) {
            console.warn("CMS fetch error", e);
        }
    }
    return getCMSContent(); // Fallback to local
};

export const getCMSContent = (): CMSContent => {
    const stored = localStorage.getItem(CMS_KEY);
    const parsed = stored ? JSON.parse(stored) : DEFAULT_CMS;
    // Ensure logos object exists even if legacy data
    return { ...DEFAULT_CMS, ...parsed, logos: { ...DEFAULT_CMS.logos, ...(parsed.logos || {}) } };
};

export const updateCMSContent = async (content: CMSContent): Promise<void> => {
    localStorage.setItem(CMS_KEY, JSON.stringify(content));
    const supabase = getSupabase();
    if(supabase) {
        await supabase.from('cms_content').upsert({ id: 'global', content });
    }
};

export const fetchPlans = async (): Promise<Plan[]> => {
    const supabase = getSupabase();
    if (supabase) {
        const { data } = await supabase.from('plans').select('*').order('price', { ascending: true });
        if (data && data.length > 0) {
            cachedPlans = data.map(p => ({
                id: p.id,
                name: p.name,
                price: p.price,
                interval: p.interval,
                // Handle parsing if stored as string, or direct use if array/jsonb
                features: typeof p.features === 'string' ? JSON.parse(p.features) : p.features,
                limits: typeof p.limits === 'string' ? JSON.parse(p.limits) : p.limits,
                recommended: p.recommended
            }));
            return cachedPlans;
        }
    }
    return cachedPlans;
};

export const savePlans = async (plans: Plan[]): Promise<void> => {
    cachedPlans = plans;
    const supabase = getSupabase();
    if(supabase) {
        // Send raw objects/arrays. Supabase client handles JSONB/ARRAY serialization
        const rows = plans.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            interval: p.interval,
            features: p.features, 
            limits: p.limits,
            recommended: p.recommended
        }));
        
        const { error } = await supabase.from('plans').upsert(rows);
        if (error) {
            console.error("Failed to save plans to Supabase:", error);
            throw new Error("Failed to save plans: " + error.message);
        }
    }
};

export const getPlanDetails = (planId?: string): Plan => {
    return cachedPlans.find(p => p.id === planId) || cachedPlans.find(p => p.id === 'basic') || DEFAULT_PLANS[0];
};

// --- USAGE ENFORCEMENT ---
export const getGuestUsage = (): number => parseInt(localStorage.getItem(GUEST_USAGE_KEY) || '0');

export const checkUsageLimit = (user: User | null, limitType: 'max_scans'): boolean => {
    // Guest Limit: Hardcoded to 1 for trial
    if (!user) return getGuestUsage() < 1;
    
    const plan = getPlanDetails(user.plan_id);
    
    if (limitType === 'max_scans') {
        // -1 indicates unlimited (not really used in new plans, but kept for legacy/admin)
        if (plan.limits.max_scans === -1) return true;
        
        // Reset Logic Check (Simulated Daily Reset for this demo)
        // In prod, this happens on DB via cron
        const lastReset = new Date(user.usage.last_reset_date);
        const today = new Date();
        const isSameDay = lastReset.getDate() === today.getDate() && 
                          lastReset.getMonth() === today.getMonth() && 
                          lastReset.getFullYear() === today.getFullYear();
                          
        if (!isSameDay) {
            // It's a new day, so technically they have usage, we just need to reset it in DB next time we increment
            return true; 
        }
        
        return user.usage.scans_this_month < plan.limits.max_scans;
    }
    
    return true;
};

export const incrementUserUsage = (user: User | null): User | null => {
    if (!user) {
        localStorage.setItem(GUEST_USAGE_KEY, (getGuestUsage() + 1).toString());
        return null;
    }
    
    const today = new Date();
    const lastReset = new Date(user.usage.last_reset_date);
    const isSameDay = lastReset.getDate() === today.getDate() && 
                      lastReset.getMonth() === today.getMonth() && 
                      lastReset.getFullYear() === today.getFullYear();

    const newUsage = {
        scans_this_month: isSameDay ? (user.usage.scans_this_month || 0) + 1 : 1, // Reset to 1 if new day
        last_reset_date: Date.now()
    };

    const updatedUser = { 
        ...user, 
        usage: newUsage
    };
    
    // Sync usage to DB
    const supabase = getSupabase();
    if (supabase) {
        supabase.from('profiles').update({ usage: updatedUser.usage }).eq('id', user.id).then(({ error }) => {
            if (error) console.error("Failed to update usage", error);
        });
    }
    
    return updatedUser;
};

// --- LOGGING & ANALYTICS ---

export const trackDailyGeminiCall = () => {
    const today = new Date().toISOString().split('T')[0];
    const stored = JSON.parse(localStorage.getItem(DAILY_QUOTA_KEY) || JSON.stringify({ date: today, count: 0 }));
    if (stored.date !== today) stored.count = 0;
    stored.count++;
    stored.date = today;
    localStorage.setItem(DAILY_QUOTA_KEY, JSON.stringify(stored));
    
    // Increment generic view/api count in local analytics
    const analytics = getAnalytics();
    analytics.apiCalls = (analytics.apiCalls || 0) + 1;
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(analytics));
};

export const getDailyQuotaUsage = () => {
    const stored = JSON.parse(localStorage.getItem(DAILY_QUOTA_KEY) || '{}');
    return stored.date === new Date().toISOString().split('T')[0] ? stored.count : 0;
};

export const getAnalytics = () => {
    const stored = localStorage.getItem(ANALYTICS_KEY);
    return stored ? JSON.parse(stored) : { views: {}, apiCalls: 0 };
};

export const getApiLogs = async (): Promise<ApiLog[]> => {
    const supabase = getSupabase();
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('api_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);
                
            if (!error && data) {
                return data.map((log: any) => ({
                    id: log.id,
                    timestamp: new Date(log.created_at).getTime(),
                    service: log.service,
                    status: log.status,
                    latencyMs: log.latency_ms,
                    errorMessage: log.error_message,
                    requestSnippet: log.endpoint
                }));
            } else if (error) {
                console.error("Fetch API Logs Error:", error);
            }
        } catch (e) {
            console.error("Failed to fetch logs from DB", e);
        }
    }
    
    // Fallback to local
    const stored = localStorage.getItem(API_LOGS_KEY);
    return stored ? JSON.parse(stored) : [];
};

export const trackApiLog = async (log: Omit<ApiLog, 'id' | 'timestamp'>) => {
    const supabase = getSupabase();
    const user = await getSessionUser();
    
    // Log to Supabase
    if (supabase) {
        // Fire and forget
        supabase.from('api_logs').insert({
            user_id: user?.id,
            service: log.service,
            status: log.status,
            latency_ms: log.latencyMs,
            error_message: log.errorMessage,
            endpoint: log.requestSnippet
        }).then(() => {}).catch(() => {});
    }
    
    // Local Buffer for debugging/fallback
    const stored = localStorage.getItem(API_LOGS_KEY);
    const localLogs = stored ? JSON.parse(stored) : [];
    // Use fallback for crypto.randomUUID (not available in all browsers/contexts)
    const generateId = () => {
        try {
            if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
                return crypto.randomUUID();
            }
        } catch (e) {
            // Fallback if crypto.randomUUID throws
        }
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    };
    const newLog: ApiLog = { ...log, id: generateId(), timestamp: Date.now() };
    localStorage.setItem(API_LOGS_KEY, JSON.stringify([newLog, ...localLogs].slice(0, 50)));
};
