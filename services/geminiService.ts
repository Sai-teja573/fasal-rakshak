

// BARREL FILE FOR GEMINI SERVICE
// Aggregates modules and implements the Primary AI Logic with Fallbacks

export * from './gemini/analysis'; // Ensure this uses the updated analyzeCropMedia below
export * from './gemini/audio';
export * from './gemini/mappers';
export * from './gemini/offlineData';
export * from './gemini/planning';
export * from './gemini/soilAnalysis';
export * from './gemini/utils';
export * from './gemini/video';

import { GoogleGenAI } from "@google/genai";
import { MandiDetails } from '../types';
import { getGeminiKey } from './gemini/utils';
import { getSecret } from './secretManager';

// Re-export findMandis with better error handling
export const findMandis = async (lat: number, lon: number, query?: string): Promise<MandiDetails[]> => {
    if (!navigator.onLine) return [];
    
    // BUG FIX: Strictly use Google Maps Key. Do not fallback to Gemini Key.
    // Gemini Keys usually do not have access to Places API, causing 403s.
    const apiKey = getSecret('google_maps_key');
    
    // If no Maps key is configured, return empty so UI uses fallback/mock data gracefully
    if (!apiKey) {
        console.warn("Google Maps API Key not found in secrets. Skipping Places API call.");
        return [];
    }

    try {
        const searchText = query || "Wholesale Vegetable Market Agricultural Produce Market Committee Mandi Yard";
        const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.name'
            },
            body: JSON.stringify({
                textQuery: searchText,
                locationBias: {
                    circle: {
                        center: { latitude: lat, longitude: lon },
                        radius: 50000.0 
                    }
                },
                maxResultCount: 10
            })
        });

        if (!response.ok) return [];
        const data = await response.json();
        if (!data.places) return [];

        return data.places.map((place: any) => ({
            name: place.displayName?.text || "Unknown Market",
            address: place.formattedAddress || "Address details unavailable",
            place_id: place.name,
            location: {
                lat: place.location?.latitude || lat,
                lon: place.location?.longitude || lon
            }
        }));

    } catch (e) {
        return [];
    }
};

// --- STREAMING CHAT RESPONSE FOR AI ASSISTANT ---
export const streamGeminiResponse = async (
    prompt: string,
    history: { role: 'user' | 'model'; text: string }[],
    onChunk: (chunk: string) => void
): Promise<string> => {
    const apiKey = getGeminiKey();
    
    // If no API key, return a helpful mock response
    if (!apiKey) {
        const mockResponses = [
            "Namaste! 🙏 I'm currently in demo mode. In the full version, I can help you with crop diseases, market prices, weather forecasts, and farming advice!",
            "Hello farmer! 👨‍🌾 This is a demo response. Connect the Gemini API key in settings to get real AI-powered farming assistance.",
            "Hi! I'm Krishi AI (demo mode). For live assistance with your farming queries, please ensure the API is configured properly."
        ];
        const response = mockResponses[Math.floor(Math.random() * mockResponses.length)];
        
        // Simulate streaming
        for (let i = 0; i < response.length; i += 3) {
            await new Promise(r => setTimeout(r, 20));
            onChunk(response.slice(i, i + 3));
        }
        return response;
    }

    try {
        /* Fix: Initialize GoogleGenAI with apiKey as named parameter and use generateContentStream directly as per guidelines */
        const ai = new GoogleGenAI({ apiKey });
        
        // Format history for Gemini
        const formattedHistory = history.map(h => ({
            role: h.role === 'model' ? 'model' : 'user',
            parts: [{ text: h.text }]
        }));

        /* Fix: Direct call to generateContentStream with model name and contents */
        const result = await ai.models.generateContentStream({
            model: 'gemini-3-flash-preview',
            contents: [
                ...formattedHistory,
                { role: 'user', parts: [{ text: prompt }] }
            ],
            config: {
                systemInstruction: `You are Krishi AI, a friendly and knowledgeable agricultural assistant for Indian farmers. 
                    You specialize in:
                    - Crop disease identification and treatment
                    - Weather-based farming advice
                    - Market prices and best selling times
                    - Fertilizer and pesticide recommendations
                    - Crop planning and rotation
                    - Government schemes for farmers
                    
                    Respond in the same language the farmer uses (Hindi, English, or regional languages).
                    Keep responses concise, practical, and easy to understand.
                    Use emojis appropriately to make responses friendly.
                    Always be encouraging and supportive of the farmer.`,
                temperature: 0.7,
                maxOutputTokens: 1024
            }
        });

        let fullResponse = '';
        
        for await (const chunk of result) {
            const text = chunk.text || '';
            if (text) {
                fullResponse += text;
                onChunk(text);
            }
        }

        return fullResponse;

    } catch (error) {
        console.error('Gemini streaming error:', error);
        const fallbackResponse = "I apologize, I'm having trouble connecting right now. Please try again in a moment. 🙏";
        onChunk(fallbackResponse);
        return fallbackResponse;
    }
};
