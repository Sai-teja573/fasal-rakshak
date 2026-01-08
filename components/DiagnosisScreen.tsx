
import React, { useEffect, useRef, useState } from 'react';
import { saveDiagnosis, saveSoilDiagnosis } from '../services/agroService';
import { checkUsageLimit, getPlanDetails, incrementUserUsage } from '../services/cmsService';
import { analyzeCropMedia, analyzeSoilMedia, generateClarifyingQuestions } from '../services/geminiService';
import { t } from '../services/translationService';
import { getLocalWeather } from '../services/weatherService';
import { DiagnosisResponse, DiagnosticQuestion, Language, MediaPart, SoilAnalysisResponse, User, WeatherContext } from '../types';
import { LoadingScreen } from './ui/LoadingScreen';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, RadioGroup, RadioGroupItem, Textarea } from './ui/Shadcn';
import { VoiceButton, VoiceButtonState } from './ui/VoiceButton';
import { transcribeUserAudio } from '../services/gemini/audio';

// ============================================
// PROFESSIONAL LIVE CAMERA SCANNER COMPONENT
// ============================================
interface LiveScannerProps {
  onCapture: (file: File) => void;
  onClose: () => void;
  mode: 'crop' | 'soil';
  lang: Language;
  onOpenGallery?: () => void;
}

