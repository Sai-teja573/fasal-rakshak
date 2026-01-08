
import { trackApiLog } from './cmsService';
import { NewsItem, Scheme, Language, MarketItem, DetailedCropPlan } from '../types';
import { getCachedTranslation, saveCachedTranslation } from './translationCache';
import { getSecret } from './secretManager';
import { getAgroStateNews, getGovernmentSchemes } from './agro/content';

// Helper to chunk arrays
const chunkArray = <T>(array: T[], size: number): T[][] => {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
};

// --- GOOGLE CLOUD TRANSLATION API (V3/V2) IMPLEMENTATION ---

// Extracts translatable strings from objects and keeps track of their paths
const extractTranslatableStrings = (items: any[]): { strings: string[], paths: { itemIndex: number, key: string }[] } => {
    const strings: string[] = [];
    const paths: { itemIndex: number, key: string }[] = [];
    
    // Comprehensive list of translatable keys across all app data types
    const translatableKeys = [
        'title', 'summary', 'full_content', 'content', // News & Guides
        'name', 'benefit', 'details', 'full_details', // Schemes
        'message', 'description', 'advice_reason', // Market & General
        'stageName', 'waterNeeds', 'fertilizer', 'task', // Crop Plan
        'reasoning', 'estimatedYield', 'estimatedIncome', // Recommendation
        'disease_name_local', 'local_language_output' // Diagnosis
    ];

    items.forEach((item, index) => {
        translatableKeys.forEach(key => {
            if (item[key] && typeof item[key] === 'string' && item[key].trim().length > 0) {
                strings.push(item[key]);
                paths.push({ itemIndex: index, key });
            }
        });
    });

    return { strings, paths };
};

