/**
 * Google Cloud Translation API Service
 * Provides real-time translation for messages and UI content
 * Uses Cloud Translation API v2 (Basic)
 */

import { Language } from '../types';
import { getSecret } from './secretManager';
import { getCachedTranslation, saveCachedTranslation } from './translationCache';

// Google Cloud Translation language codes
const LANGUAGE_CODE_MAP: Record<Language, string> = {
    'en': 'en',
    'hi': 'hi',
    'or': 'or',  // Odia
    'te': 'te',  // Telugu
    'bn': 'bn',  // Bengali
    'mr': 'mr',  // Marathi
    'ta': 'ta',  // Tamil
    'gu': 'gu',  // Gujarati
    'kn': 'kn',  // Kannada
    'ml': 'ml',  // Malayalam
    'pa': 'pa',  // Punjabi
};

// In-memory cache for faster lookups
const memoryCache: Map<string, { text: string; timestamp: number }> = new Map();
const MEMORY_CACHE_TTL = 1000 * 60 * 30; // 30 minutes

interface TranslationResponse {
    data: {
        translations: Array<{
            translatedText: string;
            detectedSourceLanguage?: string;
        }>;
    };
}

/**
 * Translate text using Google Cloud Translation API
 */
export const translateText = async (
    text: string,
    targetLang: Language,
    sourceLang?: Language
): Promise<string> => {
    // Don't translate if already in target language or empty
    if (!text || text.trim() === '' || targetLang === 'en' && !sourceLang) {
        return text;
    }

    // Skip if target is English and we're not forcing translation
    if (targetLang === 'en') {
        return text;
    }

    const cacheKey = `translate_${sourceLang || 'auto'}_${targetLang}_${text.substring(0, 100)}`;
    
    // Check memory cache first
    const memCached = memoryCache.get(cacheKey);
    if (memCached && Date.now() - memCached.timestamp < MEMORY_CACHE_TTL) {
        return memCached.text;
    }

    // Check IndexedDB cache
    const dbCached = await getCachedTranslation(cacheKey, targetLang);
    if (dbCached) {
        memoryCache.set(cacheKey, { text: dbCached, timestamp: Date.now() });
        return dbCached;
    }

    try {
        const apiKey = getSecret('google_translate_key');
        if (!apiKey) {
            console.warn('[GoogleTranslate] No API key configured');
            return text;
        }

        const targetCode = LANGUAGE_CODE_MAP[targetLang] || 'en';
        const sourceCode = sourceLang ? LANGUAGE_CODE_MAP[sourceLang] : undefined;

        const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
        
        const body: any = {
            q: text,
            target: targetCode,
            format: 'text'
        };

        if (sourceCode) {
            body.source = sourceCode;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[GoogleTranslate] API Error:', response.status, errorText);
            return text;
        }

        const data: TranslationResponse = await response.json();
        const translatedText = data.data.translations[0]?.translatedText || text;

        // Cache the result
        memoryCache.set(cacheKey, { text: translatedText, timestamp: Date.now() });
        await saveCachedTranslation(cacheKey, targetLang, translatedText);

        return translatedText;
    } catch (error) {
        console.error('[GoogleTranslate] Failed to translate:', error);
        return text;
    }
};

/**
 * Translate multiple texts in a single batch request
 * More efficient for translating multiple strings at once
 */
