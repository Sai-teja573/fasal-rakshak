
import { DetailedCropPlan, StoreLocation } from "../../types";
import { getSupabase, checkSupabaseConnection } from "../supabaseClient";
import { fetchQuery } from "../queryClient";
import { findNearbyStores } from "../geminiService";

// Persist plan to Supabase
export const saveCropPlan = async (userId: string, plan: DetailedCropPlan): Promise<boolean> => {
    const supabase = getSupabase();
    
    // Always save to local storage as fallback
    const localPlans = JSON.parse(localStorage.getItem('fasal_active_plans') || '[]');
    // Update if exists, else append
    const index = localPlans.findIndex((p: DetailedCropPlan) => p.id === plan.id);
    if (index >= 0) {
        localPlans[index] = plan;
    } else {
        localPlans.unshift(plan);
    }
    localStorage.setItem('fasal_active_plans', JSON.stringify(localPlans));

    if (!supabase || !(await checkSupabaseConnection())) return true; // Return true as local save worked

    // Save to DB
    const { error } = await supabase.from('crop_plans').upsert({
        id: plan.id,
        user_id: userId,
        crop_name: plan.cropName,
        status: plan.status,
        plan_data: plan, // Stores full JSON structure
        created_at: new Date(plan.generatedAt).toISOString()
    });

    if (error) {
        // Log cleanly without [object Object]
        console.warn("Cloud sync warning (Crop Plans):", error.message || error);
        // We do not return false here because local save succeeded, and we don't want to block the user flow
        // if the DB table hasn't been created yet.
    }
    return true;
};

// Fetch plans from Supabase or Local Storage
export const getUserCropPlans = async (userId: string): Promise<DetailedCropPlan[]> => {
    const supabase = getSupabase();
    
    if (supabase && (await checkSupabaseConnection())) {
        try {
            const { data, error } = await supabase
                .from('crop_plans')
                .select('plan_data')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
                
            if (!error && data) {
                const plans = data.map((row: any) => row.plan_data);
                // Sync with local storage
                localStorage.setItem('fasal_active_plans', JSON.stringify(plans));
                return plans;
            }
        } catch (e) {
            console.warn("Failed to fetch plans from DB, using local", e);
        }
    }
    
    // Fallback
    return JSON.parse(localStorage.getItem('fasal_active_plans') || '[]');
};

// Get Verified Shops
export const getVerifiedShops = async (lat: number, lon: number): Promise<StoreLocation[]> => {
    const shops: StoreLocation[] = [
        {
            name: "PM Kisan Samriddhi Kendra",
            address: "Government Verified Center",
            rating: "5.0",
            uri: "https://pmkisan.gov.in/",
            type: "Govt",
            verified: true
        },
        {
            name: "IFFCO Bazar (Online)",
            address: "Official IFFCO Store",
            rating: "4.8",
            uri: "https://www.iffcobazar.in/",
            type: "Online",
            verified: true
        },
        {
            name: "Amazon Kisan Store",
            address: "Online Marketplace",
            rating: "4.5",
            uri: "https://www.amazon.in/b?node=26996614031",
            type: "Online",
            verified: true
        }
    ];

    // Merge with Gemini-found local stores
    const localStores = await findNearbyStores(lat, lon);
    const formattedLocal = localStores.map(s => ({
        ...s,
        type: 'Local' as const,
        verified: false
    }));

    return [...shops, ...formattedLocal];
};
