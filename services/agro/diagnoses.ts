
import { DiagnosisResponse, SoilAnalysisResponse } from "../../types";
import { getSupabase, checkSupabaseConnection } from "../supabaseClient";
import { uploadImage } from "../storageService";
import { saveSpraySchedule, handleDbError } from "./utils";
import { addToQueue } from "../offlineQueueService";

// --- CROP DIAGNOSIS SAVE ---
export const saveDiagnosis = async (userId: string, data: DiagnosisResponse, location?: any, userDescription?: string, imageFile?: File | Blob) => {
    // 1. Local Storage (Immediate)
    const localHistory = JSON.parse(localStorage.getItem('fasal_history') || '[]');
    localStorage.setItem('fasal_history', JSON.stringify([data, ...localHistory].slice(0, 20)));
    
    if (data.spray_schedule) saveSpraySchedule(data.spray_schedule);

    // 2. Prepare DB Payload
    let publicImageUrl = data.imageUrl;
    // Note: Image upload might fail offline. We keep the base64/blob URL if upload fails.
    if (imageFile && navigator.onLine) {
        const url = await uploadImage(imageFile, `diagnosis/${userId}`);
        if (url) {
            publicImageUrl = url;
            data.imageUrl = url; 
        }
    }

    const recordId = data.diagnosis_id || crypto.randomUUID();
    const dbPayload = { 
        id: recordId, 
        user_id: userId, 
        crop: data.crop_identified, 
        disease: data.disease_name_en, 
        severity: data.severity, 
        health_score: data.health_score || 0, 
        image_url: publicImageUrl, 
        full_data: { 
            ...data, 
            type: 'crop', 
            diagnosis_id: recordId, 
            timestamp: Date.now(), 
            imageUrl: publicImageUrl,
            location_context: location 
        }, 
        location: location ? { lat: location.lat, lon: location.lon } : null
    };

    // 3. Try Cloud Save or Queue
    const supabase = getSupabase();
    if (!supabase || !(await checkSupabaseConnection())) {
        addToQueue('SAVE_DIAGNOSIS', dbPayload);
        return;
    }
    
    const { error } = await supabase.from('diagnoses').insert(dbPayload);
    if (error) {
        console.warn("DB Save failed, queuing...", error);
        addToQueue('SAVE_DIAGNOSIS', dbPayload);
    }
};

// --- SOIL DIAGNOSIS SAVE ---
export const saveSoilDiagnosis = async (userId: string, data: SoilAnalysisResponse, location?: any) => {
    const localHistory = JSON.parse(localStorage.getItem('fasal_soil_history') || '[]');
    localStorage.setItem('fasal_soil_history', JSON.stringify([data, ...localHistory].slice(0, 20)));

    const recordId = data.id || crypto.randomUUID();
    const dbPayload = { 
        id: recordId, 
        user_id: userId, 
        crop: "Soil Analysis", 
        disease: data.soilType, 
        severity: `${data.healthScore}% Health`, 
        health_score: data.healthScore || 0, 
        image_url: data.imageUrl,
        full_data: { 
            ...data, 
            type: 'soil',
            timestamp: Date.now(),
            location_context: location 
        }, 
        location: location ? { lat: location.lat, lon: location.lon } : null
    };
    
    const supabase = getSupabase();
    if (!supabase || !(await checkSupabaseConnection())) {
        addToQueue('SAVE_DIAGNOSIS', dbPayload);
        return;
    }
    
    const { error } = await supabase.from('diagnoses').insert(dbPayload);
    if (error) addToQueue('SAVE_DIAGNOSIS', dbPayload);
};

export const submitDiagnosisFeedback = async (diagnosisId: string, rating: number, feedbackText?: string) => {
    const supabase = getSupabase();
    if (supabase && (await checkSupabaseConnection())) {
        await supabase.from('diagnoses').update({
            feedback_rating: rating,
            feedback_notes: feedbackText
        }).eq('id', diagnosisId);
    }
};

export const getUserDiagnoses = async (userId: string, limit: number = 20): Promise<(DiagnosisResponse | SoilAnalysisResponse)[]> => {
    const supabase = getSupabase();
    
    // Always merge local + cloud
    const localCrop = JSON.parse(localStorage.getItem('fasal_history') || '[]');
    const localSoil = JSON.parse(localStorage.getItem('fasal_soil_history') || '[]');
    let combined = [...localCrop, ...localSoil].sort((a: any, b: any) => b.timestamp - a.timestamp).slice(0, limit);

    if (supabase && (await checkSupabaseConnection())) {
        try {
            const { data } = await supabase.from('diagnoses').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
            if (data) {
                const dbItems = data.map((r: any) => {
                    return { ...r.full_data, diagnosis_id: r.id, id: r.id, timestamp: new Date(r.created_at).getTime(), imageUrl: r.image_url };
                });
                // Favor DB data for accuracy
                combined = dbItems;
                localStorage.setItem('fasal_history', JSON.stringify(dbItems.filter((i:any) => i.type !== 'soil')));
            }
        } catch (e) {}
    }
    return combined;
};

// ADMIN FUNCTION
export const getAllDiagnoses = async (limit: number = 100): Promise<any[]> => {
    const supabase = getSupabase();
    if (!supabase || !(await checkSupabaseConnection())) return [];
    try {
        // Fetch diagnoses along with basic profile info
        const { data, error } = await supabase
            .from('diagnoses')
            .select('*, profiles(full_name, email, farmer_id)')
            .order('created_at', { ascending: false })
            .limit(limit);
            
        if (error) {
            console.error("Admin fetch diagnoses error:", error);
            return [];
        }

        return data ? data.map((d: any) => ({ 
            ...d.full_data, 
            diagnosis_id: d.id, 
            user_name: d.profiles?.full_name || 'Unknown', 
            user_email: d.profiles?.email || 'N/A', 
            farmer_id: d.profiles?.farmer_id || 'N/A',
            timestamp: new Date(d.created_at).getTime() 
        })) : [];
    } catch (e) { 
        console.error("Admin diagnoses exception", e);
        return []; 
    }
};
