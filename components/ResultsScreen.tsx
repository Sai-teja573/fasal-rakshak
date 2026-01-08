
import React, { useState, useEffect, useRef } from 'react';
import { DiagnosisResponse, Language, MarketItem, User } from '../types';
import { translateDiagnosis, generateGeminiTTS, AudioPlayer, askDiseaseFollowUpStream, generatePageSummary, transcribeUserAudio } from '../services/geminiService';
import { getRealMarketPrices } from '../services/agroService';
import { getAppConfig } from '../services/cmsService';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Chart from 'chart.js/auto';
import { UI_LANGUAGES, t } from '../services/translationService';
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from './ui/Conversation';
import { LoadingScreen } from './ui/LoadingScreen';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from './ui/Shadcn';
import { VoiceButton, VoiceButtonState } from './ui/VoiceButton';

interface ResultsScreenProps {
  data: DiagnosisResponse;
  onBack: () => void;
  onUpdateData: (newData: DiagnosisResponse) => void;
  user: User | null;
  lang: Language;
  onFollowUp: () => void;
}

const LANGUAGES: { code: Language; name: string }[] = UI_LANGUAGES;

export const ResultsScreen: React.FC<ResultsScreenProps> = ({ data, onBack, onUpdateData, user, lang, onFollowUp }) => {
  const [activeTab, setActiveTab] = useState<'treatment' | 'analysis' | 'market'>('treatment');
  const [subTab, setSubTab] = useState<'chemical' | 'organic'>('chemical');
  const [translating, setTranslating] = useState(false);
  const [cropMarketData, setCropMarketData] = useState<MarketItem | null>(null);
  const [chartDataUrl, setChartDataUrl] = useState<string | null>(null);
  const [viewLanguage, setViewLanguage] = useState<'en' | 'local'>('en');
  
  // App Config
  const [config] = useState(getAppConfig());
  
  // Audio State
  const [speaking, setSpeaking] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  
  // Modal States
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  
  // Voice Chat State
  const [chatVoiceState, setChatVoiceState] = useState<VoiceButtonState>('idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // Share Prompt State
  const [showGuestPopup, setShowGuestPopup] = useState(false);

  // PDF Generation State
  const [pdfImageBase64, setPdfImageBase64] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<HTMLCanvasElement>(null);
  
  // DEDICATED PDF REF
  const pdfPrintRef = useRef<HTMLDivElement>(null);

  const severityLevel = parseInt(data.severity?.match(/(\d)\/5/)?.[1] || '3');
  const severityColor = severityLevel >= 4 ? 'bg-red-500' : severityLevel === 3 ? 'bg-yellow-500' : 'bg-green-500';

  const currentAdvisory = (viewLanguage === 'en' && data.treatment_advisory) 
      ? data.treatment_advisory 
      : data.treatment_advisory;

  const currentDiseaseName = viewLanguage === 'en' ? data.disease_name_en : data.disease_name_local;
  
  // Page Summarizer Logic
  const pageSummary = viewLanguage === 'en' ? data.friendly_summary?.en : data.friendly_summary?.local;

  // Initialize Audio Player ONCE on mount
  useEffect(() => {
      audioPlayerRef.current = new AudioPlayer();
      return () => {
          if (audioPlayerRef.current) audioPlayerRef.current.stop();
      }
  }, []);

  const handleLanguageChange = async (targetLang: Language) => {
      // 1. Check Cache first
      if (data.translations && data.translations[targetLang]) {
          const cached = data.translations[targetLang];
          onUpdateData({ ...cached, translations: data.translations });
          setViewLanguage('local');
          return;
      }

      setTranslating(true);
      try {
        // IMPORTANT: Always use English data as source if available to prevent drift
        const baseData = data.translations?.['en'] || data; 
        
        const translatedData = await translateDiagnosis(baseData, targetLang);
        
        // Ensure source (English) is preserved in history BEFORE overwriting
        const newTranslations = {
            ...(data.translations || {}),
            [targetLang]: translatedData,
            // If 'en' is missing, cache the CURRENT data as 'en' (assuming current is English before switch)
            'en': (data.translations?.['en'] || (viewLanguage === 'en' ? data : baseData)) 
        };

        const finalData = { ...translatedData, translations: newTranslations };
        onUpdateData(finalData);
        setViewLanguage('local');
      } catch(e) {
          console.error("Translation Failed", e);
      } finally {
          setTranslating(false);
      }
  };

  // Sync with Global Language Prop
  useEffect(() => {
    const targetLangName = LANGUAGES.find(l => l.code === lang)?.name;
    
    // If Global is English
    if (lang === 'en') {
        if (viewLanguage !== 'en') {
            // Restore English Data from cache if available
            if (data.translations?.['en']) {
                onUpdateData({ ...data.translations['en'], translations: data.translations });
            }
            setViewLanguage('en');
        }
        return;
    }

    // If Global is Local Language
    if (data.local_language_output === targetLangName) {
        if (viewLanguage !== 'local') setViewLanguage('local');
    } else {
        if (!translating) {
            handleLanguageChange(lang);
        }
    }
  }, [lang]);

  const getEmbedUrl = (url: string) => {
    try {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regex);
        return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=1` : null;
    } catch (e) {
        return null;
    }
  };

  const handleVideoClick = (url: string) => {
      const embed = getEmbedUrl(url);
      if (embed) {
          setCurrentVideoUrl(embed);
          setShowVideoModal(true);
      } else {
          window.open(url, '_blank');
      }
  };

  const submitChat = async (text: string) => {
      if (!text.trim()) return;
      
      const newMsg = { role: 'user' as const, text };
      const placeholderMsg = { role: 'model' as const, text: '' };
      
      setChatMessages(prev => [...prev, newMsg, placeholderMsg]);
      setChatInput('');
      setChatLoading(true);

      try {
          const stream = askDiseaseFollowUpStream(data, text, chatMessages);
          let fullResponse = "";
          
          for await (const chunk of stream) {
              fullResponse += chunk;
              setChatMessages(prev => {
                  const updated = [...prev];
                  // Update the last message (placeholder) with accumulated text
                  updated[updated.length - 1] = { role: 'model', text: fullResponse };
                  return updated;
              });
          }
      } catch (e) {
          console.error(e);
          setChatMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'model', text: "Error fetching response." };
              return updated;
          });
      } finally {
          setChatLoading(false);
      }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      submitChat(chatInput);
  };

  // Chat Voice Handling
  const handleChatVoicePress = async () => {
      if (chatVoiceState === 'idle') {
          try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              mediaRecorderRef.current = new MediaRecorder(stream);
              chunksRef.current = [];
              mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
              mediaRecorderRef.current.onstop = async () => {
                  setChatVoiceState('processing');
                  const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                  
                  // Convert Blob to Base64
                  const reader = new FileReader();
                  reader.readAsDataURL(blob);
                  reader.onloadend = async () => {
                      const base64Audio = (reader.result as string).split(',')[1];
                      try {
                          const text = await transcribeUserAudio(base64Audio);
                          if (text) {
                              submitChat(text);
                              setChatVoiceState('success');
                          } else {
                              setChatVoiceState('error');
                          }
                      } catch (e) {
                          setChatVoiceState('error');
                      }
                      setTimeout(() => setChatVoiceState('idle'), 1500);
                  };
              };
              mediaRecorderRef.current.start();
              setChatVoiceState('recording');
          } catch (e) {
              setChatVoiceState('error');
              setTimeout(() => setChatVoiceState('idle'), 1000);
          }
      } else if (chatVoiceState === 'recording') {
          mediaRecorderRef.current?.stop();
      }
  };

  const handleShare = async () => {
    const shareText = `🌱 Fasal Rakshak Diagnosis Report\n\nCrop: ${data.crop_identified}\nIssue: ${data.disease_name_en}\nSeverity: ${data.severity}\n\nView full AI analysis and treatment plan on the app.`;
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Fasal Rakshak Report',
                text: shareText,
                url: window.location.href
            });
        } catch (e) { console.log('Share canceled'); }
    } else {
        alert("Sharing not supported on this device/browser.");
    }
    
    if (!user) setTimeout(() => setShowGuestPopup(true), 2000);
  };

  // --- GEMINI TTS HANDLER ---
  const handleAssistantVoice = async () => {
      if (speaking) {
          audioPlayerRef.current?.stop();
          setSpeaking(false);
          return;
      }

      setGeneratingAudio(true);
      try {
          const langName = viewLanguage === 'en' ? 'English' : (data.local_language_output || 'English');
          
          // 1. Generate Friendly Summary if missing
          let textToRead = pageSummary;
          if (!textToRead || textToRead.length < 10) {
              textToRead = await generatePageSummary(data, langName);
              // Update state with new summary
              if (textToRead) {
                  const updatedData = { 
                      ...data, 
                      friendly_summary: { 
                          ...data.friendly_summary, 
                          [viewLanguage === 'en' ? 'en' : 'local']: textToRead 
                      } 
                  };
                  onUpdateData(updatedData);
              }
          }

          if (!textToRead) textToRead = "Summary not available.";

          // 2. Generate Audio via Gemini TTS
          const audioBase64 = await generateGeminiTTS(textToRead);
          
          if (audioBase64 && audioPlayerRef.current) {
              setSpeaking(true);
              audioPlayerRef.current.play(audioBase64);
              // Simple timeout to reset state
              const durationSec = textToRead.split(' ').length / 2.5;
              setTimeout(() => setSpeaking(false), durationSec * 1000 + 2000);
          }
      } catch (e) {
          console.error("Audio generation failed", e);
      } finally {
          setGeneratingAudio(false);
      }
  };

  useEffect(() => {
    // Canvas Drawing Logic
    const drawCanvas = () => {
        if (data.imageUrl && canvasRef.current) {
            const img = new Image();
            // IMPORTANT: Cross Origin anonymous required for Canvas to not taint
            if (!data.imageUrl.startsWith('data:')) {
                img.crossOrigin = "anonymous";
            }
            img.src = data.imageUrl;
            
            img.onload = () => {
                const canvas = canvasRef.current!;
                // Ensure parent container width matches
                const parent = canvas.parentElement;
                if(parent) {
                    canvas.width = parent.clientWidth;
                    canvas.height = parent.clientHeight; // Maintain aspect or fit
                } else {
                    canvas.width = img.width;
                    canvas.height = img.height;
                }

                // Calculate aspect ratio fit
                const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
                const x = (canvas.width / 2) - (img.width / 2) * scale;
                const y = (canvas.height / 2) - (img.height / 2) * scale;
                
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                    
                    if (data.disease_bounding_box) {
                        const { ymin, xmin, ymax, xmax } = data.disease_bounding_box!;
                        // Box coords are normalized 0-1000. 
                        // Need to map them to the DRAWN image coordinates (x,y,scale)
                        const boxX = x + (xmin / 1000) * (img.width * scale);
                        const boxY = y + (ymin / 1000) * (img.height * scale);
                        const boxW = ((xmax - xmin) / 1000) * (img.width * scale);
                        const boxH = ((ymax - ymin) / 1000) * (img.height * scale);

                        ctx.strokeStyle = 'red';
                        ctx.lineWidth = 4;
                        ctx.strokeRect(boxX, boxY, boxW, boxH);
                        
                        // Add "Disease" Label
                        ctx.fillStyle = 'red';
                        ctx.fillRect(boxX, boxY - 20, 60, 20);
                        ctx.fillStyle = 'white';
                        ctx.font = 'bold 12px sans-serif';
                        ctx.fillText('Issue', boxX + 5, boxY - 5);
                    }
                }
            };
        }
    };

    drawCanvas();
    window.addEventListener('resize', drawCanvas);

    if ('geolocation' in navigator && !data.isOffline) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            let district = "New Delhi"; 
            let state = "Delhi";

            try {
                const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
                const locData = await res.json();
                district = locData.locality || locData.city || district;
                state = locData.principalSubdivision || state;
            } catch(e) {}

            const marketRes = await getRealMarketPrices(district, state, [data.crop_identified]);
            if(marketRes.length > 0) {
                const match = marketRes[0];
                const currentPrice = parseFloat(match.price.replace(/[^\d.]/g, '')) || 2000;
                const simulatedHistory = [];
                for(let i=6; i>=0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const flux = (Math.random() * 100) - 50; 
                    simulatedHistory.push({
                        date: d.toLocaleDateString(),
                        price: Math.round(i === 0 ? currentPrice : currentPrice + flux)
                    });
                }
                setCropMarketData({ ...match, history: simulatedHistory });
            }
        });
    }

    return () => { 
        window.removeEventListener('resize', drawCanvas);
        audioPlayerRef.current?.stop(); 
    };
  }, [data]);

  useEffect(() => {
    if (chartRef.current && activeTab === 'market') {
        const ctx = chartRef.current.getContext('2d');
        if (ctx) {
             const chartStatus = Chart.getChart(chartRef.current);
             if (chartStatus) chartStatus.destroy();

             const historySource = cropMarketData?.history || data.market_trend_graph;

             if (historySource && historySource.length > 0) {
                 new Chart(ctx, {
                     type: 'line',
                     data: {
                         labels: historySource.map(d => d.date),
                         datasets: [{
                             label: `${data.crop_identified} Price (₹/q)`,
                             data: historySource.map(d => d.price),
                             borderColor: '#16a34a',
                             tension: 0.4,
                             fill: true,
                             backgroundColor: 'rgba(22, 163, 74, 0.1)'
                         }]
                     },
                     options: {
                         responsive: true,
                         maintainAspectRatio: false,
                         animation: { onComplete: () => { if(chartRef.current) setChartDataUrl(chartRef.current.toDataURL()); } },
                         plugins: { legend: { display: false } },
                         scales: { y: { beginAtZero: false } }
                     }
                 });
             }
        }
    }
  }, [data, cropMarketData, activeTab]);

  const generateProfessionalPDF = async () => {
    if (!pdfPrintRef.current) return;
    
    setTranslating(true);

    try {
        // BUG FIX: Pre-fetch image as Base64 to avoid CORS issues in html2canvas
        // If image is remote (not data URI), fetch and convert it first
        if (data.imageUrl && !data.imageUrl.startsWith('data:')) {
            try {
                const response = await fetch(data.imageUrl);
                const blob = await response.blob();
                const base64 = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
                setPdfImageBase64(base64);
                // Give React a moment to render the updated image source in hidden view
                await new Promise(r => setTimeout(r, 200));
            } catch (e) {
                console.warn("Failed to convert image to base64 for PDF", e);
                // Continue with original URL (might fail but worth trying)
            }
        }

        await new Promise(r => setTimeout(r, 500)); // Wait for render
    
        const element = pdfPrintRef.current;
        
        const canvas = await html2canvas(element, { 
            scale: 2, 
            useCORS: true, 
            allowTaint: true, 
            backgroundColor: '#ffffff',
            logging: false,
            width: element.scrollWidth,
            height: element.scrollHeight
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.9);
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Fasal_Rakshak_${data.crop_identified}_${Date.now()}.pdf`);
    } catch (e: any) {
        console.error("PDF Generation Error", e);
        alert("PDF Generation Failed: " + e.message);
    } finally {
        setPdfImageBase64(null); // Reset
        setTranslating(false);
    }
  };

  const getDisplayLinks = () => {
      const customForCrop = config.customLinks.find(c => data.crop_identified.toLowerCase().includes(c.crop.toLowerCase()));
      if (customForCrop && customForCrop.links.length > 0) {
          return customForCrop.links;
      }
      if (data.buy_links && data.buy_links.length > 0) return data.buy_links;
      
      const treatmentName = currentAdvisory?.chemical_option?.product_name || "Fungicide";
      if (!treatmentName.toLowerCase().includes("consult")) {
          return [
              { title: `Buy ${treatmentName} on Amazon`, uri: `https://www.amazon.in/s?k=${encodeURIComponent(treatmentName)}+agriculture`, source: 'Amazon' as const },
              { title: `Search on Flipkart`, uri: `https://www.flipkart.com/search?q=${encodeURIComponent(treatmentName)}+agriculture`, source: 'Flipkart' as const }
          ];
      }
      return [];
  };

  const buyLinks = getDisplayLinks();

  if (translating) {
      return (
          <div className="h-full relative">
              <LoadingScreen text="Processing PDF..." className="absolute" overlay />
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-200 relative">
      
      {/* HIDDEN PRINT VIEW FOR PDF GENERATION */}
      <div 
        ref={pdfPrintRef} 
        style={{ 
            position: 'fixed', top: -9999, left: -9999, width: '800px', 
            background: 'white', padding: '40px', color: 'black',
            fontFamily: 'sans-serif', zIndex: -1
        }}
      >
          <div style={{borderBottom: '2px solid #16a34a', paddingBottom: '20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div>
                  <h1 style={{fontSize: '28px', fontWeight: 'bold', margin: 0, color: '#111827'}}>{currentDiseaseName}</h1>
                  <p style={{fontSize: '14px', color: '#6b7280', marginTop: '5px'}}>{data.crop_identified} • Detected via Fasal Rakshak AI</p>
                  {data.isOffline && <p style={{fontSize: '12px', color: '#eab308', fontWeight: 'bold'}}>OFFLINE MODE</p>}
              </div>
              <div style={{background: '#16a34a', color: 'white', padding: '5px 15px', borderRadius: '20px', fontWeight: 'bold'}}>
                  Severity: {data.severity}
              </div>
          </div>

          <div style={{display: 'flex', gap: '30px', marginBottom: '30px'}}>
              <div style={{width: '40%'}}>
                  {/* Explicit crossOrigin for PDF generation safety. Using pdfImageBase64 if available */}
                  {(pdfImageBase64 || data.imageUrl) && (
                      <img 
                        src={pdfImageBase64 || data.imageUrl} 
                        style={{width: '100%', borderRadius: '10px', border: '1px solid #e5e7eb'}} 
                        crossOrigin="anonymous" 
                      />
                  )}
              </div>
              <div style={{width: '60%'}}>
                  <div style={{background: '#f0fdf4', padding: '20px', borderRadius: '10px', borderLeft: '5px solid #16a34a'}}>
                      <h3 style={{fontSize: '16px', fontWeight: 'bold', margin: '0 0 10px 0', color: '#166534'}}>Diagnosis Summary</h3>
                      <p style={{fontSize: '14px', lineHeight: '1.6', color: '#374151'}}>{currentAdvisory?.summary || pageSummary}</p>
                  </div>
              </div>
          </div>

          <div style={{marginBottom: '30px'}}>
              <h3 style={{fontSize: '18px', fontWeight: 'bold', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', marginBottom: '15px'}}>Treatment Plan</h3>
              <div style={{display: 'flex', gap: '20px'}}>
                  <div style={{flex: 1, padding: '15px', background: '#eff6ff', borderRadius: '10px', border: '1px solid #dbeafe'}}>
                      <h4 style={{margin: '0 0 10px 0', color: '#1e40af', fontWeight: 'bold'}}>Chemical</h4>
                      <p style={{fontSize: '14px', marginBottom: '5px'}}><strong>Product:</strong> {currentAdvisory?.chemical_option?.product_name}</p>
                      <p style={{fontSize: '14px', marginBottom: '5px'}}><strong>Dosage:</strong> {currentAdvisory?.chemical_option?.dosage}</p>
                      <p style={{fontSize: '14px'}}><strong>Method:</strong> {currentAdvisory?.chemical_option?.application}</p>
                  </div>
                  <div style={{flex: 1, padding: '15px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #dcfce7'}}>
                      <h4 style={{margin: '0 0 10px 0', color: '#166534', fontWeight: 'bold'}}>Organic</h4>
                      <p style={{fontSize: '14px', marginBottom: '5px'}}><strong>Solution:</strong> {currentAdvisory?.organic_option?.product_name}</p>
                      <p style={{fontSize: '14px', marginBottom: '5px'}}><strong>Instructions:</strong> {currentAdvisory?.organic_option?.detailed_instructions}</p>
                  </div>
              </div>
          </div>

          <div>
              <p style={{fontSize: '12px', color: '#9ca3af', textAlign: 'center', marginTop: '40px'}}>Generated by Fasal Rakshak AI • {new Date().toLocaleDateString()}</p>
          </div>
      </div>

      {/* VIDEO MODAL */}
      {showVideoModal && currentVideoUrl && (
          <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
              <div className="w-full max-w-4xl relative">
                  <button onClick={() => setShowVideoModal(false)} className="absolute -top-12 right-0 text-white p-2">✕</button>
                  <div className="relative pt-[56.25%] bg-black rounded-xl overflow-hidden shadow-2xl">
                      <iframe src={currentVideoUrl} className="absolute inset-0 w-full h-full" allowFullScreen />
                  </div>
              </div>
          </div>
      )}

      {/* CHAT MODAL */}
      {showChatModal && (
          <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm animate-fadeIn">
              <div className="w-full h-full sm:h-[600px] sm:w-full sm:max-w-md bg-white dark:bg-slate-800 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                  <div className="p-4 bg-green-600 flex justify-between items-center text-white shrink-0">
                      <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">🤖</div>
                          <div><h3 className="font-bold text-sm">Ask about {data.crop_identified}</h3></div>
                      </div>
                      <button onClick={() => setShowChatModal(false)} className="p-1 hover:bg-white/20 rounded-full">✕</button>
                  </div>
                  
                  <Conversation className="flex-1 min-h-0 bg-slate-50 dark:bg-slate-900">
                      <ConversationContent>
                          {chatMessages.length === 0 ? (
                              <ConversationEmptyState title="Expert AI Chat" description={data.isOffline ? "Unavailable Offline" : "Ask specific questions about treatment or prevention."} icon={<span>💬</span>} />
                          ) : (
                              chatMessages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-green-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-tl-none shadow-sm'}`}>
                                        {msg.text || (
                                            /* Typing indicator for empty streaming message */
                                            <span className="flex gap-1 items-center h-4"><span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span><span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></span><span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></span></span>
                                        )}
                                    </div>
                                </div>
                              ))
                          )}
                      </ConversationContent>
                      <ConversationScrollButton />
                  </Conversation>

                  <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 shrink-0">
                      <div className="flex gap-2 items-center">
                          <form onSubmit={handleChatSubmit} className="flex-1 flex gap-2">
                              <input 
                                value={chatInput} 
                                onChange={(e) => setChatInput(e.target.value)} 
                                placeholder={data.isOffline ? "Offline Mode" : "Ask a question..."} 
                                className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-full px-4 py-3 text-sm outline-none disabled:opacity-50"
                                disabled={!!data.isOffline}
                              />
                              <button disabled={chatLoading || !!data.isOffline} type="submit" className="p-3 bg-green-600 text-white rounded-full flex items-center justify-center shadow-sm disabled:opacity-50">➤</button>
                          </form>
                          {!data.isOffline && (
                              <VoiceButton 
                                  state={chatVoiceState}
                                  onPress={handleChatVoicePress}
                                  icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>}
                                  className="w-12 h-12 rounded-full"
                                  size="icon"
                              />
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* GUEST POPUP */}
      {showGuestPopup && !user && (
          <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-96 bg-slate-900 text-white p-6 rounded-2xl shadow-2xl z-50 animate-bounce-in">
              <button onClick={() => setShowGuestPopup(false)} className="absolute top-2 right-2 text-slate-400">✕</button>
              <h3 className="font-bold text-lg mb-2">Save this report?</h3>
              <p className="text-slate-300 text-sm mb-4">Sign up to track your crop health history.</p>
              <button onClick={() => window.location.reload()} className="w-full py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg">Create Account</button>
          </div>
      )}
      
      {/* HEADER */}
      <header className="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-20 transition-colors shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors">
              <span className="text-xl">←</span> <span className="font-bold text-sm">{t('auth_back', lang)}</span>
          </button>
          <div className="flex gap-2">
              <Button size="sm" variant="default" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={onFollowUp}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                  Follow Up
              </Button>
              <Button size="sm" variant="outline" onClick={handleShare}>Share</Button>
              <Button size="sm" onClick={generateProfessionalPDF}>Save PDF</Button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT - MOBILE OPTIMIZED LAYOUT */}
      <main className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-900">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-6 p-4 md:p-6">
              
              {/* LEFT COLUMN: PATIENT CARD & ACTIONS */}
              <div className="w-full md:w-1/3 flex flex-col gap-4">
                  
                  {/* OFFLINE WARNING BANNER */}
                  {data.isOffline && (
                      <div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 p-4 rounded-r-lg shadow-sm">
                          <h4 className="font-bold text-orange-800 dark:text-orange-300 text-sm flex items-center gap-2">
                              <span>⚠️</span> Offline Diagnosis
                          </h4>
                          <p className="text-xs text-orange-700 dark:text-orange-200 mt-1">
                              This result is based on general crop data because you are offline. Image analysis was not performed.
                              <br/><strong>Please re-scan when online for accuracy.</strong>
                          </p>
                      </div>
                  )}

                  {/* PATIENT RECORD CARD */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-l-4 border-l-green-600 border-t border-r border-b border-slate-200 dark:border-slate-700 p-4">
                      <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-3 mb-3">
                          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-700 dark:text-green-300">
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
                          </div>
                          <div>
                              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Patient File</h4>
                              <p className="text-lg font-bold text-slate-800 dark:text-white leading-none">{data.crop_identified}</p>
                          </div>
                      </div>
                      <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                              <span className="text-slate-500">Case ID:</span>
                              <span className="font-mono text-slate-700 dark:text-slate-300">{data.scanId.slice(0,8)}</span>
                          </div>
                          <div className="flex justify-between">
                              <span className="text-slate-500">Date:</span>
                              <span>{new Date().toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between items-center">
                              <span className="text-slate-500">Attending:</span>
                              <Badge variant="secondary" className="text-xs">{data.isOffline ? 'Offline Model' : 'Dr. AI Council'}</Badge>
                          </div>
                      </div>
                  </div>

                  {/* AI HEALTH SCORE CARD - NEW */}
                  <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-lg p-5 text-white relative overflow-hidden text-center">
                      <div className="absolute inset-0 bg-white/5 opacity-30 pattern-dots"></div>
                      <h4 className="text-xs font-bold uppercase tracking-wider opacity-80 mb-2 relative z-10">AI Crop Health Score</h4>
                      
                      <div className="relative z-10 flex items-center justify-center">
                          <div className="w-24 h-24 rounded-full border-4 border-white/20 flex items-center justify-center relative">
                              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                                <path
                                  className="text-white/10"
                                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                />
                                <path
                                  className="text-white drop-shadow-md transition-all duration-1000 ease-out"
                                  strokeDasharray={`${data.health_score || 75}, 100`}
                                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                />
                              </svg>
                              <div className="text-3xl font-black">{data.health_score || 75}</div>
                          </div>
                      </div>
                      
                      <p className="text-xs mt-3 relative z-10 opacity-90 font-medium">
                          {data.health_score && data.health_score > 80 ? "Condition is manageable." : data.health_score && data.health_score > 50 ? "Requires immediate action." : "Critical condition detected."}
                      </p>
                  </div>

                  {/* Image Card */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative group">
                      <div className="relative aspect-square w-full bg-slate-100">
                          {data.imageUrl && <img src={data.imageUrl} className="hidden" crossOrigin="anonymous" />}
                          <canvas ref={canvasRef} className="w-full h-full object-contain" />
                          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold border border-white/20">
                              {t('rs_confidence', lang)}: {data.confidence || 95}%
                          </div>
                      </div>
                      
                      {/* Audio Controls */}
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                          <div className="flex items-center gap-3">
                              <button 
                                onClick={handleAssistantVoice} 
                                disabled={generatingAudio || !!data.isOffline}
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${speaking ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-green-100 text-green-600 hover:scale-105'} ${data.isOffline ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                  {generatingAudio ? (
                                      <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                                  ) : speaking ? (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                                  ) : (
                                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                  )}
                              </button>
                              <div className="flex-1">
                                  <p className="text-xs font-bold text-slate-500 uppercase">{t('rs_ai_summary', lang)}</p>
                                  <p className="text-sm font-bold text-slate-800 dark:text-white">
                                      {data.isOffline ? "Audio not available offline" : generatingAudio ? t('rs_generating', lang) : speaking ? t('rs_speaking', lang) : t('rs_generate_audio', lang)}
                                  </p>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>

              {/* RIGHT COLUMN: DETAILS & TABS */}
              <div className="w-full md:w-2/3 flex flex-col gap-6">
                  
                  {/* Title & Severity Header */}
                  <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                          <div>
                              <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight">{currentDiseaseName}</h1>
                              <p className="text-slate-500 dark:text-slate-400 text-sm">{data.crop_identified} • {t('rs_detected_via_ai', lang)}</p>
                          </div>
                          <div className={`px-4 py-2 rounded-xl text-white font-bold text-sm shadow-sm ${severityColor}`}>
                              {t('rs_severity', lang)}: {data.severity}
                          </div>
                      </div>
                  </div>

                  {/* Q&A Summary (New Feature) */}
                  {data.user_answers && Object.keys(data.user_answers).length > 0 && (
                      <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800 p-4">
                          <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2 uppercase">Doctor's Notes (Anamnesis)</h4>
                          <ul className="text-sm space-y-1 text-slate-700 dark:text-slate-300">
                              {data.preliminary_questions?.map(q => (
                                  <li key={q.id}>
                                      <span className="font-semibold text-slate-500 dark:text-slate-400">{q.question}:</span> <span className="font-bold">{data.user_answers?.[q.id]}</span>
                                  </li>
                              ))}
                          </ul>
                      </div>
                  )}

                  {/* INVALID FOLLOW UP WARNING */}
                  {data.isValidFollowUp === false && (
                      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-50 p-4 rounded-r-lg">
                          <h4 className="font-bold text-red-700 dark:text-red-300 mb-1">Different Plant Detected</h4>
                          <p className="text-sm text-red-600 dark:text-red-200">{data.message || "Please upload an image of the same plant to track progress."}</p>
                      </div>
                  )}

                  {/* Tabs */}
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto no-scrollbar">
                      {['treatment', 'analysis', 'market'].map((tab) => (
                          <button 
                            key={tab}
                            onClick={() => setActiveTab(tab as any)} 
                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold capitalize transition-all whitespace-nowrap ${activeTab === tab ? 'bg-white dark:bg-slate-700 shadow-md text-green-600 dark:text-green-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                          >
                              {t(`rs_${tab}`, lang)}
                          </button>
                      ))}
                  </div>

                  {/* TAB CONTENT */}
                  <div className="flex-1">
                      {activeTab === 'treatment' && (
                          <div className="space-y-6 animate-fadeIn">
                              
                              {/* FOLLOW UP PROGRESS CARD */}
                              {data.comparisonAnalysis && (
                                  <Card className="border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-900/10">
                                      <CardHeader>
                                          <CardTitle className="text-lg text-blue-800 dark:text-blue-300 flex items-center gap-2">
                                              <span>📈</span> {t('rs_progress', lang)}
                                          </CardTitle>
                                      </CardHeader>
                                      <CardContent className="space-y-4">
                                          <div className="flex justify-between items-center">
                                              <span className="font-bold text-slate-700 dark:text-slate-300 capitalize">{data.comparisonAnalysis.progressStatus.replace('_', ' ')}</span>
                                              <Badge className="bg-blue-600 hover:bg-blue-700">{data.comparisonAnalysis.improvementPercentage}% {t('rs_improved', lang)}</Badge>
                                          </div>
                                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                                              <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${data.comparisonAnalysis.improvementPercentage}%` }}></div>
                                          </div>
                                          <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                                              <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm">
                                                  <p className="font-bold text-green-600 mb-1">{t('rs_resolved_sym', lang)}</p>
                                                  <ul className="list-disc pl-4 text-slate-600 dark:text-slate-400 space-y-1">
                                                      {data.comparisonAnalysis.symptomsResolved.length > 0 ? data.comparisonAnalysis.symptomsResolved.map((s, i) => <li key={i}>{s}</li>) : <li>None yet</li>}
                                                  </ul>
                                              </div>
                                              <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm">
                                                  <p className="font-bold text-orange-500 mb-1">{t('rs_remaining', lang)}</p>
                                                  <ul className="list-disc pl-4 text-slate-600 dark:text-slate-400 space-y-1">
                                                      {data.comparisonAnalysis.symptomsRemaining.length > 0 ? data.comparisonAnalysis.symptomsRemaining.map((s, i) => <li key={i}>{s}</li>) : <li>All clear!</li>}
                                                  </ul>
                                              </div>
                                          </div>
                                          {data.treatmentAnalysis && (
                                              <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                                                  <p className="text-xs font-bold uppercase text-slate-500 mb-1">{t('rs_method_used', lang)}: {data.treatmentAnalysis.treatmentName}</p>
                                                  <p className="text-sm italic text-slate-700 dark:text-slate-300">"{data.treatmentAnalysis.effectivenessReason}"</p>
                                              </div>
                                          )}
                                      </CardContent>
                                  </Card>
                              )}

                              <Card className="border-l-4 border-l-green-500">
                                  <CardContent className="p-5">
                                      <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-white">{t('rs_diagnosis_summary', lang)}</h3>
                                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                                          {currentAdvisory?.summary || pageSummary}
                                      </p>
                                  </CardContent>
                              </Card>

                              {/* NEW: Medicine & Cost Calculator */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Calculator Card */}
                                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                                      <div className="flex items-center gap-2 mb-3 text-green-700 dark:text-green-400">
                                          <span className="text-xl">🧪</span>
                                          <h4 className="font-bold text-sm uppercase">AI Medicine Calculator</h4>
                                      </div>
                                      
                                      <div className="space-y-3">
                                          <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                              <p className="text-xs text-slate-500 uppercase font-bold mb-1">Your Prescription</p>
                                              <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                                  {data.dosage_guide?.instruction || "Dosage calculation pending..."}
                                              </p>
                                          </div>
                                          <div className="flex justify-between text-sm">
                                              <span className="text-slate-500">Water Needed:</span>
                                              <span className="font-medium text-slate-800 dark:text-white">{data.dosage_guide?.waterRequirement || "--"}</span>
                                          </div>
                                          <div className="flex justify-between text-sm">
                                              <span className="text-slate-500">Frequency:</span>
                                              <span className="font-medium text-slate-800 dark:text-white">{data.dosage_guide?.frequency || "--"}</span>
                                          </div>
                                      </div>
                                  </div>

                                  {/* Cost Estimator Card */}
                                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
                                      <div className="flex items-center gap-2 mb-3 text-blue-700 dark:text-blue-400">
                                          <span className="text-xl">💰</span>
                                          <h4 className="font-bold text-sm uppercase">Cost Estimator</h4>
                                      </div>
                                      
                                      {data.cost_analysis ? (
                                          <div className="space-y-3">
                                              <div className="flex justify-between items-end border-b border-slate-100 dark:border-slate-700 pb-2">
                                                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Estimated Cost</span>
                                                  <span className="text-xl font-black text-slate-900 dark:text-white">{data.cost_analysis.totalCostRange}</span>
                                              </div>
                                              <div className="space-y-1 pt-1">
                                                  {data.cost_analysis.costBreakdown.map((item, i) => (
                                                      <div key={i} className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                                                          <span>{item.split(':')[0]}</span>
                                                          <span className="font-medium">{item.split(':')[1]}</span>
                                                      </div>
                                                  ))}
                                              </div>
                                              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-400">
                                                  *Includes labor & materials. Market prices may vary.
                                              </div>
                                          </div>
                                      ) : (
                                          <p className="text-sm text-slate-400">Cost data unavailable for this diagnosis.</p>
                                      )}
                                  </div>
                              </div>

                              {/* Toggle Chem/Org */}
                              <div className="grid grid-cols-2 gap-3">
                                  <button onClick={() => setSubTab('chemical')} className={`p-4 rounded-xl border-2 text-left transition-all ${subTab === 'chemical' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                                      <h4 className="font-bold text-blue-700 dark:text-blue-300">{t('rs_chemical', lang)}</h4>
                                      <p className="text-xs text-slate-500">{t('rs_fast_action', lang)}</p>
                                  </button>
                                  <button onClick={() => setSubTab('organic')} className={`p-4 rounded-xl border-2 text-left transition-all ${subTab === 'organic' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                                      <h4 className="font-bold text-green-700 dark:text-green-300">{t('rs_organic', lang)}</h4>
                                      <p className="text-xs text-slate-500">{t('rs_eco_friendly', lang)}</p>
                                  </button>
                              </div>

                              <Card>
                                  <CardContent className="p-5 space-y-4">
                                      <div>
                                          <span className="text-xs font-bold text-slate-400 uppercase">{t('rs_rec_product', lang)}</span>
                                          <p className="text-xl font-bold text-slate-900 dark:text-white">{subTab === 'chemical' ? currentAdvisory?.chemical_option?.product_name : currentAdvisory?.organic_option?.product_name}</p>
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                          <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
                                              <span className="text-xs font-bold text-slate-400 uppercase">{t('rs_dosage', lang)}</span>
                                              <p className="font-medium">{subTab === 'chemical' ? currentAdvisory?.chemical_option?.dosage : currentAdvisory?.organic_option?.dosage}</p>
                                          </div>
                                          <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">
                                              <span className="text-xs font-bold text-slate-400 uppercase">{t('rs_method', lang)}</span>
                                              <p className="font-medium">{subTab === 'chemical' ? currentAdvisory?.chemical_option?.application : currentAdvisory?.organic_option?.application}</p>
                                          </div>
                                      </div>
                                      <div className="text-sm bg-yellow-50 dark:bg-yellow-900/10 text-yellow-800 dark:text-yellow-200 p-3 rounded-lg border border-yellow-100 dark:border-yellow-800">
                                          <strong>⚠️ {t('rs_note', lang)}: </strong> {subTab === 'chemical' ? currentAdvisory?.chemical_option?.detailed_instructions : currentAdvisory?.organic_option?.detailed_instructions}
                                      </div>
                                  </CardContent>
                              </Card>
                          </div>
                      )}

                      {activeTab === 'analysis' && (
                          <div className="space-y-6 animate-fadeIn">
                              <Card>
                                  <CardHeader><CardTitle className="text-lg">{t('rs_env_analysis', lang)}</CardTitle></CardHeader>
                                  <CardContent>
                                      <p className="text-slate-600 dark:text-slate-300">
                                          {data.environmental_analysis || "Environmental factors contributed to this issue. High humidity and temperature variance observed."}
                                      </p>
                                  </CardContent>
                              </Card>

                              {/* YouTube Section */}
                              {data.youtube_videos && data.youtube_videos.length > 0 && !data.isOffline && (
                                  <div className="space-y-3">
                                      <h3 className="font-bold text-lg text-slate-800 dark:text-white">{t('rs_related_videos', lang)}</h3>
                                      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                                          {data.youtube_videos.map((vid, idx) => (
                                              <div key={idx} onClick={() => handleVideoClick(vid.url)} className="min-w-[200px] cursor-pointer group">
                                                  <div className="relative aspect-video rounded-lg overflow-hidden mb-2 bg-black">
                                                      <img src={vid.thumbnail} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"/>
                                                      <div className="absolute inset-0 flex items-center justify-center">
                                                          <div className="w-8 h-8 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">▶</div>
                                                      </div>
                                                  </div>
                                                  <p className="text-xs font-bold line-clamp-2">{vid.title}</p>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              )}
                              
                              {config.showCouncilLog && data.debate_transcript && !data.isOffline && (
                                  <div className="mt-4">
                                      <button className="text-xs text-blue-500 underline" onClick={() => alert(data.debate_transcript)}>{t('rs_view_logs', lang)}</button>
                                  </div>
                              )}
                          </div>
                      )}

                      {activeTab === 'market' && (
                          <div className="space-y-6 animate-fadeIn">
                              <Card>
                                  <CardHeader>
                                      <CardTitle className="text-lg">{data.crop_identified} {t('rs_trends', lang)}</CardTitle>
                                      <p className="text-sm text-slate-500">{t('rs_price_history', lang)}</p>
                                  </CardHeader>
                                  <CardContent>
                                      <div className="h-64 w-full">
                                          <canvas ref={chartRef}></canvas>
                                      </div>
                                  </CardContent>
                              </Card>
                              {cropMarketData && (
                                  <div className="grid grid-cols-2 gap-4">
                                      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl text-center border border-green-100 dark:border-green-800">
                                          <span className="text-xs text-green-700 dark:text-green-300 font-bold uppercase">{t('rs_curr_price', lang)}</span>
                                          <p className="text-2xl font-black text-green-800 dark:text-green-200 mt-1">{cropMarketData.price}</p>
                                      </div>
                                      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-center border border-slate-100 dark:border-slate-700">
                                          <span className="text-xs text-slate-500 uppercase font-bold">{t('rs_mandi', lang)}</span>
                                          <p className="text-lg font-bold text-slate-700 dark:text-slate-300 mt-1">{cropMarketData.mandi || "Local"}</p>
                                      </div>
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
              </div>
          </div>

          {/* BUY LINKS - BOTTOM SECTION */}
          {activeTab === 'treatment' && buyLinks.length > 0 && !data.isOffline && (
              <div className="p-4 md:p-6 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 mt-4">
                  <div className="max-w-7xl mx-auto">
                      <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                          <span>🛒</span> {t('rs_buy_rec', lang)}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {buyLinks.map((link, i) => (
                              <a key={i} href={link.uri} target="_blank" rel="noreferrer" className="flex items-center gap-4 p-4 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800 rounded-xl hover:shadow-md transition-all group">
                                  <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 transition-transform">
                                      {link.source === 'Amazon' ? '📦' : link.source === 'Flipkart' ? '🛍️' : '🛒'}
                                  </div>
                                  <div>
                                      <h4 className="font-bold text-slate-800 dark:text-white group-hover:text-orange-600 transition-colors line-clamp-1">{link.title}</h4>
                                      <p className="text-xs text-slate-500">{t('rs_avail_on', lang)} {link.source}</p>
                                  </div>
                                  <div className="ml-auto bg-white dark:bg-slate-800 px-3 py-1 rounded-full text-xs font-bold shadow-sm">{t('rs_view', lang)}</div>
                              </a>
                          ))}
                      </div>
                  </div>
              </div>
          )}
          
          <div className="h-20 md:h-0"></div>
      </main>

      {/* Floating Chat Button */}
      {!data.isOffline && (
          <button 
            onClick={() => setShowChatModal(true)}
            // Changed bottom-6 to bottom-24 md:bottom-6 to clear the mobile navigation bar
            className="fixed bottom-24 md:bottom-6 right-6 w-14 h-14 bg-green-600 hover:bg-green-500 text-white rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110 z-30 animate-bounce-in"
          >
              <span className="text-2xl">💬</span>
          </button>
      )}

    </div>
  );
};
