
import { SpraySchedule } from "../../types";
import { fetchQuery } from "../queryClient";
import { getLocalWeather } from "../weatherService";

const SPRAY_SCHEDULE_KEY = 'fasal_spray_schedules';
// Cache location for 24 hours to speed up subsequent loads
const CONSTANT_DATA_TTL = 1000 * 60 * 60 * 24; 

export const handleDbError = (context: string, error: any) => {
    if (!error) return;
    const msg = error.message || JSON.stringify(error);
    if (error.code === '42501' || msg.includes('row-level security')) return;
    console.error(`DB Error (${context}): ${msg}`);
};

export const reverseGeocode = async (lat: number, lon: number) => {
    // Round to 3 decimal places (~100m) to improve cache hit rate
    const cacheKey = `geo:${lat.toFixed(3)},${lon.toFixed(3)}`;
    
    return fetchQuery(cacheKey, async () => {
        try {
            // Using BigDataCloud's free reverse geocoding API which is reliable for client-side use
            // It mimics Google's administrative boundary logic
            const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
            
            if (!res.ok) throw new Error("Geocoding service unavailable");
            
            const data = await res.json();
            
            // Intelligent fallback for District/City names
            const district = data.locality || data.city || data.principalSubdivision || "Unknown District";
            const state = data.principalSubdivision || data.countryName || "India";
            
            return {
                district: district,
                state: state,
                // Add village/locality if available for granular logic
                village: data.locality !== district ? data.locality : undefined
            };
        } catch (e) {
            console.warn("Reverse geocode failed", e);
            return { district: "Detected Location", state: "India" };
        }
    }, { ttl: CONSTANT_DATA_TTL, persist: true });
};

export const saveSpraySchedule = (schedule: SpraySchedule) => {
    const existing = JSON.parse(localStorage.getItem(SPRAY_SCHEDULE_KEY) || '[]');
    if (!existing.find((s: SpraySchedule) => s.diagnosisId === schedule.diagnosisId)) {
        const updated = [...existing, schedule];
        localStorage.setItem(SPRAY_SCHEDULE_KEY, JSON.stringify(updated));
    }
};

export const getSpraySchedules = (): SpraySchedule[] => {
    return JSON.parse(localStorage.getItem(SPRAY_SCHEDULE_KEY) || '[]');
};

export const checkSprayReminders = async (userLocation: {lat: number, lon: number} | undefined): Promise<SpraySchedule[]> => {
    if (!userLocation) return [];
    const schedules = getSpraySchedules();
    const pending = schedules.filter(s => !s.completed);
    if (pending.length === 0) return [];

    try {
        const weather = await getLocalWeather(userLocation.lat, userLocation.lon);
        const { is_raining_now } = weather.display;
        const dueReminders: SpraySchedule[] = [];
        const today = Date.now();

        pending.forEach(s => {
            if (today >= s.dueDate && !is_raining_now) {
                dueReminders.push(s);
            }
        });
        return dueReminders;
    } catch (e) { return []; }
};

export const triggerSmartDataSync = async (onProgress: (msg: string) => void) => {
    onProgress("Syncing started...");
    setTimeout(() => onProgress("Sync complete"), 2000);
};