const translateHtmlBatch = async (
    items: any[], 
    targetLang: string, 
    type: 'news' | 'schemes' | 'general' | 'plans'
): Promise<any[]> => {
    const apiKey = getSecret('google_translate_key') || getSecret('gemini_key'); 
    const projectId = getSecret('google_cloud_project_id');

    if (!apiKey) {
        console.warn("Translation API Key missing");
        return items;
    }

    const startTime = Date.now();

    try {
        const { strings, paths } = extractTranslatableStrings(items);
        if (strings.length === 0) return items;

        let url = '';
        let body: any = {};

        // Use Cloud Translation V3 if project ID is provided, else fallback to V2 Basic
        if (projectId && projectId !== 'fasal-rakshak-ai' && projectId !== '') {
            url = `https://translation.googleapis.com/v3/projects/${projectId}/locations/global:translateText?key=${apiKey}`;
            body = {
                contents: strings,
                mimeType: "text/html", // Essential for eHTML conversion/preservation
                targetLanguageCode: targetLang
            };
        } else {
            url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
            body = {
                q: strings,
                target: targetLang,
                format: "html" // Preserves HTML tags during translation
            };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Google Translate API Error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const translations = data.translations || data.data?.translations; 
        
        if (!translations || !Array.isArray(translations)) {
            throw new Error("Invalid response format from Translation API");
        }

        const translatedItems = items.map(item => ({ ...item }));
        
        translations.forEach((t: any, i: number) => {
            const translatedText = t.translatedText;
            const path = paths[i];
            if (path && translatedItems[path.itemIndex]) {
                translatedItems[path.itemIndex][path.key] = translatedText;
            }
        });

        trackApiLog({
            service: 'Google-Cloud-Translation',
            status: 'success',
            latencyMs: Date.now() - startTime,
            requestSnippet: `Batch ${type} (${strings.length} strings) to ${targetLang}`
        });

        return translatedItems;

    } catch (e: any) {
        console.error("Advanced Translation Error:", e);
        trackApiLog({
            service: 'Google-Cloud-Translation',
            status: 'error',
            latencyMs: Date.now() - startTime,
            errorMessage: e.message
        });
        return items;
    }
};

// --- PUBLIC DATA TRANSLATION WRAPPERS ---

export const translateNewsData = async (news: NewsItem[], lang: Language): Promise<NewsItem[]> => {
    if (lang === 'en') return news;
    const langCode = getLangCode(lang);
    
    const finalResults: NewsItem[] = new Array(news.length);
    const itemsToTranslate: { index: number, item: any }[] = [];

    await Promise.all(news.map(async (item, index) => {
        const cached = await getCachedTranslation(item.id, lang);
        if (cached) {
            finalResults[index] = { ...item, ...cached };
        } else {
            itemsToTranslate.push({ 
                index, 
                item: { id: item.id, title: item.title, summary: item.summary } 
            });
        }
    }));

    if (itemsToTranslate.length === 0) return finalResults.filter(Boolean);

    const chunks = chunkArray(itemsToTranslate, 10); 
    
    for (const chunk of chunks) {
        const batchPayload = chunk.map(c => c.item);
        const translatedBatch = await translateHtmlBatch(batchPayload, langCode, 'news');
        
        chunk.forEach((original, idx) => {
            const translated = translatedBatch[idx];
            if (translated && translated.title) {
                saveCachedTranslation(original.item.id, lang, translated);
                finalResults[original.index] = { ...news[original.index], ...translated };
            } else {
                finalResults[original.index] = news[original.index];
            }
        });
    }

    return finalResults.filter(Boolean);
};

export const translateSingleNewsContent = async (item: NewsItem, lang: Language): Promise<NewsItem> => {
    if (lang === 'en') return item;
    
    const cached = await getCachedTranslation(item.id, lang);
    if (cached && cached.full_content) {
        return { ...item, ...cached };
    }

    const langCode = getLangCode(lang);
    const result = await translateHtmlBatch([{ full_content: item.full_content }], langCode, 'news');
    
    if (result && result[0] && result[0].full_content) {
        const updated = { ...item, full_content: result[0].full_content };
        const existingCache = await getCachedTranslation(item.id, lang) || {};
        saveCachedTranslation(item.id, lang, { ...existingCache, full_content: result[0].full_content });
        return updated;
    }
    
    return item;
};

export const translateSchemesData = async (schemes: Scheme[], lang: Language): Promise<Scheme[]> => {
    if (lang === 'en') return schemes;
    const langCode = getLangCode(lang);

    const finalResults: Scheme[] = new Array(schemes.length);
    const itemsToTranslate: { index: number, item: any }[] = [];

    await Promise.all(schemes.map(async (item, index) => {
        const cached = await getCachedTranslation(item.id, lang);
        if (cached) {
            finalResults[index] = { ...item, ...cached };
        } else {
            itemsToTranslate.push({ 
                index, 
                item: { id: item.id, name: item.name, benefit: item.benefit } 
            });
        }
    }));

    if (itemsToTranslate.length === 0) return finalResults.filter(Boolean);

    const chunks = chunkArray(itemsToTranslate, 10);

    for (const chunk of chunks) {
        const batchPayload = chunk.map(c => c.item);
        const translatedBatch = await translateHtmlBatch(batchPayload, langCode, 'schemes');
        
        chunk.forEach((original, idx) => {
            const translated = translatedBatch[idx];
            if (translated && translated.name) {
                saveCachedTranslation(original.item.id, lang, translated);
                finalResults[original.index] = { ...schemes[original.index], ...translated };
            } else {
                finalResults[original.index] = schemes[original.index];
            }
        });
    }

    return finalResults.filter(Boolean);
};

export const translateGenericData = async (items: any[], lang: Language): Promise<any[]> => {
    if (!items || items.length === 0 || lang === 'en') return items;
    const langCode = getLangCode(lang);

    const finalResults: any[] = new Array(items.length);
    const itemsToTranslate: { index: number, item: any }[] = [];

    await Promise.all(items.map(async (item, index) => {
        if (!item.id) { finalResults[index] = item; return; }
        
        const cached = await getCachedTranslation(item.id, lang);
        if (cached) {
            finalResults[index] = { ...item, ...cached };
        } else {
            const payload: any = { id: item.id };
            if (item.title) payload.title = item.title;
            if (item.message) payload.message = item.message;
            if (item.description) payload.description = item.description;
            if (item.reasoning) payload.reasoning = item.reasoning;
            
            itemsToTranslate.push({ index, item: payload });
        }
    }));

    if (itemsToTranslate.length === 0) return finalResults.filter(Boolean);

    const chunks = chunkArray(itemsToTranslate, 10);

    for (const chunk of chunks) {
        const batchPayload = chunk.map(c => c.item);
        const translatedBatch = await translateHtmlBatch(batchPayload, langCode, 'general');
        
        chunk.forEach((original, idx) => {
            const translated = translatedBatch[idx];
            if (translated) {
                saveCachedTranslation(original.item.id, lang, translated);
                finalResults[original.index] = { ...items[original.index], ...translated };
            } else {
                finalResults[original.index] = items[original.index];
            }
        });
    }

    return finalResults.filter(Boolean);
};

export const translateAiSummary = async (summary: any, lang: Language): Promise<any> => {
    if (!summary || lang === 'en') return summary;
    
    const summaryKey = `sum_${new Date().getDate()}_${lang}`;
    const cached = await getCachedTranslation(summaryKey, lang);
    if (cached) return cached;

    const langCode = getLangCode(lang);
    const result = await translateHtmlBatch([summary], langCode, 'general');
    const final = result[0] || summary;
    
    if (final !== summary) {
        saveCachedTranslation(summaryKey, lang, final);
    }
    
    return final;
};

export const translateMarketData = async (items: MarketItem[], lang: Language): Promise<MarketItem[]> => {
    if (lang === 'en') return items;
    const langCode = getLangCode(lang);

    const itemsToTranslate = items.map((item, index) => ({
        index,
        item: {
            advice_reason: item.advice_reason,
        }
    }));

    if (itemsToTranslate.length === 0) return items;

    const chunks = chunkArray(itemsToTranslate, 10);
    const finalResults = [...items];

    for (const chunk of chunks) {
        const batchPayload = chunk.map(c => c.item);
        const translatedBatch = await translateHtmlBatch(batchPayload, langCode, 'general');

        chunk.forEach((original, idx) => {
            const translated = translatedBatch[idx];
            if (translated) {
                finalResults[original.index] = { ...items[original.index], ...translated };
            }
        });
    }
    
    return finalResults;
};

export const translateCropPlan = async (plan: DetailedCropPlan, lang: Language): Promise<DetailedCropPlan> => {
    if (lang === 'en') return plan;
    const langCode = getLangCode(lang);
    
    const cacheKey = `plan:${plan.id}:${lang}`;
    const cached = await getCachedTranslation(cacheKey, lang);
    if (cached) return { ...plan, ...cached };

    const itemsToTranslate: any[] = [];
    const mapping: {type: 'stage' | 'task' | 'meta', stageIdx?: number, taskIdx?: number}[] = [];

    // Translate Top Level Metadata
    itemsToTranslate.push({
        cropName: plan.cropName,
        variety: plan.variety,
        sowingSeason: plan.sowingSeason,
        overallBudget: plan.overallBudget,
        expectedHarvest: plan.expectedHarvest
    });
    mapping.push({ type: 'meta' });

    // Translate Stages and Tasks
    plan.stages.forEach((stage, sIdx) => {
        itemsToTranslate.push({
            stageName: stage.stageName,
            description: stage.description,
            waterNeeds: stage.waterNeeds,
            fertilizer: stage.fertilizer
        });
        mapping.push({ type: 'stage', stageIdx: sIdx });

        stage.tasks.forEach((task, tIdx) => {
            itemsToTranslate.push({ task: task.task });
            mapping.push({ type: 'task', stageIdx: sIdx, taskIdx: tIdx });
        });
    });

    const chunks = chunkArray(itemsToTranslate, 15);
    const translatedResults: any[] = [];

    for (const chunk of chunks) {
        const res = await translateHtmlBatch(chunk, langCode, 'plans');
        translatedResults.push(...res);
    }

    const newPlan = JSON.parse(JSON.stringify(plan));
    
    translatedResults.forEach((res, i) => {
        const map = mapping[i];
        if (map.type === 'meta') {
            newPlan.cropName = res.cropName;
            newPlan.variety = res.variety;
            newPlan.sowingSeason = res.sowingSeason;
            newPlan.overallBudget = res.overallBudget;
            newPlan.expectedHarvest = res.expectedHarvest;
        } else if (map.type === 'stage' && map.stageIdx !== undefined) {
            newPlan.stages[map.stageIdx] = { ...newPlan.stages[map.stageIdx], ...res };
        } else if (map.type === 'task' && map.stageIdx !== undefined && map.taskIdx !== undefined) {
            newPlan.stages[map.stageIdx].tasks[map.taskIdx].task = res.task;
        }
    });

    const translatedPlan = { ...newPlan };
    saveCachedTranslation(cacheKey, lang, translatedPlan);
    
    return translatedPlan;
};

export const prefetchLanguageData = async (
    crops: string[],
    state: string,
    lang: Language,
    onProgress: (pct: number, msg: string) => void
): Promise<void> => {
    if (lang === 'en') {
        onProgress(100, "English content ready.");
        return;
    }

    try {
        onProgress(10, "Fetching News...");
        const news = await getAgroStateNews(crops, state, 'en');
        
        onProgress(30, "Translating News...");
        await translateNewsData(news, lang);

        onProgress(60, "Fetching Schemes...");
        const schemes = await getGovernmentSchemes(state, 'en');

        onProgress(80, "Translating Schemes...");
        await translateSchemesData(schemes, lang);

        onProgress(100, "Download Complete");
    } catch (e) {
        console.error("Prefetch failed", e);
        onProgress(100, "Download interrupted");
    }
};

const getLangCode = (code: string): string => {
    const map: Record<string, string> = {
        'en': 'en',
        'hi': 'hi',
        'or': 'or', // Odia
        'te': 'te',
        'bn': 'bn',
        'mr': 'mr',
        'ta': 'ta',
        'gu': 'gu',
        'kn': 'kn',
        'ml': 'ml',
        'pa': 'pa',
    };
    return map[code] || code;
};
