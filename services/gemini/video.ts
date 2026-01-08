
import { GoogleGenAI } from "@google/genai";
import { getGeminiKey } from "./utils";

export const generateVeoVideo = async (
    prompt: string,
    onProgress?: (msg: string) => void
): Promise<string | null> => {
    
    const runGeneration = async (key: string) => {
        const ai = new GoogleGenAI({ apiKey: key });
        
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: `Cinematic farming video: ${prompt}. Photorealistic, 720p, clear focus on crop details.`,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        });

        if (onProgress) onProgress("Generating Video Frames...");

        // Poll for completion
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5s
            if (onProgress) onProgress("Processing... (This takes ~30s)");
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        
        if (videoUri) {
            // Append Key for direct access
            return `${videoUri}&key=${key}`; 
        }
        
        return null;
    };

    try {
        if (!navigator.onLine) throw new Error("Offline");
        
        if (onProgress) onProgress("Initializing Veo Model...");

        let currentKey = getGeminiKey();

        try {
            return await runGeneration(currentKey);
        } catch (e: any) {
            const is404 = e.message?.includes("Requested entity was not found") || e.message?.includes("404") || e.status === 404;
            
            // If Veo model not found, likely due to API Key restrictions. Prompt user to select paid key.
            if (is404 && typeof window !== 'undefined' && (window as any).aistudio) {
                console.warn("Veo 404: Triggering Key Selection");
                if (onProgress) onProgress("Project Access Error. Requesting Key...");
                
                await (window as any).aistudio.openSelectKey();
                
                // Retry with the fresh key from env
                // We use process.env.API_KEY directly here as it is injected by the platform after selection
                const newKey = process.env.API_KEY || currentKey;
                
                if (onProgress) onProgress("Retrying with new key...");
                return await runGeneration(newKey);
            }
            throw e;
        }

    } catch (e: any) {
        console.error("Veo Generation Failed", e);
        if (onProgress) onProgress(`Generation Failed: ${e.message?.slice(0, 60)}...`);
        return null;
    }
};
