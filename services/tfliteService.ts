
import { DiagnosisResponse, OfflineModel } from '../types';

// This service manages the lifecycle of the Offline TFLite Model.
// In a real implementation, this would import @tensorflow/tfjs-tflite and load a .tflite file.
// For this demo, we simulate the binary download and inference process with multiple model tiers.

const MODEL_STORAGE_KEY = 'fasal_offline_model_downloaded';
const ACTIVE_MODEL_ID_KEY = 'fasal_offline_active_model_id';

// Define available models
export const AVAILABLE_MODELS: OfflineModel[] = [
    {
        id: 'lite',
        name: 'Fasal Lite',
        size: '25 MB',
        description: 'Fastest download. Basic disease detection.',
        accuracy: 'Standard',
        speed: 'Fast'
    },
    {
        id: 'balanced',
        name: 'Fasal Balanced',
        size: '45 MB',
        description: 'Recommended. Good balance of speed and accuracy.',
        accuracy: 'High',
        speed: 'Medium'
    },
    {
        id: 'pro',
        name: 'Fasal Pro Vision',
        size: '85 MB',
        description: 'Maximum accuracy for complex diseases. Requires more space.',
        accuracy: 'Ultra',
        speed: 'Slow'
    }
];

export const isModelDownloaded = (): boolean => {
    return localStorage.getItem(MODEL_STORAGE_KEY) === 'true';
};

export const getActiveModelId = (): string => {
    return localStorage.getItem(ACTIVE_MODEL_ID_KEY) || 'lite';
};

export const getActiveModelDetails = (): OfflineModel => {
    const id = getActiveModelId();
    return AVAILABLE_MODELS.find(m => m.id === id) || AVAILABLE_MODELS[0];
};

export const deleteModel = async (): Promise<void> => {
    // In real app: await caches.delete('model-cache');
    localStorage.removeItem(MODEL_STORAGE_KEY);
    localStorage.removeItem(ACTIVE_MODEL_ID_KEY);
};

// Simulates downloading a model file
export const downloadModel = async (modelId: string, onProgress: (percent: number) => void): Promise<void> => {
    return new Promise((resolve, reject) => {
        let progress = 0;
        // Simulate different download speeds based on model size
        const speedMultiplier = modelId === 'pro' ? 0.5 : modelId === 'balanced' ? 0.8 : 1.2;
        
        const interval = setInterval(() => {
            progress += (Math.floor(Math.random() * 10) + 5) * speedMultiplier;
            if (progress >= 100) {
                progress = 100;
                onProgress(progress); // Ensure 100% is hit
                clearInterval(interval);
                localStorage.setItem(MODEL_STORAGE_KEY, 'true');
                localStorage.setItem(ACTIVE_MODEL_ID_KEY, modelId);
                resolve();
            } else {
                onProgress(Math.floor(progress));
            }
        }, 300);
    });
};

// Simulates running inference on the local device
export const runLocalInference = async (imageElement: HTMLImageElement | string): Promise<DiagnosisResponse> => {
    const activeModel = getActiveModelDetails();
    
    // Artificial delay to simulate GPU processing based on model complexity
    const delay = activeModel.id === 'pro' ? 3500 : activeModel.id === 'balanced' ? 2000 : 1000;
    await new Promise(resolve => setTimeout(resolve, delay));

    // MOCK INFERENCE LOGIC vary based on model
    const confidence = activeModel.id === 'pro' ? 94 : activeModel.id === 'balanced' ? 88 : 75;
    const detailLevel = activeModel.id === 'pro' ? "High precision analysis" : "Standard analysis";

    return {
        diagnosis_id: crypto.randomUUID(),
        scanId: `LOC_${activeModel.id.toUpperCase()}_${Date.now()}`,
        timestamp: Date.now(),
        isOffline: true,
        
        crop_identified: `Rice (${activeModel.name})`,
        disease_name_en: "Brown Spot",
        disease_name_local: "Brown Spot",
        severity: "Moderate",
        confidence: confidence,
        health_score: activeModel.id === 'pro' ? 62 : 60, // Slight variation
        
        description: `${detailLevel} performed by On-Device ${activeModel.name}. Brown, oval-shaped lesions detected on leaves.`,
        visualSymptoms: ["Oval brown spots", "Yellow halos", "Leaf drying"],
        affectedAreas: ["Leaves"],
        
        treatment_advisory: {
            summary: `Local AI (${activeModel.name}) suggests fungal infection. Treat seeds and improve soil nutrients.`,
            chemical_option: {
                product_name: "Mancozeb 75 WP",
                dosage: "2g/L water",
                application: "Foliar Spray",
                detailed_instructions: "Apply during early morning or late evening."
            },
            organic_option: {
                product_name: "Hot Water Treatment",
                dosage: "53-54°C",
                application: "Seed Dip",
                detailed_instructions: "Dip seeds for 10-12 minutes before sowing."
            },
            cultural_practices: "Use resistant varieties and ensure proper spacing."
        },
        
        dosage_guide: {
            instruction: "Mix 2g Mancozeb per Liter of water.",
            frequency: "Repeat after 10 days if needed",
            waterRequirement: "Approx 150L per acre"
        },
        cost_analysis: {
            totalCostRange: "₹300 - ₹450",
            costPerAcre: "₹350",
            medicineQuantity: "500g",
            labourEstimate: "Self",
            costBreakdown: ["Medicine: ₹350"]
        },
        
        local_language_output: "English",
        next_checkup_date: "5 days"
    };
};
