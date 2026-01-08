
import { getSupabase } from './supabaseClient';
import { User, NearbyAlert, DisasterAlert, Recommendation } from '../types';

// Haversine formula to calculate distance in km
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

const deg2rad = (deg: number) => {
  return deg * (Math.PI / 180);
};

export const checkForNearbyInfections = async (user: User): Promise<NearbyAlert[]> => {
    // Return empty if user has no location or crops
    if (!user.location || !user.crops_grown || user.crops_grown.length === 0) return [];

    const supabase = getSupabase();
    if (!supabase) return [];

    // 1. Get diagnoses from the last 24 hours
    // In a real production app with millions of rows, use PostGIS 'st_dwithin' in SQL.
    // For this app, we fetch recent rows and filter in JS (simpler setup for user).
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
        .from('diagnoses')
        .select('*')
        .gt('created_at', twentyFourHoursAgo);

    if (error || !data) return [];

    const alerts: NearbyAlert[] = [];
    const userLat = user.location.lat;
    const userLon = user.location.lon;

    // 2. Filter: Within 30km AND Matches My Crops
    data.forEach((diagnosis: any) => {
        // Skip own diagnoses
        if (diagnosis.user_id === user.id) return;
        
        // Check Crop Match (Simple includes check)
        // Ensure diagnosis.crop matches one of user.crops_grown
        const isRelevantCrop = user.crops_grown?.some(
            myCrop => diagnosis.crop.toLowerCase().includes(myCrop.toLowerCase()) || 
                      myCrop.toLowerCase().includes(diagnosis.crop.toLowerCase())
        );

        if (isRelevantCrop && diagnosis.location) {
            // Parse point (x,y) from Supabase or {lat, lon} depending on how stored
            // Assuming stored as point(x,y) -> [x,y] or object
            let dLat = 0, dLon = 0;
            
            // Handle different PostGIS/Point formats
            if (typeof diagnosis.location === 'string') {
                 // Format "(lat,lon)"
                 const parts = diagnosis.location.replace(/[()]/g, '').split(',');
                 dLat = parseFloat(parts[0]);
                 dLon = parseFloat(parts[1]);
            } else if (Array.isArray(diagnosis.location)) {
                dLat = diagnosis.location[0];
                dLon = diagnosis.location[1];
            } else {
                dLat = diagnosis.location.x || diagnosis.location.lat;
                dLon = diagnosis.location.y || diagnosis.location.lon;
            }

            const dist = calculateDistance(userLat, userLon, dLat, dLon);

            if (dist <= 30) {
                alerts.push({
                    id: diagnosis.id,
                    crop: diagnosis.crop,
                    disease: diagnosis.disease,
                    distanceKm: parseFloat(dist.toFixed(1)),
                    timestamp: new Date(diagnosis.created_at).getTime(),
                    location: diagnosis.district || "Nearby"
                });
            }
        }
    });

    return alerts;
};

// --- CLUSTERING & HEAT MAP DATA ---

export interface DiseaseCluster {
    disease: string;
    count: number;
    avgDistance: number;
    riskLevel: 'High' | 'Moderate' | 'Low';
    points: { lat: number; lon: number; distance: number }[];
}

export const getDiseaseClusters = async (user: User): Promise<DiseaseCluster[]> => {
    if (!user.location) return [];
    
    const supabase = getSupabase();
    if (!supabase) return [];

    // Look back 48 hours for pattern detection
    const lookbackTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
        .from('diagnoses')
        .select('disease, location, created_at')
        .gt('created_at', lookbackTime);

    if (error || !data) return [];

    const userLat = user.location.lat;
    const userLon = user.location.lon;
    
    const clusters: Record<string, { lat: number; lon: number; distance: number }[]> = {};

    data.forEach((row: any) => {
        if (!row.location || !row.disease) return;
        
        let dLat = 0, dLon = 0;
        if (typeof row.location === 'string') {
             const parts = row.location.replace(/[()]/g, '').split(',');
             dLat = parseFloat(parts[0]);
             dLon = parseFloat(parts[1]);
        } else if (Array.isArray(row.location)) {
            dLat = row.location[0];
            dLon = row.location[1];
        } else {
            dLat = row.location.x || row.location.lat;
            dLon = row.location.y || row.location.lon;
        }

        const dist = calculateDistance(userLat, userLon, dLat, dLon);
        
        // Pattern match radius: 50km
        if (dist <= 50) {
            const disease = row.disease;
            if (!clusters[disease]) clusters[disease] = [];
            clusters[disease].push({ lat: dLat, lon: dLon, distance: dist });
        }
    });

    const result: DiseaseCluster[] = [];
    
    Object.entries(clusters).forEach(([disease, points]) => {
        const count = points.length;
        if (count >= 2) { // Threshold for "Cluster" to show on map (low for demo, usually 5)
            const avgDist = points.reduce((acc, p) => acc + p.distance, 0) / count;
            
            let risk: 'High' | 'Moderate' | 'Low' = 'Low';
            if (count >= 5) risk = 'High';
            else if (count >= 3) risk = 'Moderate';

            result.push({
                disease,
                count,
                avgDistance: avgDist,
                riskLevel: risk,
                points
            });
        }
    });

    return result.sort((a, b) => b.count - a.count);
};

