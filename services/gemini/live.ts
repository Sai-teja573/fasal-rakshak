
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { getGeminiKey } from "./utils";

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private session: any = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private nextStartTime: number = 0;
  private audioQueue: AudioBufferSourceNode[] = [];
  private isConnected: boolean = false;

  constructor() {
    const apiKey = getGeminiKey();
    if (!apiKey) throw new Error("API Key not found");
    this.ai = new GoogleGenAI({ apiKey });
  }

  async connect(onAudioData: (isActive: boolean) => void) {
    if (this.isConnected) return;

    // Initialize Audio Contexts
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.inputAudioContext = new AudioContextClass({ sampleRate: 16000 });
    this.outputAudioContext = new AudioContextClass({ sampleRate: 24000 });
    this.nextStartTime = this.outputAudioContext.currentTime;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Connect to Gemini Live
    this.session = await this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          console.log("Gemini Live Connected");
          this.isConnected = true;
          this.startAudioInput(stream);
        },
        onmessage: async (message: LiveServerMessage) => {
          // Process Model Audio
          const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audioData) {
            onAudioData(true); // Notify UI that model is speaking
            await this.playAudioChunk(audioData);
          }

          // Handle Interruptions
          if (message.serverContent?.interrupted) {
            this.clearAudioQueue();
            onAudioData(false);
          }
        },
        onclose: () => {
          console.log("Gemini Live Closed");
          this.disconnect();
        },
        onerror: (err) => {
          console.error("Gemini Live Error", err);
          this.disconnect();
        }
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        systemInstruction: "You are Dr. AI, an expert agronomist. Help the farmer with their crop issues. Be concise, encouraging, and speak clearly. If they ask about market prices, give general advice but suggest checking the Market tab."
      }
    });
  }

  private startAudioInput(stream: MediaStream) {
    if (!this.inputAudioContext) return;

    this.inputSource = this.inputAudioContext.createMediaStreamSource(stream);
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.isConnected || !this.session) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = this.floatTo16BitPCM(inputData);
      const base64 = this.arrayBufferToBase64(pcm16);

      this.session.sendRealtimeInput({
        media: {
          mimeType: "audio/pcm;rate=16000",
          data: base64
        }
      });
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private async playAudioChunk(base64Audio: string) {
    if (!this.outputAudioContext) return;

    try {
      const arrayBuffer = this.base64ToArrayBuffer(base64Audio);
      const audioBuffer = await this.decodeAudioData(arrayBuffer);
      
      const source = this.outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputAudioContext.destination);

      // Schedule playback
      const currentTime = this.outputAudioContext.currentTime;
      const startTime = Math.max(currentTime, this.nextStartTime);
      
      source.start(startTime);
      this.nextStartTime = startTime + audioBuffer.duration;
      this.audioQueue.push(source);

      source.onended = () => {
        const index = this.audioQueue.indexOf(source);
        if (index > -1) this.audioQueue.splice(index, 1);
      };

    } catch (e) {
      console.error("Audio playback error", e);
    }
  }

  // Custom Decode for PCM data if needed, or rely on browser for standard formats.
  // Gemini returns raw PCM for this model, so we need to wrap it or decode manually.
  // However, the example uses standard decodeAudioData which expects a header.
  // If the model returns raw PCM, we construct a WAV header or decode manually.
  // For simplicity here, we assume standard decode or implement raw PCM handling.
  
  private async decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer> {
      // Create a new AudioBuffer directly from raw PCM data (Assuming 24kHz output from Gemini)
      // Note: The example code in guidelines suggests `decodeAudioData` wrapper.
      // We'll implement a simple PCM to AudioBuffer converter.
      
      const ctx = this.outputAudioContext!;
      const pcmData = new Int16Array(data);
      const buffer = ctx.createBuffer(1, pcmData.length, 24000);
      const channelData = buffer.getChannelData(0);
      
      for (let i = 0; i < pcmData.length; i++) {
          channelData[i] = pcmData[i] / 32768.0;
      }
      
      return buffer;
  }

  private clearAudioQueue() {
    this.audioQueue.forEach(source => {
      try { source.stop(); } catch(e){}
    });
    this.audioQueue = [];
    if (this.outputAudioContext) {
        this.nextStartTime = this.outputAudioContext.currentTime;
    }
  }

  disconnect() {
    this.isConnected = false;
    this.clearAudioQueue();
    
    if (this.session) {
      // Check if close method exists (it might not on the raw session object depending on version)
      // Usually disconnect is implicit by stopping stream
    }
    
    if (this.inputSource) this.inputSource.disconnect();
    if (this.processor) this.processor.disconnect();
    if (this.inputAudioContext) this.inputAudioContext.close();
    if (this.outputAudioContext) this.outputAudioContext.close();
    
    this.session = null;
  }

  // --- UTILS ---
  private floatTo16BitPCM(input: Float32Array) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output.buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
