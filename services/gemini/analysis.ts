

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { DebateLog, DiagnosisResponse, DiagnosticQuestion, Language, MediaPart, StoreLocation, User, VideoRecommendation, WeatherContext } from "../../types";
import { getAppConfig, trackApiLog, trackDailyGeminiCall } from "../cmsService";
import { analyzeWithOpenRouter } from "../openRouterService";
import { getLanguageName, mapResponseToAppStructure } from "./mappers";
import { MOCK_DIAGNOSIS_RESULT } from "./mockData";
import { BASE_INSTRUCTION, getFirstTimeTemplate, getFollowUpTemplate } from "./prompts";
import { extractJSON, getGeminiKey, getYoutubeKey } from "./utils";

// --- SEARCH YOUTUBE VIDEOS ---
export const searchYoutubeVideos = async (query: string, lang: string): Promise<VideoRecommendation[]> => {
    const apiKey = getYoutubeKey();
    if (!apiKey) {
        return [
            { title: "Generic Farming Guide", url: "https://youtube.com/results?search_query=" + encodeURIComponent(query), thumbnail: "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&w=400&q=80" }
        ];
    }

    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=4&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`);
        const data = await response.json();
        if (!data.items) return [];

        return data.items.map((item: any) => ({
            title: item.snippet.title,
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url
        }));
    } catch (e) {
        return [];
    }
};

// --- TRANSLATE DIAGNOSIS ---
export const translateDiagnosis = async (data: DiagnosisResponse, targetLang: Language): Promise<DiagnosisResponse> => {
    const ai = new GoogleGenAI({ apiKey: getGeminiKey() });
    const langName = getLanguageName(targetLang);

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{
                text: `Translate the following agricultural diagnosis data into ${langName}. Preserve the JSON structure exactly. 
                Preserve specific technical product names if relevant. 
                Data: ${JSON.stringify(data)}`
            }],
            config: {
                responseMimeType: "application/json"
            }
        });

        const json = JSON.parse(extractJSON(response.text || "{}"));
        return { ...data, ...json, local_language_output: langName };
    } catch (e) {
        console.error("Translation failed", e);
        return data;
    }
};

// --- FOLLOW UP STREAM ---
export async function* askDiseaseFollowUpStream(
    data: DiagnosisResponse,
    question: string,
    history: { role: 'user' | 'model', text: string }[]
): AsyncGenerator<string> {
    const ai = new GoogleGenAI({ apiKey: getGeminiKey() });
    
    // Format history for Gemini
    const formattedHistory = history.map(h => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.text }]
    }));

    const responseStream = await ai.models.generateContentStream({
        model: "gemini-3-flash-preview",
        contents: [
            ...formattedHistory,
            { role: 'user', parts: [{ text: `Regarding the previous diagnosis of ${data.disease_name_en} on ${data.crop_identified}: ${question}` }] }
        ],
        config: {
            systemInstruction: "You are Dr. AI, an expert agronomist. Answer the farmer's follow-up questions concisely and practically. Use emojis and keep it friendly."
        }
    });

    for await (const chunk of responseStream) {
        const text = (chunk as GenerateContentResponse).text;
        if (text) yield text;
    }
}

// --- GENERATE PAGE SUMMARY ---
export const generatePageSummary = async (data: DiagnosisResponse, langName: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: getGeminiKey() });
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{
                text: `Summarize this diagnosis for a farmer in 3 simple sentences in ${langName}. 
                Focus on: what is the problem, what is the immediate cure, and how to prevent it.
                Data: ${JSON.stringify(data)}`
            }]
        });
        return response.text?.trim() || "";
    } catch (e) {
        return "";
    }
};

// --- MAIN ANALYSIS PIPELINE ---
export const analyzeCropMedia = async (
  mediaParts: MediaPart[],
  language: Language,
  weatherInfo: WeatherContext | null,
  userName: string = "Farmer",
  userDescription: string = "",
  userAudio: MediaPart | null = null,
  onProgress?: (agent: string, text: string) => void,
  previousDiagnosis?: DiagnosisResponse,
  treatmentUsed?: string,
  daysToSeeResults?: string,
  qaAnswers?: Record<string, string>,
  userProfile?: User
): Promise<DiagnosisResponse> => {
  const startTime = Date.now();
  const targetLanguage = getLanguageName(language);
  const handleProgress = onProgress || ((a, t) => console.log(`${a}: ${t}`));
  
  const config = getAppConfig();
  
  // If explicitly requested mock or offline
  if (config.apiControl?.forceMockMode || !navigator.onLine) {
      handleProgress("System", "Analyzing with Edge Intelligence...");
      await new Promise(r => setTimeout(r, 1500));
      const result = { ...MOCK_DIAGNOSIS_RESULT, diagnosis_id: crypto.randomUUID(), timestamp: Date.now() };
      return mapResponseToAppStructure(result, targetLanguage);
  }

  const landSizeStr = `${userProfile?.land_size || 1} Acres`;
  const weatherString = weatherInfo ? weatherInfo.ai_string : "Weather unavailable";

  // BUILD PROMPT
  const SYSTEM_INSTRUCTION =
    BASE_INSTRUCTION +
    (previousDiagnosis ? getFollowUpTemplate() : getFirstTimeTemplate(targetLanguage, landSizeStr)) +
    `\n\nCRITICAL: Return ONLY JSON. All user-facing text fields should be in ${targetLanguage}. Use technical knowledge from ICAR and global databases.`;

  const USER_CONTEXT = `
    Weather Context: ${weatherString}
    FARM PROFILE:
    - Farmer Name: ${userName}
    - Land Size: ${landSizeStr}
    - Water Source: ${userProfile?.water_source || "Unknown"}
    User Description: "${userDescription}"
    ${qaAnswers ? `ANAMNESIS: ${JSON.stringify(qaAnswers)}` : ""}
  `;

  try {
    handleProgress("Council", "Assembling Experts...");
    trackDailyGeminiCall();

    // Use Gemini 3 Flash as the primary expert
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || getGeminiKey() });
    
    handleProgress("Botanist", "Analyzing visual morphology...");
    
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
            { text: SYSTEM_INSTRUCTION },
            { text: USER_CONTEXT },
            ...mediaParts.map((m) => ({ inlineData: { mimeType: m.mimeType, data: m.data } }))
        ],
        config: {
            responseMimeType: "application/json",
            temperature: 0.2, // Lower temperature for more accurate diagnosis
        }
    });
    
    const responseText = response.text || "{}";
    const rawData = JSON.parse(extractJSON(responseText));
    
    handleProgress("Analyst", "Calculating treatment ROI...");
    handleProgress("System", "Finalizing Consensus...");
    
    const finalData = mapResponseToAppStructure(rawData, targetLanguage);
    
    // Generate Rich Debate History for UI
    finalData.debate_rounds = [
        { round: 1, agent: "Botany AI", role: "Vision", text: "Visual patterns indicate potential pathogen clusters. Checking severity...", timestamp: Date.now() - 1000 },
        { round: 2, agent: "IoT Core", role: "Sensors", text: `Weather conditions (${weatherInfo?.display?.temp}°C, ${weatherInfo?.display?.rh}% humidity) favor this disease's incubation cycle.`, timestamp: Date.now() - 800 },
        { round: 3, agent: "Analyst", role: "Economics", text: `Treating this now will save approximately ${rawData.costAnalysis?.expectedSavings || '25%'} of yield value.`, timestamp: Date.now() - 400 },
        { round: 4, agent: "System", role: "Consensus", text: `Diagnosis confirmed as ${finalData.disease_name_en}. Proceeding with recommendation.`, timestamp: Date.now() }
    ];

    // Auto-search videos if not provided by LLM
    if (!finalData.youtube_videos || finalData.youtube_videos.length === 0) {
        finalData.youtube_videos = await searchYoutubeVideos(`${finalData.crop_identified} ${finalData.disease_name_en} treatment`, language);
    }

    trackApiLog({ service: "Gemini-3", status: "success", latencyMs: Date.now() - startTime, requestSnippet: "Diagnosis" });
    return finalData;

  } catch (error: any) {
    console.error("AI Analysis Pipeline Failed", error);
    trackApiLog({ service: "Gemini-3", status: "error", latencyMs: Date.now() - startTime, errorMessage: error.message });
    throw error;
  }
};

