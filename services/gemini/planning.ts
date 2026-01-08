
import { GoogleGenAI } from "@google/genai";
import { CropRecommendation, DetailedCropPlan, SoilAnalysisResponse } from "../../types";
import { getGeminiKey, extractJSON, retryOperation } from "./utils";
import { getCropRecommenderTemplate, getDetailedPlanTemplate } from "./prompts";
import { getLanguageName } from "./mappers";
import { trackDailyGeminiCall } from "../cmsService";
import { searchYoutubeVideos, findNearbyStores } from "./analysis";

export const generateCropRecommendations = async (
    soilData: SoilAnalysisResponse | null,
    weatherContext: any,
    marketContext: any[],
    userLocation: string,
    landSize: number,
    waterSource: string,
    language: string
): Promise<CropRecommendation[]> => {
    trackDailyGeminiCall();
    const ai = new GoogleGenAI({ apiKey: getGeminiKey() });
    const targetLang = getLanguageName(language as any);

    const context = `
    FARMER PROFILE:
    - Location: ${userLocation}
    - Land Size: ${landSize} Acres
    - Water Source: ${waterSource}
    - Current Season: ${new Date().toLocaleString('default', { month: 'long' })}
    
    SOIL DATA: ${soilData ? JSON.stringify(soilData.nutrients) + ", pH: " + soilData.phLevel + ", Type: " + soilData.soilType : "Unknown (Assume regional average)"}
    
    WEATHER FORECAST (Next 3 days): ${JSON.stringify(weatherContext)}
    
    LOCAL MARKET TRENDS: ${JSON.stringify(marketContext)}
    `;

    const prompt = `
        ${getCropRecommenderTemplate(targetLang)}
        ${context}
    `;

    try {
        const response = await retryOperation(async () => {
            return await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt
            });
        });

        const text = response.text || "[]";
        const json = JSON.parse(extractJSON(text));
        return Array.isArray(json) ? json : [];
    } catch (e) {
        console.error("Crop Recommendation Failed", e);
        return [];
    }
};

export const generateDetailedCropPlan = async (
    cropName: string,
    soilData: SoilAnalysisResponse | null,
    language: string,
    locationCoords?: { lat: number, lon: number } // New Param
): Promise<DetailedCropPlan | null> => {
    trackDailyGeminiCall();
    const ai = new GoogleGenAI({ apiKey: getGeminiKey() });
    const targetLang = getLanguageName(language as any);

    const context = `
    CROP: ${cropName}
    SOIL: ${soilData ? soilData.soilType : "General"}
    DATE: ${new Date().toLocaleDateString()}
    `;

    const prompt = `
        ${getDetailedPlanTemplate(targetLang)}
        ${context}
    `;

    try {
        const response = await retryOperation(async () => {
            return await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt
            });
        });

        const text = response.text || "{}";
        const json = JSON.parse(extractJSON(text));
        
        if (!json.cropName) return null;

        // 1. Enrich stages with MULTIPLE videos concurrently (3-4 videos)
        if (json.stages && Array.isArray(json.stages)) {
            await Promise.all(json.stages.map(async (stage: any) => {
                if (stage.videoKeyword) {
                    const videoQuery = `${stage.videoKeyword} ${targetLang} farming guide`;
                    const videos = await searchYoutubeVideos(videoQuery, language);
                    stage.videos = videos; // Store all 4 if available
                } else {
                    stage.videos = [];
                }
            }));
        }

        // 2. Fetch and Store Authorized Dealers Persistently
        let savedDealers: any[] = [];
        if (locationCoords) {
            try {
                // Fetch dealers nearby and attach to plan permanently
                const dealers = await findNearbyStores(locationCoords.lat, locationCoords.lon);
                // Add verification badges mock
                savedDealers = dealers.map(d => ({
                    ...d,
                    verified: d.name.toLowerCase().includes('kendra') || d.name.toLowerCase().includes('co-op') || Math.random() > 0.7
                }));
            } catch (e) {
                console.warn("Failed to fetch dealers for plan persistence");
            }
        }

        // Add metadata fields
        const enrichedPlan: DetailedCropPlan = {
            ...json,
            id: crypto.randomUUID(),
            status: 'Active',
            startDate: Date.now(),
            savedDealers: savedDealers,
            language: language // Store generation language
        };

        return enrichedPlan;
    } catch (e) {
        console.error("Detailed Plan Failed", e);
        return null;
    }
};