export const translateBatch = async (
    texts: string[],
    targetLang: Language,
    sourceLang?: Language
): Promise<string[]> => {
    if (!texts || texts.length === 0) return [];
    if (targetLang === 'en') return texts;

    // Filter out empty texts and track indices
    const validTexts: { text: string; index: number }[] = [];
    const results: string[] = new Array(texts.length);
    
    texts.forEach((text, index) => {
        if (text && text.trim()) {
            validTexts.push({ text, index });
        } else {
            results[index] = text;
        }
    });

    if (validTexts.length === 0) return texts;

    // Check cache for each text
    const uncachedTexts: { text: string; index: number }[] = [];
    
    for (const item of validTexts) {
        const cacheKey = `translate_${sourceLang || 'auto'}_${targetLang}_${item.text.substring(0, 100)}`;
        
        // Check memory cache
        const memCached = memoryCache.get(cacheKey);
        if (memCached && Date.now() - memCached.timestamp < MEMORY_CACHE_TTL) {
            results[item.index] = memCached.text;
            continue;
        }

        // Check DB cache
        const dbCached = await getCachedTranslation(cacheKey, targetLang);
        if (dbCached) {
            results[item.index] = dbCached;
            memoryCache.set(cacheKey, { text: dbCached, timestamp: Date.now() });
            continue;
        }

        uncachedTexts.push(item);
    }

    if (uncachedTexts.length === 0) return results;

    try {
        const apiKey = getSecret('google_translate_key');
        if (!apiKey) {
            console.warn('[GoogleTranslate] No API key configured');
            uncachedTexts.forEach(item => results[item.index] = item.text);
            return results;
        }

        const targetCode = LANGUAGE_CODE_MAP[targetLang] || 'en';
        const sourceCode = sourceLang ? LANGUAGE_CODE_MAP[sourceLang] : undefined;

        const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
        
        const body: any = {
            q: uncachedTexts.map(item => item.text),
            target: targetCode,
            format: 'text'
        };

        if (sourceCode) {
            body.source = sourceCode;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            console.error('[GoogleTranslate] Batch API Error:', response.status);
            uncachedTexts.forEach(item => results[item.index] = item.text);
            return results;
        }

        const data: TranslationResponse = await response.json();
        
        data.data.translations.forEach((translation, i) => {
            const item = uncachedTexts[i];
            const translatedText = translation.translatedText || item.text;
            results[item.index] = translatedText;

            // Cache the result
            const cacheKey = `translate_${sourceLang || 'auto'}_${targetLang}_${item.text.substring(0, 100)}`;
            memoryCache.set(cacheKey, { text: translatedText, timestamp: Date.now() });
            saveCachedTranslation(cacheKey, targetLang, translatedText);
        });

        return results;
    } catch (error) {
        console.error('[GoogleTranslate] Batch translation failed:', error);
        uncachedTexts.forEach(item => results[item.index] = item.text);
        return results;
    }
};

/**
 * Detect the language of a text
 */
export const detectLanguage = async (text: string): Promise<Language | null> => {
    if (!text || text.trim() === '') return null;

    try {
        const apiKey = getSecret('google_translate_key');
        if (!apiKey) return null;

        const url = `https://translation.googleapis.com/language/translate/v2/detect?key=${apiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ q: text }),
        });

        if (!response.ok) return null;

        const data = await response.json();
        const detectedCode = data.data.detections[0][0]?.language;
        
        // Map back to our Language type
        const entry = Object.entries(LANGUAGE_CODE_MAP).find(([_, code]) => code === detectedCode);
        return entry ? entry[0] as Language : null;
    } catch (error) {
        console.error('[GoogleTranslate] Language detection failed:', error);
        return null;
    }
};

/**
 * Auto-translate message based on user's preferred language
 * Useful for chat messages where sender might use different language
 */
export const autoTranslateMessage = async (
    messageText: string,
    userPreferredLang: Language
): Promise<{ original: string; translated: string; sourceLang: Language | null }> => {
    // Detect the source language
    const sourceLang = await detectLanguage(messageText);
    
    // If already in user's preferred language, no translation needed
    if (sourceLang === userPreferredLang) {
        return { original: messageText, translated: messageText, sourceLang };
    }

    // Translate to user's preferred language
    const translated = await translateText(messageText, userPreferredLang, sourceLang || undefined);
    
    return { original: messageText, translated, sourceLang };
};

/**
 * Clear the in-memory cache
 */
export const clearMemoryCache = () => {
    memoryCache.clear();
};

// Export utility for testing
export const __TEST_ONLY__ = {
    memoryCache,
    MEMORY_CACHE_TTL,
};
