
import { MarketItem, MandiDetails } from "../../types";
import { fetchQuery } from "../queryClient";
import { getSupabase, checkSupabaseConnection } from "../supabaseClient";
import { reverseGeocode } from "./utils";

const CONSTANT_DATA_TTL = 1000 * 60 * 5; // 5 Minutes for "Live" feel

// ODISHA SPECIFIC MOCK DATA (Fallback if API/DB fails)
const ODISHA_MARKET_DATA: MarketItem[] = [
    { crop: "Rice", price: "₹2,400/q", trend: "up", last_updated: "Today", mandi: "Unit-1 Market, Bhubaneswar", change: "+₹50", distance: "2km", advice: "Sell Now", advice_reason: "High demand due to upcoming festivals." },
    { crop: "Rice", price: "₹2,350/q", trend: "stable", last_updated: "Today", mandi: "Cuttack Malgodown", change: "0", distance: "25km", advice: "Hold", advice_reason: "Prices stable, bulk buyers expected next week." },
    { crop: "Wheat", price: "₹2,200/q", trend: "stable", last_updated: "Today", mandi: "Cuttack Malgodown", change: "0", distance: "25km", advice: "Hold", advice_reason: "Government procurement starting soon." },
    
    // Added specific crops from Profile scenarios
    { crop: "Mango", price: "₹5,500/q", trend: "up", last_updated: "Today", mandi: "Dhenkanal Fruit Market", change: "+₹200", distance: "45km", advice: "Sell Now", advice_reason: "Early season premium available." },
    { crop: "Potato", price: "₹1,200/q", trend: "down", last_updated: "Today", mandi: "Aiginia Warehouse", change: "-₹50", distance: "8km", advice: "Hold", advice_reason: "Cold storage release causing temporary dip." },
    { crop: "Sugarcane", price: "₹320/q", trend: "stable", last_updated: "Yesterday", mandi: "Aska Co-op Sugar", change: "0", distance: "120km", advice: "Wait", advice_reason: "Mill crushing schedule pending." },
    { crop: "Mustard", price: "₹5,100/q", trend: "up", last_updated: "Today", mandi: "Nayagarh Mandi", change: "+₹150", distance: "60km", advice: "Sell Now", advice_reason: "Oil mill demand peak." },
    { crop: "Cotton", price: "₹6,100/q", trend: "up", last_updated: "Today", mandi: "Rayagada Market", change: "+₹120", distance: "200km", advice: "Sell Now", advice_reason: "Textile demand rising." },

    // Other commons
    { crop: "Brinjal", price: "₹1,800/q", trend: "down", last_updated: "Today", mandi: "Jatni Gate Market", change: "-₹100", distance: "15km", advice: "Sell Now", advice_reason: "Supply glut in local markets." },
    { crop: "Tomato", price: "₹1,500/q", trend: "up", last_updated: "Today", mandi: "Unit-4 Market, Bhubaneswar", change: "+₹120", distance: "5km", advice: "Sell Now", advice_reason: "Shortage reported in city markets." },
    { crop: "Pointed Gourd", price: "₹3,500/q", trend: "up", last_updated: "Yesterday", mandi: "Pipli Market", change: "+₹200", distance: "20km", advice: "Hold", advice_reason: "Export demand rising." },
    { crop: "Green Chilli", price: "₹4,000/q", trend: "stable", last_updated: "Today", mandi: "Khordha Central", change: "+₹10", distance: "22km", advice: "Wait", advice_reason: "Slight fluctuation observed." }
];

