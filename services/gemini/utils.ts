
import { getSecret } from "../secretManager";

export const getGeminiKey = () => {
  // Priority: Injected Environment Variable (e.g. from Key Selector)
  try {
    if (typeof process !== "undefined" && process.env && process.env.API_KEY) {
        return process.env.API_KEY;
    }
  } catch (e) {}
  
  // Fallback: Secret Manager
  return getSecret("gemini_key");
};

export const getYoutubeKey = () => getSecret("youtube_key");
export const getDiagnosisMode = () => localStorage.getItem("DIAGNOSIS_MODE") || "standard";
export const getMockMode = () => localStorage.getItem("MOCK_DIAGNOSIS_MODE") === "true";

export const retryOperation = async <T>(
  operation: () => Promise<T>,
  retries = 3,
  delay = 2000
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    const shouldRetry =
      error?.status === 429 ||
      error?.status === 503 ||
      error?.message?.includes("429");
    
    if (retries > 0 && shouldRetry) {
      console.warn(`API Rate Limit Hit. Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const extractJSON = (str: string): string => {
  try {
    let input = str.replace(/```json/g, "").replace(/```/g, "").trim();
    const firstOpenBrace = input.indexOf("{");
    const firstOpenBracket = input.indexOf("[");
    let firstOpen = -1;

    if (firstOpenBrace !== -1 && firstOpenBracket !== -1)
      firstOpen = Math.min(firstOpenBrace, firstOpenBracket);
    else if (firstOpenBrace !== -1) firstOpen = firstOpenBrace;
    else if (firstOpenBracket !== -1) firstOpen = firstOpenBracket;

    if (firstOpen === -1)
      return input.startsWith("[") || input.startsWith("{") ? input : "{}";

    const lastCloseBrace = input.lastIndexOf("}");
    const lastCloseBracket = input.lastIndexOf("]");
    let lastClose = Math.max(lastCloseBrace, lastCloseBracket);

    if (lastClose === -1 || lastClose <= firstOpen) return "{}";

    return input.substring(firstOpen, lastClose + 1);
  } catch (e) {
    return "{}";
  }
};