// Check specifically for notification triggers
export const checkEpidemicPatterns = async (user: User): Promise<string | null> => {
    const clusters = await getDiseaseClusters(user);
    
    // Find highest risk
    const outbreaks = clusters.filter(c => c.riskLevel === 'High' || c.count >= 5);
    
    if (outbreaks.length > 0) {
        const worst = outbreaks[0];
        return `⚠️ Outbreak Alert: ${worst.disease} detected ${worst.count} times within ${Math.round(worst.avgDistance)}km. Take preventive spray immediately.`;
    }
    
    return null;
};

// --- Popular Crops Suggestion Service ---
export const getPopularCropsNearby = async (lat: number, lon: number): Promise<string[]> => {
    const supabase = getSupabase();
    if (!supabase) {
        // Mock fallback if no DB connection
        return ["Rice", "Wheat", "Cotton", "Sugarcane", "Tomato"]; 
    }

    try {
        // Fetch profiles with location to find neighbors
        const { data } = await supabase.from('profiles').select('crops_grown, location');
        if (!data) return ["Rice", "Wheat", "Maize"];

        const nearbyCrops: Record<string, number> = {};
        
        data.forEach((p: any) => {
            if (!p.location || !p.crops_grown) return;
            
            // Parse Location
            let pLat = 0, pLon = 0;
            if (typeof p.location === 'string') {
                 const parts = p.location.replace(/[()]/g, '').split(',');
                 pLat = parseFloat(parts[0]);
                 pLon = parseFloat(parts[1]);
            } else {
                pLat = p.location.x || p.location.lat;
                pLon = p.location.y || p.location.lon;
            }

            // Check distance (broad 50km for suggestions)
            if (calculateDistance(lat, lon, pLat, pLon) < 50) {
                p.crops_grown.forEach((c: string) => {
                    nearbyCrops[c] = (nearbyCrops[c] || 0) + 1;
                });
            }
        });

        // Sort by frequency
        return Object.entries(nearbyCrops)
            .sort(([, a], [, b]) => b - a)
            .map(([crop]) => crop)
            .slice(0, 5); // Top 5

    } catch (e) {
        return ["Rice", "Wheat", "Tomato"];
    }
};

// --- DISASTER & RECOMMENDATIONS (NEW) ---

export const getDisasterAlerts = async (location: any): Promise<DisasterAlert[]> => {
    // In a real application, this would fetch from a Weather/Disaster API
    // For now, we simulate based on random chance or mock data to showcase the UI
    
    const alerts: DisasterAlert[] = [];
    const rnd = Math.random();

    if (rnd > 0.7) {
        alerts.push({
            id: 'd1',
            type: 'Weather',
            title: 'Heavy Rainfall Warning',
            message: 'Expected 40mm rain in the next 24 hours. Ensure drainage channels are clear.',
            severity: 'critical',
            timestamp: Date.now(),
            source: 'IMD'
        });
    } else if (rnd > 0.4) {
        alerts.push({
            id: 'd2',
            type: 'Pest',
            title: 'Locust Swarm Alert',
            message: 'Locust activity detected in neighboring districts. Monitor fields.',
            severity: 'warning',
            timestamp: Date.now() - 3600000, // 1 hr ago
            source: 'Agri Dept'
        });
    }

    return alerts;
};

export const getFarmRecommendations = async (user: User): Promise<Recommendation[]> => {
    // Mock logic based on user crops
    const recs: Recommendation[] = [];
    const crops = user.crops_grown || ['Wheat', 'Rice'];

    if (crops.includes('Wheat')) {
        recs.push({ 
            id: 'r1', 
            title: 'Wheat Irrigation', 
            description: 'Crown root initiation stage expected. Apply first irrigation if not done.', 
            type: 'Action',
            crop: 'Wheat'
        });
    }
    
    if (crops.includes('Rice') || crops.includes('Paddy')) {
        recs.push({ 
            id: 'r2', 
            title: 'Nitrogen Top Dressing', 
            description: 'Apply split dose of Urea for better tillering.', 
            type: 'Tip',
            crop: 'Rice'
        });
    }

    recs.push({ 
        id: 'r3', 
        title: 'Market Opportunity', 
        description: 'Onion prices up by 15% in local mandi. Good time to sell if harvested.', 
        type: 'Product' 
    });

    return recs;
};