export const getRealMarketPrices = async (district: string, state: string, crops: string[] = []): Promise<MarketItem[]> => {
    // 1. Prioritize crops: Create a unique cache key based on crops to ensure profile updates reflect here
    const cropKey = crops.length > 0 ? crops.sort().join(',') : 'ALL';
    const cacheKey = `mkt_live:${district}:${state}:${cropKey}`;
    
    return fetchQuery(cacheKey, async () => {
        const supabase = getSupabase();
        const isConnected = await checkSupabaseConnection();
        let combinedData: MarketItem[] = [];

        if (supabase && isConnected) {
            try {
                // A. Fetch Real-time Agent Entries (Priority 1)
                let agentQuery = supabase.from('mandi_entries')
                    .select('*')
                    .eq('status', 'Verified') // Only verified prices
                    .order('created_at', { ascending: false })
                    .limit(20);

                if (crops.length > 0) {
                    agentQuery = agentQuery.in('crop', crops);
                }

                const { data: agentData } = await agentQuery;

                if (agentData && agentData.length > 0) {
                    const agentItems: MarketItem[] = agentData.map((i: any) => {
                        const trend = parseInt(i.price_modal) > parseInt(i.price_min) ? 'up' : 'down';
                        return {
                            crop: i.crop,
                            price: `₹${i.price_modal}/q`,
                            trend: trend,
                            last_updated: new Date(i.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                            mandi: i.mandi_name,
                            change: "Live Update",
                            distance: "Near You", // In real app, calc distance
                            advice: trend === 'up' ? 'Sell Now' : 'Hold',
                            advice_reason: "Recently updated by Verified Agent."
                        };
                    });
                    combinedData = [...combinedData, ...agentItems];
                }

                // B. Fetch General Market Prices (Gov Data / Historical)
                let govQuery = supabase.from('market_prices')
                    .select('*');
                
                // Relaxed filtering
                if (state) govQuery = govQuery.ilike('state', `%${state}%`);
                
                if (crops.length > 0) {
                    govQuery = govQuery.in('crop', crops);
                }

                const { data: govData } = await govQuery.order('price', { ascending: false }).limit(30);

                if (govData && govData.length > 0) {
                    const govItems = govData.map((i: any) => ({ 
                        crop: i.crop, 
                        price: `₹${i.price}/q`, 
                        trend: i.trend || 'stable', 
                        last_updated: i.date || new Date().toLocaleDateString(), 
                        mandi: i.mandi,
                        distance: "Regional",
                        advice: "Wait",
                        advice_reason: "Based on state averages."
                    }));
                    combinedData = [...combinedData, ...govItems];
                }
            } catch(e) {
                console.warn("Live fetch failed, using fallback", e);
            }
        }

        // --- INTELLIGENT GAP FILLING ---
        // Ensure ALL requested crops are present, even if API returned nothing
        
        // 1. Identify which crops we already have from API
        const presentCrops = new Set(combinedData.map(i => i.crop.toLowerCase()));
        
        // 2. Identify missing crops from user profile
        const missingCrops = crops.filter(c => !presentCrops.has(c.toLowerCase()));

        // 3. Try to fill missing crops from ODISHA_MARKET_DATA
        if (missingCrops.length > 0) {
             const relevantMocks = ODISHA_MARKET_DATA.filter(m => 
                missingCrops.some(c => m.crop.toLowerCase().includes(c.toLowerCase()))
             );
             combinedData = [...combinedData, ...relevantMocks];
        }

        // 4. Re-evaluate missing crops after mock injection
        const updatedPresentCrops = new Set(combinedData.map(i => i.crop.toLowerCase()));
        const stillMissingCrops = crops.filter(c => !updatedPresentCrops.has(c.toLowerCase()));

        // 5. Generate generic data for completely missing crops (Last Resort)
        stillMissingCrops.forEach(c => {
             // Basic estimation logic based on crop type
             let estimatedPrice = "₹2,000/q"; // Default
             
             if(c.toLowerCase().includes('mango')) estimatedPrice = "₹5,500/q";
             if(c.toLowerCase().includes('sugarcane')) estimatedPrice = "₹320/q";
             if(c.toLowerCase().includes('potato')) estimatedPrice = "₹1,200/q";
             if(c.toLowerCase().includes('cotton')) estimatedPrice = "₹6,000/q";

             combinedData.push({
                crop: c,
                price: estimatedPrice,
                trend: 'stable',
                last_updated: "Today",
                mandi: `${district} Mandi`, 
                advice: "Wait",
                advice_reason: "Live data unavailable. Using estimates.",
                distance: "Nearby",
                change: "0%"
            });
        });

        // Deduplicate: Prioritize Agent > Gov > Mock
        // We use a Map to keep unique Crop+Mandi combinations
        const uniqueMap = new Map();
        combinedData.forEach(item => {
            const key = `${item.crop}-${item.mandi}`;
            if (!uniqueMap.has(key)) uniqueMap.set(key, item);
        });

        const finalData = Array.from(uniqueMap.values());

        // Sort: Put user's requested crops at the TOP
        finalData.sort((a, b) => {
            const aIsUserCrop = crops.some(c => a.crop.toLowerCase().includes(c.toLowerCase()));
            const bIsUserCrop = crops.some(c => b.crop.toLowerCase().includes(c.toLowerCase()));
            if (aIsUserCrop && !bIsUserCrop) return -1;
            if (!aIsUserCrop && bIsUserCrop) return 1;
            return 0;
        });

        return finalData;

    }, { ttl: CONSTANT_DATA_TTL, persist: true, forceRefresh: true }); // forceRefresh ensures profile updates reflect immediately
};

export const getMandisByLocation = async (lat: number, lon: number): Promise<MandiDetails[]> => {
    // ... existing implementation remains same
    const location = await reverseGeocode(lat, lon);
    const district = location?.district || "Bhubaneswar";
    const state = location?.state || "Odisha";
    
    const supabase = getSupabase();
    if (!supabase || !(await checkSupabaseConnection())) {
        return [
            { name: "Unit-1 Market, Bhubaneswar", address: "Unit-1, Bapuji Nagar, Bhubaneswar", location: { lat: 20.272, lon: 85.833 } },
            { name: "Cuttack Malgodown", address: "Malgodown, Cuttack, Odisha", location: { lat: 20.468, lon: 85.897 } },
            { name: "Jatni Gate Market", address: "Jatni, Khordha, Odisha", location: { lat: 20.175, lon: 85.706 } },
            { name: "Sakhigopal Coconut Market", address: "Sakhigopal, Puri, Odisha", location: { lat: 19.967, lon: 85.816 } }
        ];
    }

    try {
        const { data } = await supabase
            .from('market_prices')
            .select('mandi')
            .ilike('district', `%${district}%`)
            .limit(50);

        if (!data || data.length === 0) {
             return [
                { name: `${district} Principal Market Yard`, address: `${district}, ${state}`, location: { lat, lon } },
                { name: "Local Gramin Mandi", address: `Village near ${district}`, location: { lat, lon } }
            ];
        }

        const uniqueNames = Array.from(new Set(data.map((item: any) => item.mandi))) as string[];
        return uniqueNames.map(name => ({
            name: name,
            address: `${name}, ${district}, ${state}`,
            location: { lat, lon }
        }));

    } catch (e) {
        return [{ name: `${district} APMC`, address: state, location: { lat, lon } }];
    }
};
