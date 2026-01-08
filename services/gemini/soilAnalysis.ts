
import { GoogleGenAI } from "@google/genai";
import { MediaPart, SoilAnalysisResponse, WeatherContext, User } from "../../types";
import { getGeminiKey, extractJSON, retryOperation } from "./utils";
import { SOIL_SYSTEM_INSTRUCTION, getSoilAnalysisTemplate } from "./soilPrompts";
import { getLanguageName } from "./mappers";
import { trackDailyGeminiCall } from "../cmsService";
import { searchYoutubeVideos } from "./analysis"; // Import existing search function

export const analyzeSoilMedia = async (
  mediaParts: MediaPart[],
  language: string,
  weatherInfo: WeatherContext | null,
  userDescription: string,
  userProfile?: User
): Promise<SoilAnalysisResponse> => {
  trackDailyGeminiCall();
  
  const ai = new GoogleGenAI({ apiKey: getGeminiKey() });
  const targetLang = getLanguageName(language as any);
  
  const locationStr = userProfile?.location 
    ? `${userProfile.location.district}, ${userProfile.location.state}` 
    : weatherInfo?.display.location || "India (Unknown District)";

  const prompt = `
    ${SOIL_SYSTEM_INSTRUCTION}
    ${getSoilAnalysisTemplate(targetLang)}
    
    CONTEXT:
    - Location: ${locationStr} (Use this for Government Soil Data baseline).
    - Weather: ${weatherInfo?.ai_string || "N/A"}.
    - Farmer Notes: ${userDescription}
    - Land Size: ${userProfile?.land_size || 1} acres.
  `;

  try {
    const response = await retryOperation(async () => {
        return await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [
                    { text: prompt },
                    ...mediaParts.map(m => ({ inlineData: { mimeType: m.mimeType, data: m.data } }))
                ]
            }
        });
    });

    const text = response.text || "{}";
    const json = JSON.parse(extractJSON(text));

    // Fetch Videos based on findings
    let videos: any[] = [];
    if (json.soilType) {
        const query = `${json.soilType} soil improvement techniques ${json.recommendations?.crops?.[0] || 'farming'}`;
        videos = await searchYoutubeVideos(query, language);
    }

    return {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        ...json,
        local_language_output: targetLang,
        imageUrl: `data:${mediaParts[0].mimeType};base64,${mediaParts[0].data}`,
        youtube_videos: videos
    };

  } catch (e) {
    console.error("Soil Analysis Failed", e);
    throw new Error("Failed to analyze soil. Please try again.");
  }
};
