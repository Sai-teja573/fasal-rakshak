
import { GoogleGenAI } from "@google/genai";
import { getGeminiKey, retryOperation } from "./utils";

export class AudioPlayer {
  private audio: HTMLAudioElement;
  constructor() {
    this.audio = new Audio();
  }
  play(base64Data: string) {
    this.audio.src = `data:audio/mp3;base64,${base64Data}`;
    this.audio.play();
  }
  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
  }
}

export const transcribeUserAudio = async (
  audioBase64: string,
  mimeType: string = "audio/webm"
): Promise<string> => {
  if (!navigator.onLine) return "";
  try {
    return await retryOperation(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || getGeminiKey() });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            inlineData: { mimeType, data: audioBase64 },
          },
          {
            text: "Transcribe this audio of a farmer describing crop symptoms. Output only the plain text description. Do not add any conversational filler."
          }
        ]
      });
      return response.text?.trim() || "";
    });
  } catch (e) {
    console.error("Transcription Failed", e);
    return "";
  }
};

export const generateGeminiTTS = async (
  text: string,
  lang: string = "en"
): Promise<string> => {
  if (!navigator.onLine) return "";
  try {
    return await retryOperation(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || getGeminiKey() });

      const langMap: Record<string, string> = {
        hi: "Hindi", or: "Odia", te: "Telugu", bn: "Bengali", ta: "Tamil", mr: "Marathi",
        gu: "Gujarati", kn: "Kannada", ml: "Malayalam", pa: "Punjabi"
      };

      const targetLang = langMap[lang];
      let promptText = text;
      if (targetLang && lang !== "en") {
        promptText = `Translate to ${targetLang} and say: ${text}`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: { parts: [{ text: promptText }] },
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }
          }
        }
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
    });
  } catch (e) {
    console.error("TTS Generation Failed", e);
    return "";
  }
};
