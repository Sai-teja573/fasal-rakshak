
import { trackApiLog } from "./cmsService";
import { MediaPart } from "../types";
import { getSecret, ApiKeys } from "./secretManager";

// Intelligent Fallback Models
const PRIMARY_MODEL = "google/gemini-2.0-flash-lite-001"; 
const SECONDARY_MODEL = "meta-llama/llama-3.3-70b-instruct:free"; 
const TERTIARY_MODEL = "mistralai/mixtral-8x7b-instruct";

export const analyzeWithOpenRouter = async (
    mediaParts: MediaPart[],
    systemInstruction: string,
    userContext: string,
    specificKeyName?: keyof ApiKeys
): Promise<string> => {
    const startTime = Date.now();
    
    // 1. Determine Key (Specific Feature Key or Primary Fallback)
    const apiKey = specificKeyName ? getSecret(specificKeyName) : getSecret('openrouter_key');
    
    if (!apiKey) throw new Error("OpenRouter API Key missing");

    // 2. Prepare Content
    const content: any[] = [
        { type: "text", text: systemInstruction + "\n\n" + userContext }
    ];

    mediaParts.forEach(part => {
        if (part.mimeType.startsWith('image')) {
            content.push({
                type: "image_url",
                image_url: { url: `data:${part.mimeType};base64,${part.data}` }
            });
        }
    });

    // 3. Recursive Try Function (Model Chain)
    const tryModel = async (model: string, retryCount: number): Promise<string> => {
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "HTTP-Referer": window.location.href,
                    "X-Title": "Fasal Rakshak",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: "user", content: content }],
                    response_format: { type: "json_object" }, // Force JSON
                    transforms: ["middle-out"]
                })
            });

            if (!response.ok) {
                if (response.status === 429) throw new Error("Rate Limit");
                const errText = await response.text();
                throw new Error(`Status ${response.status}: ${errText}`);
            }

            const data = await response.json();
            const resultText = data.choices?.[0]?.message?.content || "{}";

            trackApiLog({
                service: 'OpenRouter',
                status: 'success',
                latencyMs: Date.now() - startTime,
                requestSnippet: `Model: ${model}`,
                responseSnippet: resultText.substring(0, 50)
            });

            return resultText;

        } catch (error: any) {
            console.warn(`OpenRouter (${model}) failed:`, error.message);
            
            // Chain: Primary -> Secondary -> Tertiary -> Fail
            if (model === PRIMARY_MODEL) return tryModel(SECONDARY_MODEL, retryCount);
            if (model === SECONDARY_MODEL) return tryModel(TERTIARY_MODEL, retryCount);
            
            throw error; // All models failed
        }
    };

    try {
        return await tryModel(PRIMARY_MODEL, 0);
    } catch (finalError: any) {
        trackApiLog({
            service: 'OpenRouter',
            status: 'error',
            latencyMs: Date.now() - startTime,
            errorMessage: "All Fallback Models Failed"
        });
        throw finalError;
    }
};

export const chatWithOpenRouter = async (
    systemPrompt: string,
    history: {role: 'user'|'model', text: string}[],
    newMessage: string
): Promise<string> => {
    const apiKey = getSecret('openrouter_key');
    const messages = [
        { role: "system", content: systemPrompt },
        ...history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })),
        { role: "user", content: newMessage }
    ];

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: SECONDARY_MODEL, // Cheaper model for chat
                messages: messages
            })
        });

        if (!response.ok) throw new Error("Chat API Failed");
        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
    } catch (e) {
        return "I am having trouble connecting to the network. Please try again.";
    }
};
