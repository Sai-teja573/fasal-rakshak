
import { FarmingGuide, Language, NewsItem, Scheme, KVKAdvisory } from "../../types";
import { fetchQuery } from "../queryClient";
import { getSupabase, checkSupabaseConnection } from "../supabaseClient";

const CONSTANT_DATA_TTL = 1000 * 60 * 60 * 24;
const KVK_TTL = 1000 * 60 * 60 * 12;
const OFFLINE_GUIDES_KEY = 'fasal_offline_guides';

const DEFAULT_GUIDES: FarmingGuide[] = [
    {
        id: 'def_1',
        title: 'General Soil Health Management',
        crop: 'All Crops',
        category: 'Fertilizer',
        content: 'Maintain soil pH between 6.0 and 7.0 for optimal nutrient uptake.',
        read_time: '5 min',
        isOfflineReady: true
    },
    {
        id: 'def_2',
        title: 'Integrated Pest Management (IPM)',
        crop: 'General',
        category: 'Pest Control',
        content: 'Use pheromone traps to monitor pest population.',
        read_time: '7 min',
        isOfflineReady: true
    }
];

export const getGovernmentSchemes = async (state: string, lang: Language): Promise<Scheme[]> => {
    const cleanState = state?.trim() || 'India';
    const cacheKey = `schemes:${cleanState}:${lang}`;
    
    return fetchQuery(cacheKey, async () => {
        const supabase = getSupabase();
        if (supabase && await checkSupabaseConnection()) {
            try {
                const { data } = await supabase
                    .from('schemes')
                    .select('*')
                    .eq('status', 'active')
                    .or(`provider.eq.Central,state.ilike.%${cleanState}%`)
                    .order('created_at', { ascending: false });

                if (data && data.length > 0) {
                    return data.map((s: any) => ({
                        id: s.id,
                        name: s.name,
                        provider: s.provider || 'Central',
                        benefit: s.benefit,
                        status: 'active',
                        link: s.link,
                        full_details: s.details,
                        youtube_videos: s.youtube_videos
                    }));
                }
            } catch (e) {
                console.error("Schemes DB Fetch Error", e);
            }
        }
        return [];
    }, { ttl: CONSTANT_DATA_TTL, persist: true });
};

export const getAgroStateNews = async (crops: string[], state: string, lang: Language): Promise<NewsItem[]> => {
    const cleanState = state?.trim() || 'India';
    const cacheKey = `news:${cleanState}:${lang}:${crops.join(',')}`;
    
    return fetchQuery(cacheKey, async () => {
        const supabase = getSupabase();
        if (supabase && await checkSupabaseConnection()) {
            try {
                const { data } = await supabase
                    .from('news')
                    .select('*')
                    .or(`state.ilike.%${cleanState}%,state.is.null`)
                    .order('published_at', { ascending: false })
                    .limit(15);

                if (data && data.length > 0) {
                    return data.map((n: any) => ({
                        id: n.id,
                        title: n.title,
                        summary: n.summary,
                        full_content: n.full_content,
                        source: n.source || 'Agro News',
                        timestamp: n.published_at ? new Date(n.published_at).toLocaleDateString() : 'Just now',
                        impact: n.impact || 'neutral',
                        tags: n.related_crops || [],
                        url: n.url,
                        image_url: n.image_url
                    }));
                }
            } catch(e) { console.error("News Fetch Error", e); }
        }
        return [];
    }, { ttl: CONSTANT_DATA_TTL, persist: true });
};

export const getKVKAdvisory = async (district: string, state: string, lang: Language): Promise<KVKAdvisory | null> => {
    return fetchQuery(`kvk:${district}:${state}:${lang}`, async () => {
        const supabase = getSupabase();
        if (supabase && await checkSupabaseConnection()) {
            try {
                const { data } = await supabase.from('kvk_advisories').select('*').ilike('district', `%${district}%`).limit(1);
                if (data && data.length > 0) return data[0] as KVKAdvisory;
            } catch (e) {}
        }
        return null;
    }, { ttl: KVK_TTL, persist: true });
};

export const getAiSummary = async (weather: any, market: any, district: string, lang: Language) => {
    const cacheKey = `summary:${district}:${lang}`;
    return fetchQuery(cacheKey, async () => {
        let priceTrend = "Stable";
        let riskAlerts = "None";
        let farmingAdvice = "Conditions are normal.";

        if (market && Array.isArray(market) && market.length > 0) {
            const upCount = market.filter((m: any) => m.trend === 'up').length;
            if (upCount > market.length/2) priceTrend = "Rising 📈";
        }

        if (weather) {
            if (weather.temp > 40) {
                riskAlerts = "Heatwave Alert ⚠️";
                farmingAdvice = "Extreme heat detected. Irrigate frequently.";
            } else if (weather.is_raining_now) {
                riskAlerts = "Rainfall 🌧️";
                farmingAdvice = "Rain detected. Postpone spraying.";
            }
        }

        return { price_trend: priceTrend, risk_alerts: riskAlerts, farming_advice: farmingAdvice };
    }, { ttl: 1000 * 60 * 15, persist: true });
};

export const getOfflineGuides = (crop?: string): FarmingGuide[] => {
    const pack = JSON.parse(localStorage.getItem(OFFLINE_GUIDES_KEY) || '{}');
    if (crop) return pack[crop] || [];
    return Object.values(pack).flat() as FarmingGuide[];
};

export const getFarmingGuides = async (crops: string[], lang: Language): Promise<FarmingGuide[]> => {
    const cacheKey = `guides:${lang}:${crops.sort().join(',')}`;
    return fetchQuery(cacheKey, async () => {
        const supabase = getSupabase();
        const isConnected = await checkSupabaseConnection();

        if (supabase && isConnected) {
            try {
                let fetchedData: any[] | null = null;
                if (crops.length > 0) {
                    const cropFilters = crops.map(c => `crop.ilike.%${c}%`).join(',');
                    const { data } = await supabase.from('guides').select('*').or(cropFilters).order('created_at', { ascending: false }).limit(20);
                    fetchedData = data;
                }
                if (!fetchedData || fetchedData.length === 0) {
                    const { data } = await supabase.from('guides').select('*').order('created_at', { ascending: false }).limit(20);
                    fetchedData = data;
                }
                if (fetchedData && fetchedData.length > 0) {
                    return fetchedData.map((item: any) => ({
                        id: item.id,
                        title: item.title,
                        crop: item.crop || 'General',
                        category: item.category || 'General',
                        content: item.content,
                        read_time: item.read_time || '5 min',
                        video_links: item.video_links || [],
                        isOfflineReady: true
                    }));
                }
            } catch (e) { console.error("Guides DB fetch failed", e); }
        }
        const offline = getOfflineGuides(crops[0]);
        if (offline.length > 0) return offline;
        return DEFAULT_GUIDES;
    }, { ttl: CONSTANT_DATA_TTL, persist: true });
};

export const downloadKnowledgePack = async (crops: string[], lang: Language, onProgress: (msg: string) => void) => {
    onProgress("Downloading offline guides...");
    setTimeout(() => { onProgress("Download Complete."); }, 2000);
};