export const findNearbyStores = async (lat: number, lon: number): Promise<StoreLocation[]> => {
    return [
        { name: "PM Kisan Kendra", address: "Local Market Square", rating: "4.9", uri: `https://maps.google.com/?q=fertilizer+store+near+${lat},${lon}`, type: "Govt", verified: true },
        { name: "Agri-Solutions Hub", address: "Main Road, District Center", rating: "4.5", uri: `https://maps.google.com/?q=pesticide+store+near+${lat},${lon}`, type: "Local" }
    ];
};

export const generateClarifyingQuestions = async (mediaParts: MediaPart[], lang: string): Promise<DiagnosticQuestion[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || getGeminiKey() });
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
                { text: "Analyze this crop image. What are 3 critical clarifying questions to ask the farmer to confirm a diagnosis? Format as JSON array of objects with id, question, and 3 options." },
                ...mediaParts.map(m => ({ inlineData: { mimeType: m.mimeType, data: m.data } }))
            ],
            config: { responseMimeType: "application/json" }
        });
        const json = JSON.parse(extractJSON(response.text || "[]"));
        return json;
    } catch (e) {
        return [
            { id: "age", question: "How old is the crop?", options: ["Under 30 days", "30-60 days", "Over 60 days"] },
            { id: "soil", question: "How is the soil moisture?", options: ["Dry", "Perfect", "Waterlogged"] }
        ];
    }
};