const LiveScanner: React.FC<LiveScannerProps> = ({ onCapture, onClose, mode, lang, onOpenGallery }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>();
  
  const [isReady, setIsReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [frameQuality, setFrameQuality] = useState<'poor' | 'good' | 'perfect'>('poor');
  const [hint, setHint] = useState('');
  const [brightness, setBrightness] = useState(0);
  const [sharpness, setSharpness] = useState(0);
  const [greenDetection, setGreenDetection] = useState(0);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [scanLine, setScanLine] = useState(0);
  const [captureCount, setCaptureCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  useEffect(() => {
    // Animate scan line
    const interval = setInterval(() => {
      setScanLine(prev => (prev + 2) % 100);
    }, 30);
    return () => clearInterval(interval);
  }, []);

  const startCamera = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsReady(true);
          startFrameAnalysis();
        };
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setHint('Camera access denied. Please allow camera permissions.');
    }
  };

  const stopCamera = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const startFrameAnalysis = () => {
    const analyzeFrame = () => {
      if (!videoRef.current || !canvasRef.current) {
        animationRef.current = requestAnimationFrame(analyzeFrame);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (!ctx || video.videoWidth === 0) {
        animationRef.current = requestAnimationFrame(analyzeFrame);
        return;
      }

      canvas.width = 100;
      canvas.height = 100;
      ctx.drawImage(video, 0, 0, 100, 100);
      
      const imageData = ctx.getImageData(0, 0, 100, 100);
      const data = imageData.data;
      
      let totalBrightness = 0;
      let greenPixels = 0;
      let brownPixels = 0;
      let edgeSum = 0;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Brightness
        const brightness = (r + g + b) / 3;
        totalBrightness += brightness;
        
        // Green detection (for crops)
        if (g > r * 1.2 && g > b * 1.1 && g > 60) {
          greenPixels++;
        }
        
        // Brown detection (for soil)
        if (r > 80 && g > 50 && g < r && b < g && Math.abs(r - g) < 80) {
          brownPixels++;
        }
        
        // Edge detection (sharpness)
        if (i > 400 && i < data.length - 400) {
          const diff = Math.abs(brightness - (data[i - 400] + data[i - 399] + data[i - 398]) / 3);
          edgeSum += diff;
        }
      }
      
      const pixelCount = data.length / 4;
      const avgBrightness = totalBrightness / pixelCount;
      const greenRatio = greenPixels / pixelCount;
      const brownRatio = brownPixels / pixelCount;
      const avgEdge = edgeSum / (pixelCount - 200);
      
      setBrightness(Math.round(avgBrightness));
      setSharpness(Math.min(100, Math.round(avgEdge * 2)));
      
      const detectionRatio = mode === 'soil' ? brownRatio : greenRatio;
      setGreenDetection(Math.round(detectionRatio * 100));
      
      // Determine frame quality
      let quality: 'poor' | 'good' | 'perfect' = 'poor';
      let hintText = '';
      
      if (avgBrightness < 50) {
        hintText = '☀️ Too dark - move to better lighting';
      } else if (avgBrightness > 230) {
        hintText = '🌟 Too bright - reduce light exposure';
      } else if (avgEdge < 15) {
        hintText = '📍 Hold steady - image is blurry';
      } else if (detectionRatio < 0.1) {
        hintText = mode === 'soil' ? '🪨 Point camera at soil' : '🌿 Point camera at crop/leaf';
      } else if (detectionRatio < 0.25) {
        hintText = mode === 'soil' ? '↔️ Move closer to soil' : '↔️ Move closer to the plant';
        quality = 'good';
      } else {
        quality = 'perfect';
        hintText = '✨ Perfect! Tap to capture';
      }
      
      setFrameQuality(quality);
      setHint(hintText);
      
      animationRef.current = requestAnimationFrame(analyzeFrame);
    };
    
    analyzeFrame();
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    
    setIsAnalyzing(true);
    
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0);
    
    // Add capture animation
    setCaptureCount(prev => prev + 1);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setTimeout(() => {
          onCapture(file);
          setIsAnalyzing(false);
        }, 500);
      }
    }, 'image/jpeg', 0.9);
  };

  const toggleFlash = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    const capabilities = track.getCapabilities?.() as any;
    if (capabilities?.torch) {
      await (track as any).applyConstraints({ advanced: [{ torch: !isFlashOn }] });
      setIsFlashOn(!isFlashOn);
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    
    recordedChunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm' });
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const file = new File([blob], `video_${Date.now()}.webm`, { type: 'video/webm' });
      onCapture(file);
    };
    
    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);
    
    // Recording timer
    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    // Auto-stop after 30 seconds
    setTimeout(() => {
      if (mediaRecorderRef.current?.state === 'recording') {
        stopRecording();
      }
      clearInterval(timerInterval);
    }, 30000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingTime(0);
    }
  };

  const getFrameColor = () => {
    switch (frameQuality) {
      case 'perfect': return 'border-green-500 shadow-green-500/50';
      case 'good': return 'border-yellow-500 shadow-yellow-500/50';
      default: return 'border-red-500 shadow-red-500/50';
    }
  };

  const getFrameGlow = () => {
    switch (frameQuality) {
      case 'perfect': return 'rgba(34, 197, 94, 0.3)';
      case 'good': return 'rgba(234, 179, 8, 0.3)';
      default: return 'rgba(239, 68, 68, 0.3)';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Hidden canvas for analysis */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-4 pt-safe">
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleFlash}
              className={`w-10 h-10 rounded-full backdrop-blur flex items-center justify-center transition-all ${isFlashOn ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </button>
          </div>
        </div>
        
        {/* Mode Indicator */}
        <div className="mt-4 flex justify-center">
          <div className={`px-4 py-2 rounded-full text-sm font-bold backdrop-blur ${mode === 'soil' ? 'bg-amber-500/30 text-amber-300' : 'bg-green-500/30 text-green-300'}`}>
            {mode === 'soil' ? '🪨 Soil Scan Mode' : '🌿 Crop Scan Mode'}
          </div>
        </div>
      </div>
      
      {/* Camera View */}
      <div className="flex-1 relative overflow-hidden">
        <video 
          ref={videoRef}
          autoPlay 
          playsInline 
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: `scale(${zoom})` }}
        />
        
        {/* Scanning Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Corner Brackets with Dynamic Color */}
          <div className="absolute inset-8 md:inset-16 lg:inset-24">
            {/* Animated scan line */}
            <div 
              className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent opacity-60"
              style={{ top: `${scanLine}%`, boxShadow: '0 0 20px rgba(34, 197, 94, 0.8)' }}
            />
            
            {/* Frame border */}
            <div className={`absolute inset-0 border-2 rounded-2xl transition-all duration-300 ${getFrameColor()}`} style={{ boxShadow: `0 0 30px ${getFrameGlow()}, inset 0 0 30px ${getFrameGlow()}` }}>
              {/* Corner accents */}
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 rounded-tl-lg" style={{ borderColor: 'inherit' }} />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 rounded-tr-lg" style={{ borderColor: 'inherit' }} />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 rounded-bl-lg" style={{ borderColor: 'inherit' }} />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 rounded-br-lg" style={{ borderColor: 'inherit' }} />
            </div>
            
            {/* Grid overlay */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-20">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="border border-white/30" />
              ))}
            </div>
          </div>
          
          {/* Detection indicators */}
          <div className="absolute top-1/2 left-4 -translate-y-1/2 space-y-3">
            <div className="bg-black/60 backdrop-blur rounded-lg p-2 text-xs text-white">
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${brightness > 50 && brightness < 230 ? 'bg-green-500' : 'bg-red-500'}`} />
                <span>Light</span>
              </div>
              <div className="w-16 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-yellow-500 to-green-500 transition-all" style={{ width: `${Math.min(100, brightness / 2.5)}%` }} />
              </div>
            </div>
            
            <div className="bg-black/60 backdrop-blur rounded-lg p-2 text-xs text-white">
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${sharpness > 20 ? 'bg-green-500' : 'bg-red-500'}`} />
                <span>Focus</span>
              </div>
              <div className="w-16 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 transition-all" style={{ width: `${sharpness}%` }} />
              </div>
            </div>
            
            <div className="bg-black/60 backdrop-blur rounded-lg p-2 text-xs text-white">
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${greenDetection > 10 ? 'bg-green-500' : 'bg-red-500'}`} />
                <span>{mode === 'soil' ? 'Soil' : 'Plant'}</span>
              </div>
              <div className="w-16 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className={`h-full transition-all ${mode === 'soil' ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${greenDetection}%` }} />
              </div>
            </div>
          </div>
        </div>
        
        {/* Flash effect on capture */}
        {isAnalyzing && (
          <div className="absolute inset-0 bg-white animate-ping pointer-events-none" style={{ animationDuration: '0.3s' }} />
        )}
      </div>
      
      {/* Hint Bar */}
      <div className="absolute bottom-32 left-0 right-0 flex justify-center px-4">
        <div className={`px-6 py-3 rounded-full backdrop-blur text-sm font-medium transition-all duration-300 ${
          frameQuality === 'perfect' ? 'bg-green-500/30 text-green-300 border border-green-500/50' :
          frameQuality === 'good' ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50' :
          'bg-red-500/30 text-red-300 border border-red-500/50'
        }`}>
          {hint || 'Initializing camera...'}
        </div>
      </div>
      
      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6 pb-safe">
        {/* Recording Timer */}
        {isRecording && (
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-2 bg-red-500 px-4 py-2 rounded-full text-white font-bold">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-around">
          {/* Gallery */}
          <button onClick={onOpenGallery} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
          </button>
          
          {/* Main Capture Button */}
          <button 
            onClick={isRecording ? stopRecording : capturePhoto}
            onTouchStart={(e) => {
              // Long press to start video
              const timeout = setTimeout(() => {
                if (!isRecording) startRecording();
              }, 500);
              (e.target as any).pressTimeout = timeout;
            }}
            onTouchEnd={(e) => {
              clearTimeout((e.target as any).pressTimeout);
            }}
            disabled={!isReady || isAnalyzing}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all transform active:scale-95 ${
              isRecording 
                ? 'bg-red-500' 
                : frameQuality === 'perfect' 
                  ? 'bg-white ring-4 ring-green-500 ring-offset-4 ring-offset-black' 
                  : 'bg-white ring-4 ring-white/30 ring-offset-4 ring-offset-black'
            }`}
          >
            {isRecording ? (
              <div className="w-8 h-8 rounded bg-white" />
            ) : isAnalyzing ? (
              <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <div className={`w-16 h-16 rounded-full ${frameQuality === 'perfect' ? 'bg-green-500' : 'bg-slate-300'}`} />
            )}
          </button>
          
          {/* Switch Camera */}
          <button 
            onClick={() => setZoom(prev => prev === 1 ? 2 : 1)}
            className="w-12 h-12 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white font-bold"
          >
            {zoom}x
          </button>
        </div>
        
        {/* Capture mode hint */}
        <p className="text-center text-white/60 text-xs mt-4">
          Tap to capture • Hold for video
        </p>
      </div>
    </div>
  );
};

// ============================================
// ENHANCED AI COUNCIL DEBATE COMPONENT
// ============================================

interface DiagnosisScreenProps {
  onResult: (result: DiagnosisResponse) => void;
  onSoilResult?: (result: SoilAnalysisResponse) => void; // New Prop
  autoTrigger?: number; 
  lang: Language;
  user: User | null;
  onUserUpdate?: (user: User) => void;
  onNavigateToPricing?: () => void;
  previousScan?: DiagnosisResponse; 
  history?: DiagnosisResponse[]; 
  onNavigateToAgroHub?: () => void;
  initialMode?: 'crop' | 'soil'; // NEW PROP
}

interface MediaItem {
    id: string;
    type: 'image' | 'video';
    previewUrl: string;
    file: File;
}

// ============================================
// ENHANCED AI COUNCIL DEBATE COMPONENT
// ============================================

interface AgentConfig {
    id: string;
    name: string;
    role: string;
    avatar: string;
    color: string;
    bgColor: string;
    borderColor: string;
}

const AI_AGENTS: Record<string, AgentConfig> = {
    'Dr.': { id: 'doctor', name: 'Dr. Botanist', role: 'Plant Pathologist', avatar: '👨‍🔬', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    'Ram': { id: 'farmer', name: 'Ram Kaka', role: 'Local Expert', avatar: '👳', color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
    'Priya': { id: 'analyst', name: 'Priya', role: 'Cost Analyst', avatar: '👩‍💼', color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
    'Geologist': { id: 'geologist', name: 'Dr. Geo', role: 'Soil Scientist', avatar: '🪨', color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
    'Chemist': { id: 'chemist', name: 'Dr. Chem', role: 'Agrochemist', avatar: '🧪', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
    'Farmer': { id: 'farmer2', name: 'Farmer AI', role: 'Practical Wisdom', avatar: '🌾', color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
    'System': { id: 'system', name: 'Fasal AI', role: 'Consensus Engine', avatar: '🤖', color: 'text-slate-600', bgColor: 'bg-slate-50', borderColor: 'border-slate-200' },
    'default': { id: 'ai', name: 'AI Expert', role: 'Analyzer', avatar: '🧠', color: 'text-indigo-600', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200' }
};

const getAgentConfig = (agentName: string): AgentConfig => {
    const key = Object.keys(AI_AGENTS).find(k => agentName.includes(k));
    return AI_AGENTS[key || 'default'];
};

interface EnhancedDebateFeedProps {
    logs: { agent: string; text: string }[];
    activeAgent: string;
    mode: 'crop' | 'soil';
}

const EnhancedDebateFeed: React.FC<EnhancedDebateFeedProps> = ({ logs, activeAgent, mode }) => {
    const feedRef = useRef<HTMLDivElement>(null);
    const [typingText, setTypingText] = useState('');
    const [displayedLogs, setDisplayedLogs] = useState<typeof logs>([]);
    
    useEffect(() => {
        if (feedRef.current) {
            feedRef.current.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [displayedLogs, typingText]);

    useEffect(() => {
        // Animate new logs with typing effect
        if (logs.length > displayedLogs.length) {
            const newLog = logs[logs.length - 1];
            let charIndex = 0;
            setTypingText('');
            
            const typingInterval = setInterval(() => {
                if (charIndex < newLog.text.length) {
                    setTypingText(newLog.text.slice(0, charIndex + 1));
                    charIndex++;
                } else {
                    clearInterval(typingInterval);
                    setDisplayedLogs([...logs]);
                    setTypingText('');
                }
            }, 15);
            
            return () => clearInterval(typingInterval);
        }
    }, [logs]);

    const currentTypingAgent = logs.length > displayedLogs.length ? getAgentConfig(logs[logs.length - 1].agent) : null;

    return (
        <div className="w-full max-w-2xl mx-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-t-2xl p-4 border-b border-slate-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-xl shadow-lg shadow-green-500/20">
                                🧠
                            </div>
                            <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                        </div>
                        <div>
                            <h4 className="font-bold text-white text-sm tracking-wide">AI Expert Council</h4>
                            <p className="text-[10px] text-slate-400">
                                {activeAgent ? (
                                    <span className="flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                        {activeAgent} is analyzing...
                                    </span>
                                ) : 'Awaiting image input...'}
                            </p>
                        </div>
                    </div>
                    
                    {/* Agent Avatars */}
                    <div className="flex -space-x-2">
                        {['Dr.', 'Ram', 'Priya', mode === 'soil' ? 'Geologist' : 'System'].map((key, i) => {
                            const agent = AI_AGENTS[key] || AI_AGENTS.default;
                            const isActive = activeAgent.includes(key);
                            return (
                                <div 
                                    key={i}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 border-slate-800 transition-all duration-300 ${isActive ? 'scale-125 z-10 ring-2 ring-green-500' : 'grayscale opacity-60'}`}
                                    style={{ backgroundColor: isActive ? agent.bgColor : '#1e293b' }}
                                >
                                    {agent.avatar}
                                </div>
                            );
                        })}
                    </div>
                </div>
                
                {/* Progress bar */}
                <div className="mt-3 h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
                        style={{ width: `${Math.min(100, logs.length * 25)}%` }}
                    />
                </div>
            </div>
            
            {/* Chat Area */}
            <div 
                ref={feedRef}
                className="h-[380px] bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 overflow-y-auto custom-scrollbar"
            >
                <div className="p-4 space-y-4">
                    {/* Connection Message */}
                    <div className="flex justify-center">
                        <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs px-4 py-2 rounded-full">
                            🔒 Secure analysis session started
                        </div>
                    </div>
                    
                    {/* Displayed Messages */}
                    {displayedLogs.map((log, idx) => {
                        const agent = getAgentConfig(log.agent);
                        return (
                            <div key={idx} className="flex gap-3 animate-fadeInUp" style={{ animationDelay: `${idx * 100}ms` }}>
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${agent.bgColor} border ${agent.borderColor} shadow-sm`}>
                                    <span className="text-lg">{agent.avatar}</span>
                                </div>
                                <div className="flex-1 max-w-[85%]">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className={`text-sm font-bold ${agent.color}`}>{agent.name}</span>
                                        <span className="text-[10px] text-slate-400">{agent.role}</span>
                                    </div>
                                    <div className={`${agent.bgColor} ${agent.borderColor} border p-3 rounded-2xl rounded-tl-sm shadow-sm`}>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{log.text}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    
                    {/* Currently Typing */}
                    {currentTypingAgent && typingText && (
                        <div className="flex gap-3 animate-fadeIn">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${currentTypingAgent.bgColor} border ${currentTypingAgent.borderColor} shadow-sm ring-2 ring-offset-2 ring-green-500`}>
                                <span className="text-lg">{currentTypingAgent.avatar}</span>
                            </div>
                            <div className="flex-1 max-w-[85%]">
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className={`text-sm font-bold ${currentTypingAgent.color}`}>{currentTypingAgent.name}</span>
                                    <span className="text-[10px] text-green-500 font-medium">typing...</span>
                                </div>
                                <div className={`${currentTypingAgent.bgColor} ${currentTypingAgent.borderColor} border p-3 rounded-2xl rounded-tl-sm shadow-sm`}>
                                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                        {typingText}
                                        <span className="inline-block w-1 h-4 bg-green-500 ml-1 animate-pulse" />
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Waiting indicator */}
                    {logs.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                <div className="w-8 h-8 border-2 border-slate-300 border-t-green-500 rounded-full animate-spin" />
                            </div>
                            <p className="text-sm">Assembling expert council...</p>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Footer */}
            <div className="bg-slate-100 dark:bg-slate-800 rounded-b-2xl p-3 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span>AI Council Active</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span>🔐 Encrypted</span>
                        <span>⚡ Real-time</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DebateFeed = ({ logs, activeAgent }: { logs: {agent: string, text: string}[], activeAgent: string }) => {
    const feedRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => { 
        if(feedRef.current) {
            feedRef.current.scrollTo({
                top: feedRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [logs, activeAgent]);
    
    const getAgentStyle = (agent: string) => {
        if (agent.includes("Dr.") || agent.includes("Geologist")) return { bg: "bg-blue-100", text: "text-blue-700", icon: "👨‍🔬" };
        if (agent.includes("Ram") || agent.includes("Farmer")) return { bg: "bg-green-100", text: "text-green-700", icon: "👳" };
        if (agent.includes("Priya") || agent.includes("Chemist")) return { bg: "bg-purple-100", text: "text-purple-700", icon: "👩‍💼" };
        return { bg: "bg-slate-100", text: "text-slate-700", icon: "🤖" };
    };

    return (
        <Card className="w-full h-[450px] flex flex-col overflow-hidden border-slate-200 dark:border-slate-700 shadow-xl bg-slate-50 dark:bg-slate-900/50">
             <div className="bg-slate-900/95 backdrop-blur text-white p-4 flex justify-between items-center shrink-0 border-b border-slate-700 z-10">
                 <div className="flex items-center gap-2">
                     <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span></span>
                     <div>
                        <h4 className="font-bold text-sm tracking-wide">Expert Council</h4>
                        <p className="text-[10px] text-slate-300">Live Analysis • {activeAgent ? `${activeAgent} typing...` : "Waiting for input..."}</p>
                     </div>
                 </div>
             </div>
             
             <div className="flex-1 overflow-hidden p-4 space-y-4 relative" ref={feedRef}>
                 {logs.map((log, idx) => {
                     const style = getAgentStyle(log.agent);
                     return (
                         <div key={idx} className="flex gap-3 animate-slideInLeft transition-all duration-300">
                             <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 ${style.bg} shadow-sm`}>
                                 <span className="text-sm">{style.icon}</span>
                             </div>
                             <div className="flex-1 max-w-[90%]">
                                 <div className="flex items-baseline justify-between mb-1">
                                     <span className={`text-xs font-bold ${style.text}`}>{log.agent}</span>
                                 </div>
                                 <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none shadow-sm text-sm text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-700 leading-relaxed">
                                     {log.text}
                                 </div>
                             </div>
                         </div>
                     );
                 })}
             </div>
        </Card>
    );
};

export const DiagnosisScreen: React.FC<DiagnosisScreenProps> = ({ onResult, onSoilResult, autoTrigger, lang, user, onUserUpdate, onNavigateToPricing, previousScan, history, onNavigateToAgroHub, initialMode = 'crop' }) => {
  const [diagnosisMode, setDiagnosisMode] = useState<'crop' | 'soil'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'analyzing_image' | 'generating_questions' | 'questioning' | 'analyzing_final'>('analyzing_image');
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);
  const [debateLogs, setDebateLogs] = useState<{agent: string, text: string}[]>([]);
  const [activeAgent, setActiveAgent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isServerBusy, setIsServerBusy] = useState(false); 
  const [limitReached, setLimitReached] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [weatherContext, setWeatherContext] = useState<WeatherContext | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // NEW: Live Scanner State
  const [showLiveScanner, setShowLiveScanner] = useState(false);
  
  // Follow Up State
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<DiagnosisResponse | null>(previousScan || null);
  const [treatmentMethod, setTreatmentMethod] = useState<'organic' | 'chemical' | 'other' | null>(null);
  const [daysToResults, setDaysToResults] = useState("");
  
  // Q&A State
  const [aiQuestions, setAiQuestions] = useState<DiagnosticQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  
  // Description & Audio State
  const [description, setDescription] = useState("");
  const [cropAge, setCropAge] = useState(""); 
  const [voiceState, setVoiceState] = useState<VoiceButtonState>('idle');
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Best Practices Modal State
  const [showGuide, setShowGuide] = useState(false);
  const [pendingMediaType, setPendingMediaType] = useState<'camera' | 'video' | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const plan = user ? getPlanDetails(user.plan_id) : null;

  useEffect(() => { fetchWeather(); }, []);
  useEffect(() => { if (!checkUsageLimit(user, 'max_scans')) setLimitReached(true); else setLimitReached(false); }, [user]);
  useEffect(() => { 
      if (autoTrigger && autoTrigger > 0 && !loading && mediaItems.length === 0 && !limitReached && cameraInputRef.current && !previousScan) {
          cameraInputRef.current.click();
      }
  }, [autoTrigger]);

  useEffect(() => {
      if (previousScan) setSelectedHistoryItem(previousScan);
  }, [previousScan]);

  const fetchWeather = () => {
    setGettingLocation(true);
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const weatherCtx = await getLocalWeather(latitude, longitude);
                    setWeatherContext(weatherCtx);
                } catch (e) { console.error("Weather fetch failed", e); } finally { setGettingLocation(false); }
            },
            () => setGettingLocation(false)
        );
    } else { setGettingLocation(false); }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width, height = img.height;
          if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
      };
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (event) => {
              const result = reader.result as string;
              resolve(result.split(',')[1]);
          };
          reader.onerror = error => reject(error);
      });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (limitReached) return;
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setIsProcessingMedia(true);
    setError(null);
    setIsServerBusy(false);
    try {
        const newItems: MediaItem[] = [];
        for (const file of Array.from(files) as File[]) {
             await new Promise(r => setTimeout(r, 500));
             newItems.push({ 
                 id: crypto.randomUUID(), 
                 type: file.type.startsWith('video') ? 'video' : 'image', 
                 previewUrl: URL.createObjectURL(file), 
                 file 
             });
        }
        setMediaItems(prev => [...prev, ...newItems]);
    } catch(e) {
        console.error("Media processing error", e);
        setError("Failed to process media");
    } finally {
        setIsProcessingMedia(false);
        if (event.target) event.target.value = '';
    }
  };
  
  const handleVoicePress = async () => {
    if (voiceState === 'idle') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setActiveStream(stream);
        mediaRecorderRef.current = new MediaRecorder(stream);
        chunksRef.current = [];
        mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mediaRecorderRef.current.onstop = async () => {
          setVoiceState('processing');
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          setAudioBlob(blob);
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            try {
              const text = await transcribeUserAudio(base64Audio, 'audio/webm');
              if (text) {
                setDescription(prev => prev ? `${prev}\n${text}` : text);
                setVoiceState('success');
              } else {
                setVoiceState('error');
              }
            } catch {
              setVoiceState('error');
            } finally {
              setTimeout(() => setVoiceState('idle'), 1200);
              if (activeStream) {
                activeStream.getTracks().forEach(t => t.stop());
                setActiveStream(null);
              }
            }
          };
        };
        mediaRecorderRef.current.start();
        setVoiceState('recording');
      } catch {
        setVoiceState('error');
        setTimeout(() => setVoiceState('idle'), 1000);
      }
    } else if (voiceState === 'recording') {
      mediaRecorderRef.current?.stop();
    }
  };

  const prepareMediaParts = async () => {
      const allParts: MediaPart[] = [];
      for (const item of mediaItems) {
          if (item.type === 'video') {
             const b64 = await fileToBase64(item.file);
             allParts.push({ mimeType: item.file.type, data: b64 });
          } else {
             const compressed = await compressImage(item.file);
             allParts.push({ mimeType: 'image/jpeg', data: compressed.split(',')[1] });
          }
      }
      return allParts;
  };

  // --- STEP 1: INITIAL ANALYSIS ---
  const startDiagnosisProcess = async () => {
    if (!checkUsageLimit(user, 'max_scans')) { setLimitReached(true); return; }
    if (mediaItems.length === 0) { setError("Please upload at least one image."); return; }

    // If SOIL MODE, skip Q&A for now and go straight to analysis (simplified flow)
    if (diagnosisMode === 'soil') {
        finalizeDiagnosis();
        return;
    }

    // CROP MODE:
    setLoading(true); 
    setLoadingStep('generating_questions');
    setError(null);
    setIsServerBusy(false);

    if (!navigator.onLine) {
        finalizeDiagnosis();
        return;
    }

    try {
        const parts = await prepareMediaParts();
        const questions = await generateClarifyingQuestions(parts, lang);
        
        if (questions && questions.length > 0) {
            setAiQuestions(questions);
            setLoadingStep('questioning');
            setLoading(false); 
        } else {
            finalizeDiagnosis();
        }
    } catch (e: any) {
        console.error(e);
        finalizeDiagnosis();
    }
  };

  // --- STEP 2: FINAL DIAGNOSIS (Crop or Soil) ---
  const finalizeDiagnosis = async () => {
    setLoading(true);
    setLoadingStep('analyzing_final');
    setDebateLogs([]);
    setActiveAgent("System");
    setIsServerBusy(false);

    try {
      const parts = await prepareMediaParts();
      const userName = user ? user.name.split(' ')[0] : 'Farmer';
      
      const updated = incrementUserUsage(user);
      if (updated && onUserUpdate) onUserUpdate(updated);

      // SOIL MODE
      if (diagnosisMode === 'soil') {
          // Simulate Council for Soil
          const soilScripts = [
              { agent: "Geologist", text: "Analyzing soil texture and color profile..." },
              { agent: "Govt Database", text: `Checking soil survey data for ${weatherContext?.display.location || 'region'}...` },
              { agent: "Chemist", text: "Estimating organic carbon and pH levels..." }
          ];
          for(const s of soilScripts) {
              setActiveAgent(s.agent);
              setDebateLogs(prev => [...prev, s]);
              await new Promise(r => setTimeout(r, 1000));
          }

          const result = await analyzeSoilMedia(
              parts, lang, weatherContext, description, user || undefined
          );
          
          if (user) {
              let saveLoc = undefined;
              if (user.location) saveLoc = user.location;
              await saveSoilDiagnosis(user.id, result, saveLoc);
          }
          
          if (onSoilResult) onSoilResult(result);
          return;
      }

      // CROP MODE
      const combinedDescription = description + (cropAge ? ` Crop Age: ${cropAge} days.` : "");

      const result = await analyzeCropMedia(
          parts, 
          lang, 
          weatherContext, 
          userName, 
          combinedDescription, 
          null, // audio handled separately if needed
          (agent, text) => {
              setActiveAgent(agent);
              setTimeout(() => setDebateLogs(prev => [...prev, { agent, text }]), 500);
          }, 
          selectedHistoryItem || undefined,
          treatmentMethod || undefined,
          daysToResults || undefined,
          userAnswers,
          user || undefined 
      );
      
      let primaryImage = mediaItems[0].previewUrl;
      if (mediaItems[0].type === 'image') {
          const c = await compressImage(mediaItems[0].file);
          primaryImage = c;
      }
      result.imageUrl = primaryImage; 
      
      if (user && navigator.onLine) {
          let saveLoc = undefined;
          if (user.location) saveLoc = user.location;
          await saveDiagnosis(user.id, result, saveLoc, description);
      }

      setActiveAgent("Finalizing");
      await new Promise(r => setTimeout(r, 1000));
      onResult(result);

    } catch (err: any) {
        console.error(err);
        if (err.message && (err.message.includes("429") || err.message.includes("SERVER_BUSY"))) {
            setIsServerBusy(true);
        } else {
            setError(err.message || "Analysis failed.");
        }
    } finally { setLoading(false); }
  };

  if (limitReached) {
      return (
        <div className="flex flex-col h-full items-center justify-center p-6 text-center">
            <h2 className="text-2xl font-bold mb-4">Limit Reached</h2>
            <Button onClick={onNavigateToPricing} size="lg">Upgrade Plan</Button>
        </div>
      );
  }

  if (loadingStep === 'questioning') {
      return (
          <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 p-6 max-w-2xl mx-auto overflow-y-auto">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
                  <h2 className="text-xl font-bold mb-4">Dr. AI Needs Details</h2>
                  <div className="space-y-6">
                      {aiQuestions.map((q, idx) => (
                          <div key={q.id}>
                              <label className="block font-bold mb-2">{idx + 1}. {q.question}</label>
                              {q.options ? (
                                  <RadioGroup onValueChange={(val) => setUserAnswers({...userAnswers, [q.id]: val})}>
                                      {q.options.map(opt => (
                                          <div key={opt} className="flex items-center space-x-2 mb-2">
                                              <RadioGroupItem value={opt} id={opt} />
                                              <Label htmlFor={opt}>{opt}</Label>
                                          </div>
                                      ))}
                                  </RadioGroup>
                              ) : <Input onChange={(e) => setUserAnswers({...userAnswers, [q.id]: e.target.value})} />}
                          </div>
                      ))}
                  </div>
                  <Button onClick={() => finalizeDiagnosis()} className="mt-6 w-full">Submit</Button>
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
      
      {isProcessingMedia && <LoadingScreen text="Processing Media..." className="absolute" overlay />}
      
      {/* Live Scanner Modal */}
      {showLiveScanner && (
        <LiveScanner
          mode={diagnosisMode}
          lang={lang}
          onCapture={(file) => {
            const newItem: MediaItem = {
              id: crypto.randomUUID(),
              type: file.type.startsWith('video') ? 'video' : 'image',
              previewUrl: URL.createObjectURL(file),
              file
            };
            setMediaItems(prev => [...prev, newItem]);
            setShowLiveScanner(false);
          }}
          onOpenGallery={() => { setShowLiveScanner(false); galleryInputRef.current?.click(); }}
          onClose={() => setShowLiveScanner(false)}
        />
      )}

      {/* MODE TOGGLE HEADER - Premium Design */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 shadow-lg z-10 border-b border-slate-700">
          <div className="max-w-md mx-auto">
              <div className="flex bg-slate-800/50 backdrop-blur p-1.5 rounded-2xl border border-slate-700">
                  <button 
                    onClick={() => setDiagnosisMode('crop')}
                    className={`flex-1 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${diagnosisMode === 'crop' ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30' : 'text-slate-400 hover:text-white'}`}
                  >
                      <span className="text-lg">🌿</span>
                      <span>Crop Doctor</span>
                  </button>
                  <button 
                    onClick={() => setDiagnosisMode('soil')}
                    className={`flex-1 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${diagnosisMode === 'soil' ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30' : 'text-slate-400 hover:text-white'}`}
                  >
                      <span className="text-lg">🪨</span>
                      <span>Soil Lab</span>
                  </button>
              </div>
          </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar w-full relative">
          <main className="flex flex-col md:flex-row p-4 md:p-6 w-full max-w-7xl mx-auto gap-6 pb-32">
            
            {/* LEFT COLUMN: CONTEXT & TIPS */}
            <div className="w-full md:w-1/3 flex flex-col gap-6 order-2 md:order-1">
                
                {/* Pro Tips Card */}
                <Card className="border-none shadow-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(34,197,94,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.05)_1px,transparent_1px)] bg-[size:20px_20px]" />
                    <CardHeader className="relative">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">💡</span>
                            Pro Scanning Tips
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="relative space-y-3">
                        {diagnosisMode === 'crop' ? (
                            <>
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                                    <span className="text-xl">🔍</span>
                                    <div>
                                        <p className="font-medium text-sm">Get Close</p>
                                        <p className="text-xs text-slate-400">10-15cm from the affected area</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                                    <span className="text-xl">☀️</span>
                                    <div>
                                        <p className="font-medium text-sm">Natural Light</p>
                                        <p className="text-xs text-slate-400">Avoid shadows on the leaf</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                                    <span className="text-xl">📐</span>
                                    <div>
                                        <p className="font-medium text-sm">Top & Bottom</p>
                                        <p className="text-xs text-slate-400">Capture both sides of leaves</p>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                                    <span className="text-xl">⛏️</span>
                                    <div>
                                        <p className="font-medium text-sm">Dig 6 Inches</p>
                                        <p className="text-xs text-slate-400">Surface soil differs from root zone</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                                    <span className="text-xl">💧</span>
                                    <div>
                                        <p className="font-medium text-sm">Wet & Dry Samples</p>
                                        <p className="text-xs text-slate-400">Take photos in both conditions</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                                    <span className="text-xl">🎨</span>
                                    <div>
                                        <p className="font-medium text-sm">Show True Color</p>
                                        <p className="text-xs text-slate-400">Avoid flash that alters colors</p>
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
                
                {/* Weather Card */}
                <Card className="border-none shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>
                            </div>
                            {diagnosisMode === 'soil' ? "Soil Environment" : t('farm_conditions', lang)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                            {gettingLocation ? (
                                <div className="flex items-center gap-3 text-blue-600">
                                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-sm">{t('loc_detecting', lang)}</p>
                                </div>
                            ) : weatherContext ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-sm text-center">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">{t('lbl_temp', lang)}</p>
                                        <p className="text-xl font-bold text-slate-900 dark:text-white">{weatherContext.display.temp}°C</p>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-sm text-center">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">{t('lbl_humidity', lang)}</p>
                                        <p className="text-xl font-bold text-slate-900 dark:text-white">{weatherContext.display.rh}%</p>
                                    </div>
                                    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-sm text-center col-span-2">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase">📍 {weatherContext.display.location || 'Local Area'}</p>
                                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mt-1">{weatherContext.display.last_rain}</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-600 dark:text-slate-400">{t('loc_access', lang)}</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* RIGHT COLUMN: SCAN INPUTS */}
            <div className="w-full md:w-2/3 flex flex-col items-center justify-start order-1 md:order-2 space-y-6 pb-20 md:pb-0">
               <input type="file" accept="image/*" capture="environment" className="hidden" ref={cameraInputRef} onChange={handleFileChange} />
               <input type="file" accept="video/*" capture="environment" className="hidden" ref={videoInputRef} onChange={handleFileChange} />
               <input type="file" accept="image/*" multiple className="hidden" ref={galleryInputRef} onChange={handleFileChange} />
               
               {/* Hero Scanner Card */}
               <div className={`w-full rounded-3xl shadow-2xl overflow-hidden ${diagnosisMode === 'soil' ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-red-500' : 'bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500'}`}>
                   <div className="p-6 text-white">
                       <div className="flex items-center gap-4 mb-4">
                           <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl">
                               {diagnosisMode === 'soil' ? '🪨' : '🌿'}
                           </div>
                           <div>
                               <h2 className="text-2xl font-bold">
                                   {diagnosisMode === 'soil' ? 'Soil Health Lab' : 'Crop Doctor AI'}
                               </h2>
                               <p className="text-white/80 text-sm">
                                   {diagnosisMode === 'soil' 
                                    ? "Instant soil analysis powered by AI" 
                                    : "Diagnose plant diseases in seconds"}
                               </p>
                           </div>
                       </div>
                       
                       {/* Main Scan Button */}
                       <button 
                         onClick={() => setShowLiveScanner(true)}
                         disabled={isServerBusy}
                         className="w-full py-6 rounded-2xl bg-white/20 backdrop-blur border-2 border-dashed border-white/40 hover:border-white hover:bg-white/30 transition-all duration-300 group"
                       >
                           <div className="flex flex-col items-center gap-3">
                               <div className="w-20 h-20 rounded-full bg-white/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                                   <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                       <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                                       <circle cx="12" cy="13" r="3"/>
                                   </svg>
                               </div>
                               <div>
                                   <p className="font-bold text-lg">🔬 Open Smart Scanner</p>
                                   <p className="text-sm text-white/70">AI-guided capture with live feedback</p>
                               </div>
                           </div>
                       </button>
                   </div>
                   
                   {/* Quick Actions */}
                   <div className="bg-black/20 p-4">
                       <div className="grid grid-cols-3 gap-3">
                           <button 
                             onClick={() => cameraInputRef.current?.click()}
                             disabled={isServerBusy}
                             className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white text-center"
                           >
                               <span className="text-xl">📸</span>
                               <p className="text-xs mt-1 font-medium">Quick Photo</p>
                           </button>
                           <button 
                             onClick={() => galleryInputRef.current?.click()}
                             disabled={isServerBusy}
                             className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white text-center"
                           >
                               <span className="text-xl">🖼️</span>
                               <p className="text-xs mt-1 font-medium">Gallery</p>
                           </button>
                           {diagnosisMode === 'crop' && (
                               <button 
                                 onClick={() => videoInputRef.current?.click()}
                                 disabled={isServerBusy}
                                 className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white text-center"
                               >
                                   <span className="text-xl">🎥</span>
                                   <p className="text-xs mt-1 font-medium">Video</p>
                               </button>
                           )}
                       </div>
                   </div>
               </div>

               {/* Description Input - Enhanced */}
                <Card className="w-full border-none shadow-xl">
                    <CardContent className="pt-6 space-y-4">
                        <div className="relative">
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={diagnosisMode === 'soil' ? "Describe soil texture (e.g. Sticky when wet, sandy...)" : t('diag_describe_placeholder', lang)}
                                className="resize-none min-h-[100px] pr-12 rounded-xl border-2 focus:border-green-500 transition-colors"
                            />
                            <div className="absolute right-3 bottom-3 text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 18.5A2.5 2.5 0 0 1 9.5 16V7a2.5 2.5 0 0 1 5 0v9a2.5 2.5 0 0 1-2.5 2.5z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="23" x2="12" y2="18.5"/></svg>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <VoiceButton 
                              state={voiceState} 
                              onPress={handleVoicePress} 
                              label="Speak symptoms" 
                              icon={<span className="text-lg">🎤</span>} 
                              trailing="Tap to record" 
                              variant="outline" 
                              size="default" 
                              stream={activeStream}
                            />
                            {audioUrl && (
                              <Button 
                                variant="ghost" 
                                onClick={() => {
                                  if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); } 
                                  else { audioRef.current.src = audioUrl; audioRef.current.play(); setIsPlaying(true); }
                                }}
                              >
                                {isPlaying ? 'Pause' : 'Play'}
                              </Button>
                            )}
                        </div>
                        {diagnosisMode === 'crop' && (
                            <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                <label className="text-xs font-bold text-slate-500 uppercase whitespace-nowrap">{t('diag_crop_age', lang)}</label>
                                <Input 
                                    type="number" 
                                    placeholder="Days" 
                                    value={cropAge} 
                                    onChange={(e) => setCropAge(e.target.value)} 
                                    className="w-24 bg-white dark:bg-slate-900 border-2 focus:border-green-500" 
                                />
                                <span className="text-xs text-slate-400">days since planting</span>
                            </div>
                        )}
                    </CardContent>
               </Card>

               {/* Media Preview & Submit */}
               {mediaItems.length > 0 && !loading && !isServerBusy && (
                   <div className="w-full animate-fadeIn space-y-4">
                       <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                           {mediaItems.map((item) => (
                               <div key={item.id} className="relative w-48 h-48 rounded-2xl overflow-hidden border-2 border-white shadow-xl shrink-0 group">
                                   <img src={item.previewUrl} className="w-full h-full object-cover" alt="Scan preview" />
                                   <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                   <button 
                                     onClick={() => setMediaItems(mediaItems.filter(i => i.id !== item.id))} 
                                     className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all"
                                   >
                                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                                   </button>
                                   <div className="absolute bottom-2 left-2 px-2 py-1 bg-white/90 rounded-lg text-xs font-medium">
                                       {item.type === 'video' ? '🎥 Video' : '📸 Photo'}
                                   </div>
                               </div>
                           ))}
                           {/* Add More Button */}
                           <button 
                             onClick={() => setShowLiveScanner(true)}
                             className="w-48 h-48 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-green-500 hover:text-green-500 transition-all shrink-0"
                           >
                               <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                               <span className="text-sm font-medium">Add More</span>
                           </button>
                       </div>
                       
                       <Button 
                        onClick={startDiagnosisProcess} 
                        disabled={gettingLocation}
                        className={`w-full h-14 text-lg font-bold border-none shadow-xl text-white rounded-2xl transition-all ${diagnosisMode === 'soil' ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700' : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'}`}
                       >
                           {gettingLocation ? (
                               <span className="flex items-center gap-2">
                                   <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                   Loading Location...
                               </span>
                           ) : (
                               <span className="flex items-center gap-2">
                                   <span>🔬</span>
                                   {diagnosisMode === 'soil' ? "Analyze Soil Health" : t('diag_start', lang)}
                               </span>
                           )}
                       </Button>
                   </div>
               )}

               {/* Enhanced Loading State with AI Council */}
               {loading && !isServerBusy && (
                   <div className="w-full mt-2 animate-fadeInUp">
                       <EnhancedDebateFeed logs={debateLogs} activeAgent={activeAgent} mode={diagnosisMode} />
                   </div>
               )}

               {error && (
                   <div className="w-full p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-2xl text-sm font-medium flex items-center gap-3">
                       <span className="text-xl">⚠️</span>
                       {error}
                   </div>
               )}
            </div>
          </main>
      </div>
    </div>
  );
};
