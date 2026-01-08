import React, { useState, useEffect, useRef } from 'react';
import { User, Language, CropRecommendation, DetailedCropPlan, SoilAnalysisResponse, MarketItem, WeatherContext, StoreLocation, CropStage } from '../types';
import { generateCropRecommendations, generateDetailedCropPlan, searchYoutubeVideos, generateVeoVideo, askDiseaseFollowUpStream, transcribeUserAudio } from '../services/geminiService';
import { getUserDiagnoses, getRealMarketPrices, reverseGeocode, saveCropPlan, getUserCropPlans, getVerifiedShops } from '../services/agroService';
import { translateCropPlan } from '../services/dashboardTranslationService';
import { getLocalWeather } from '../services/weatherService';
import { t } from '../services/translationService';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input } from './ui/Shadcn';
import { LoadingScreen } from './ui/LoadingScreen';
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from './ui/Conversation';
import { VoiceButton, VoiceButtonState } from './ui/VoiceButton';
import { Skeleton } from './ui/Skeleton';
import { useMinimumLoading } from '../hooks/useMinimumLoading';

interface CropPlannerScreenProps {
    user: User | null;
    lang: Language;
    onBack: () => void;
    onScan?: () => void;
    targetPlanId?: string | null; // Added targetPlanId prop
}

export const CropPlannerScreen: React.FC<CropPlannerScreenProps> = ({ user, lang, onBack, onScan, targetPlanId }) => {
    // Views: 'dashboard' | 'wizard_input' | 'wizard_results' | 'report'
    const [view, setView] = useState<'dashboard' | 'wizard_input' | 'wizard_results' | 'report'>('dashboard');
    const [activePlans, setActivePlans] = useState<DetailedCropPlan[]>([]);
    
    const [loadingPlans, setLoadingPlans] = useState(true);
    const showPlanSkeleton = useMinimumLoading(loadingPlans, 1500);

    // Inputs
    const [landSize, setLandSize] = useState<number>(user?.land_size || 1);
    const [waterSource, setWaterSource] = useState(user?.water_source || 'Rainfed');
    const [selectedSoilReport, setSelectedSoilReport] = useState<SoilAnalysisResponse | null>(null);
    const [soilReports, setSoilReports] = useState<SoilAnalysisResponse[]>([]);
    const [liveLocation, setLiveLocation] = useState<{lat: number, lon: number, name: string} | null>(null);
    const [liveWeather, setLiveWeather] = useState<WeatherContext | null>(null);
    const [locLoading, setLocLoading] = useState(true);
    const [planStartDate, setPlanStartDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // Data
    const [recommendations, setRecommendations] = useState<CropRecommendation[]>([]);
    const [selectedPlan, setSelectedPlan] = useState<DetailedCropPlan | null>(null);
    const [displayPlan, setDisplayPlan] = useState<DetailedCropPlan | null>(null); // For translated display
    const [loadingMsg, setLoadingMsg] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Video State
    const [generatingVideoForStage, setGeneratingVideoForStage] = useState<string | null>(null);
    const [videoProgress, setVideoProgress] = useState("");

    // Chat
    const [showStageChat, setShowStageChat] = useState<string | null>(null);
    const [stageChatMessages, setStageChatMessages] = useState<Record<string, {role: 'user' | 'model', text: string}[]>>({});
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [chatVoiceState, setChatVoiceState] = useState<VoiceButtonState>('idle');
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<BlobPart[]>([]);

    // --- INITIALIZATION ---
    useEffect(() => {
        const init = async () => {
            if (user) {
                setLoadingPlans(true);
                const plans = await getUserCropPlans(user.id);
                setActivePlans(plans);
                
                // Deep Link Logic: If targetPlanId is provided, open that plan
                if (targetPlanId) {
                    const target = plans.find(p => p.id === targetPlanId);
                    if (target) {
                        setSelectedPlan(target);
                        setView('report');
                    }
                }

                getUserDiagnoses(user.id, 20).then(history => {
                    const soils = history.filter(h => 'soilType' in h) as SoilAnalysisResponse[];
                    setSoilReports(soils);
                    if (soils.length > 0) setSelectedSoilReport(soils[0]);
                });
                setLoadingPlans(false);
            }
        };
        init();
    }, [user, targetPlanId]);

    // --- TRANSLATION EFFECT ---
    useEffect(() => {
        const updateDisplayPlan = async () => {
            if (selectedPlan) {
                // If language matches generation language, use direct
                if (selectedPlan.language === lang || lang === 'en') {
                    setDisplayPlan(selectedPlan);
                } else {
                    // Translate on the fly
                    const translated = await translateCropPlan(selectedPlan, lang);
                    setDisplayPlan(translated);
                }
            }
        };
        updateDisplayPlan();
    }, [selectedPlan, lang]);

    // --- UTILS ---
    const calculateStageDates = (plan: DetailedCropPlan, userStartDate: string) => {
        const start = new Date(userStartDate);
        let currentOffset = 0;

        return plan.stages.map(stage => {
            const dayRange = stage.approxDays.match(/(\d+)/g);
            let duration = 10;
            if (dayRange && dayRange.length >= 2) {
                duration = parseInt(dayRange[1]) - parseInt(dayRange[0]);
            } else if (dayRange && dayRange.length === 1) {
                duration = parseInt(dayRange[0]);
            }

            const stageStart = new Date(start);
            stageStart.setDate(start.getDate() + currentOffset);
            
            const stageEnd = new Date(stageStart);
            stageEnd.setDate(stageStart.getDate() + duration);

            currentOffset += duration;

            return {
                ...stage,
                startDate: stageStart.toISOString(),
                endDate: stageEnd.toISOString(),
                status: stage.status || 'pending'
            };
        });
    };

    const startWizard = () => {
        setView('wizard_input');
        fetchLiveContext();
    };

    const fetchLiveContext = async () => {
        setLocLoading(true);
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                const { latitude, longitude } = pos.coords;
                const locData = await reverseGeocode(latitude, longitude);
                const name = locData ? `${locData.district}, ${locData.state}` : `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
                setLiveLocation({ lat: latitude, lon: longitude, name });
                
                const weather = await getLocalWeather(latitude, longitude);
                setLiveWeather(weather);
                setLocLoading(false);
            }, () => setLocLoading(false));
        } else {
            setLocLoading(false);
        }
    };

    const handleGenerateRecommendations = async () => {
        setLoadingMsg("Analyzing soil & market data...");
        setIsGenerating(true);
        
        try {
            const market = await getRealMarketPrices(liveLocation?.name.split(',')[0] || "", "");
            const recs = await generateCropRecommendations(
                selectedSoilReport,
                liveWeather?.display,
                market.slice(0, 10),
                liveLocation?.name || "India",
                landSize,
                waterSource,
                lang
            );
            setRecommendations(recs);
            setIsGenerating(false);
            setView('wizard_results');
        } catch (e) {
            setIsGenerating(false);
            alert("Analysis failed. Please try again.");
        }
    };

    const handleSelectCrop = async (crop: CropRecommendation) => {
        setLoadingMsg(`Building plan for ${crop.cropName}...`);
        setIsGenerating(true);
        
        try {
            // Pass location to fetch authorized dealers during generation
            const locCoords = liveLocation ? { lat: liveLocation.lat, lon: liveLocation.lon } : undefined;
            const rawPlan = await generateDetailedCropPlan(crop.cropName, selectedSoilReport, lang, locCoords);
            
            if (rawPlan) {
                rawPlan.startDate = new Date(planStartDate).getTime();
                rawPlan.stages = calculateStageDates(rawPlan, planStartDate);
                if(rawPlan.stages.length > 0) rawPlan.stages[0].status = 'active';
                rawPlan.variety = "High Yield Hybrid"; // Mock

                if (user) {
                    rawPlan.user_id = user.id;
                    await saveCropPlan(user.id, rawPlan); // Saves to Local Storage + DB
                    const updatedPlans = await getUserCropPlans(user.id);
                    setActivePlans(updatedPlans);
                }
                
                setSelectedPlan(rawPlan);
                setIsGenerating(false);
                setView('report');
            } else {
                throw new Error("Empty plan");
            }
        } catch (e) {
            console.error(e);
            setIsGenerating(false);
            alert("Could not build plan.");
        }
    };

    const handleStageTaskToggle = async (stageIndex: number, taskIndex: number) => {
        if (!selectedPlan || !user) return;
        const newPlan = { ...selectedPlan };
        newPlan.stages[stageIndex].tasks[taskIndex].isDone = !newPlan.stages[stageIndex].tasks[taskIndex].isDone;
        setSelectedPlan(newPlan);
        // Optimistically update display
        if (displayPlan) {
             const newDisplay = { ...displayPlan };
             newDisplay.stages[stageIndex].tasks[taskIndex].isDone = newPlan.stages[stageIndex].tasks[taskIndex].isDone;
             setDisplayPlan(newDisplay);
        }
        await saveCropPlan(user.id, newPlan);
    };

    const handleCompleteStage = async (stageIndex: number) => {
        if (!selectedPlan || !user) return;
        const newPlan = { ...selectedPlan };
        newPlan.stages[stageIndex].status = 'completed';
        if (stageIndex + 1 < newPlan.stages.length) {
            newPlan.stages[stageIndex + 1].status = 'active';
        } else {
            newPlan.status = 'Completed';
        }
        setSelectedPlan(newPlan);
        await saveCropPlan(user.id, newPlan);
    };

    const handleGenerateStageVideo = async (stageName: string, desc: string) => {
        if (!selectedPlan || !user) return;
        const currentStage = selectedPlan.stages.find(s => s.stageName === stageName);
        if (currentStage?.aiVideoUrl) return;

        setGeneratingVideoForStage(stageName);
        setVideoProgress("Initializing...");

        try {
            const prompt = `Cinematic video: ${selectedPlan.cropName} farming stage: ${stageName}. ${desc}`;
            const videoUrl = await generateVeoVideo(prompt, (msg) => setVideoProgress(msg));

            if (videoUrl) {
                const updatedPlan = {
                    ...selectedPlan,
                    stages: selectedPlan.stages.map(s => 
                        s.stageName === stageName ? { ...s, aiVideoUrl: videoUrl } : s
                    )
                };
                setSelectedPlan(updatedPlan);
                await saveCropPlan(user.id, updatedPlan);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setGeneratingVideoForStage(null);
        }
    };

    const handleStageChatSubmit = async (e?: React.FormEvent, textOverride?: string) => {
        if (e) e.preventDefault();
        const text = textOverride || chatInput;
        if (!text.trim() || !showStageChat || !selectedPlan) return;

        const stageName = showStageChat;
        const currentMessages = stageChatMessages[stageName] || [];
        const newMessages = [...currentMessages, { role: 'user' as const, text: text }];
        setStageChatMessages({ ...stageChatMessages, [stageName]: newMessages });
        setChatInput("");
        setChatLoading(true);

        const stage = selectedPlan.stages.find(s => s.stageName === stageName);
        const mockContext = { 
            crop_identified: selectedPlan.cropName, 
            disease_name_en: `Stage: ${stageName}`, 
            description: stage?.description,
            treatment_advisory: { summary: stage?.description || "", chemical_option: { product_name: "" }, organic_option: { product_name: "" } },
            local_language_output: lang
        } as any;

        try {
            const stream = askDiseaseFollowUpStream(mockContext, text, newMessages);
            let fullResponse = "";
            const assistantMsgIndex = newMessages.length;
            const withAiPlaceholder = [...newMessages, { role: 'model' as const, text: '' }];
            setStageChatMessages({ ...stageChatMessages, [stageName]: withAiPlaceholder });

            for await (const chunk of stream) {
                fullResponse += chunk;
                const updating = [...withAiPlaceholder];
                updating[assistantMsgIndex] = { role: 'model', text: fullResponse };
                setStageChatMessages(prev => ({ ...prev, [stageName]: updating }));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setChatLoading(false);
        }
    };

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
                                handleStageChatSubmit(undefined, text);
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

    // --- RENDERERS ---

    const renderDashboard = () => (
        <div className="min-h-full bg-slate-50 dark:bg-slate-900 pb-20">
            {/* Header */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-6 sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white">My Crops</h1>
                        <p className="text-sm text-slate-500">Manage your farm cycles</p>
                    </div>
                    <Button onClick={startWizard} className="bg-green-600 hover:bg-green-700 text-white rounded-full px-6 shadow-lg shadow-green-500/20 font-bold flex items-center gap-2">
                        <span className="text-xl">+</span> <span className="hidden sm:inline">Add Crop</span>
                    </Button>
                </div>
            </div>

            {/* List */}
            <div className="max-w-6xl mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {showPlanSkeleton ? (
                    [1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-full rounded-3xl" />)
                ) : (
                    activePlans.length === 0 ? (
                        <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl animate-fadeIn">
                            <div className="text-6xl mb-4 opacity-50">🌱</div>
                            <h3 className="font-bold text-xl text-slate-700 dark:text-slate-300">No Active Crops</h3>
                            <p className="text-slate-500 mb-6">Start your first AI-guided cultivation.</p>
                            <Button onClick={startWizard} variant="outline" className="border-green-500 text-green-600">Start Planner</Button>
                        </div>
                    ) : (
                        activePlans.map(plan => {
                            const activeStage = plan.stages.find(s => s.status === 'active') || plan.stages[plan.stages.length - 1];
                            const completedCount = plan.stages.filter(s => s.status === 'completed').length;
                            const progress = Math.round((completedCount / plan.stages.length) * 100);
                            const cropImage = `https://source.unsplash.com/800x600/?${plan.cropName.toLowerCase().split(' ')[0]},farm`;

                            return (
                                <div 
                                    key={plan.id}
                                    onClick={() => { setSelectedPlan(plan); setView('report'); }}
                                    className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all cursor-pointer group flex flex-col relative animate-fadeIn"
                                >
                                    <div className="h-48 relative overflow-hidden">
                                        <img src={cropImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={plan.cropName} />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-green-700 flex items-center gap-1 shadow-sm">
                                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Healthy
                                        </div>
                                        <div className="absolute bottom-4 left-4 text-white">
                                            <h3 className="text-2xl font-black">{plan.cropName}</h3>
                                            <p className="text-sm opacity-90 font-medium">{plan.variety || 'Hybrid Variety'}</p>
                                        </div>
                                    </div>

                                    <div className="p-5 flex-1 flex flex-col">
                                        <div className="flex justify-between items-start mb-6">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Current Stage</p>
                                                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-lg text-sm font-bold inline-block">
                                                    {activeStage?.stageName}
                                                </div>
                                            </div>
                                            <div className="relative w-14 h-14 flex items-center justify-center">
                                                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                                    <path className="text-slate-100 dark:text-slate-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                                                    <path className="text-green-500 transition-all duration-1000" strokeDasharray={`${progress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                                                </svg>
                                                <span className="absolute text-xs font-bold text-green-600 dark:text-green-400">{progress}%</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mb-6 border-t border-slate-100 dark:border-slate-700 pt-4">
                                            <div>
                                                <p className="text-[10px] text-slate-400 uppercase font-bold">Sowed On</p>
                                                <p className="text-sm font-bold text-slate-800 dark:text-white">{new Date(plan.startDate).toLocaleDateString(undefined, {day: 'numeric', month: 'short'})}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-400 uppercase font-bold">Harvest In</p>
                                                <p className="text-sm font-bold text-slate-800 dark:text-white">{plan.totalDuration}</p>
                                            </div>
                                        </div>

                                        <button className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-md shadow-green-500/20 flex items-center justify-center gap-2 mt-auto">
                                            <span>🤖</span> AI Advice
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )
                )}
            </div>
        </div>
    );

    const renderInputWizard = () => (
        <div className="min-h-full bg-slate-50 dark:bg-slate-900 pb-20">
            {isGenerating && <LoadingScreen text={loadingMsg} overlay />}
            <div className="max-w-2xl mx-auto p-6 pt-10">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => setView('dashboard')} className="p-2 hover:bg-slate-200 rounded-full dark:text-white">←</button>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white">Farm Details</h1>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-8 shadow-sm border border-slate-200 dark:border-slate-700 space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl flex items-center gap-4">
                        <div className="text-2xl">📍</div>
                        <div>
                            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">Location</p>
                            <p className="font-bold text-slate-900 dark:text-white">{locLoading ? "Locating..." : liveLocation?.name || "Select manually"}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Start Date</label>
                            <Input type="date" value={planStartDate} onChange={e => setPlanStartDate(e.target.value)} className="h-12 bg-slate-50 dark:bg-slate-900" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase">Land (Acres)</label>
                            <Input type="number" value={landSize} onChange={e => setLandSize(parseFloat(e.target.value))} className="h-12 bg-slate-50 dark:bg-slate-900" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Water Source</label>
                        <select className="w-full h-12 px-4 rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-white outline-none" value={waterSource} onChange={e => setWaterSource(e.target.value as any)}>
                            <option>Rainfed</option><option>Borewell</option><option>Canal</option><option>Drip Irrigation</option>
                        </select>
                    </div>

                    <Button onClick={handleGenerateRecommendations} className="w-full h-14 text-lg bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg shadow-green-500/20 mt-4">
                        Get Recommendations
                    </Button>
                </div>
            </div>
        </div>
    );

    const renderResultsWizard = () => (
        <div className="min-h-full bg-slate-50 dark:bg-slate-900 pb-20">
            {isGenerating && <LoadingScreen text={loadingMsg} overlay />}
            <div className="max-w-6xl mx-auto p-4 md:p-8">
                <div className="flex items-center justify-between mb-8">
                    <button onClick={() => setView('wizard_input')} className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-900">← Back</button>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white">AI Recommendations</h1>
                    <div className="w-8"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {recommendations.map((crop) => (
                        <div key={crop.id} className="bg-white dark:bg-slate-800 rounded-[2rem] overflow-hidden shadow-md border border-slate-200 dark:border-slate-700 hover:shadow-xl transition-all flex flex-col relative group">
                            <div className="h-40 bg-slate-200 relative">
                                <img src={`https://source.unsplash.com/400x300/?${crop.cropName.split(' ')[0]},crop`} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                <div className="absolute top-4 right-4 bg-white text-green-700 px-3 py-1 rounded-full text-xs font-black shadow-sm flex items-center gap-1">
                                    <span className="text-green-500">●</span> {crop.suitabilityScore}% Match
                                </div>
                                <div className="absolute bottom-4 left-4 text-white">
                                    <h3 className="text-2xl font-black">{crop.cropName}</h3>
                                    <Badge className={`${crop.category === 'Best' ? 'bg-green-500' : 'bg-yellow-500'} text-white border-none`}>{crop.category}</Badge>
                                </div>
                            </div>
                            
                            <div className="p-6 flex-1 flex flex-col">
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div><p className="text-[10px] uppercase font-bold text-slate-400">Est. Profit</p><p className="font-bold text-slate-800 dark:text-white text-lg">{crop.estimatedIncome}</p></div>
                                    <div><p className="text-[10px] uppercase font-bold text-slate-400">Duration</p><p className="font-bold text-slate-800 dark:text-white text-lg">{crop.durationMonths * 30} Days</p></div>
                                    <div><p className="text-[10px] uppercase font-bold text-slate-400">Risk</p><p className="font-bold text-slate-800 dark:text-white text-sm">{crop.riskFactors[0]?.split(' ')[0] || 'Low'}</p></div>
                                    <div><p className="text-[10px] uppercase font-bold text-slate-400">Water</p><div className="flex text-blue-500 text-xs">💧💧💧</div></div>
                                </div>
                                
                                <p className="text-xs text-slate-500 mb-6 italic">"{crop.reasoning}"</p>

                                <button onClick={() => handleSelectCrop(crop)} className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-bold rounded-xl mt-auto transition-colors">
                                    View Detailed Plan
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderPlanReport = () => {
        if (!displayPlan) return null;
        
        const activeStageIndex = displayPlan.stages.findIndex(s => s.status === 'active');
        const activeStage = displayPlan.stages[activeStageIndex >= 0 ? activeStageIndex : displayPlan.stages.length - 1];
        // Use saved dealers from plan
        const dealers = displayPlan.savedDealers || [];

        return (
            <div className="bg-slate-50 dark:bg-slate-900 h-full overflow-y-auto custom-scrollbar pb-24">
                {/* Sticky Header with Actions */}
                <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-30 shadow-sm">
                    <div className="max-w-6xl mx-auto">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setView('dashboard')} className="p-2 hover:bg-slate-100 rounded-full dark:text-white">←</button>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white">{displayPlan.cropName} Plan</h2>
                                    <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded">✓ AI Generated & Saved</span>
                                </div>
                            </div>
                            
                            {/* Top Action Buttons */}
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => onScan && onScan()}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity shadow-sm"
                                >
                                    <span>📸</span> Scan Crop
                                </button>
                                <button 
                                    onClick={() => setShowStageChat(activeStage?.stageName || "General")}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    <span>💬</span> Dr. AI Chat
                                </button>
                            </div>
                        </div>

                        {/* Interactive Horizontal Timeline */}
                        <div className="relative px-2 overflow-x-auto no-scrollbar pb-2 pt-2">
                            <div className="flex justify-between min-w-[600px] relative z-10 px-4">
                                {/* Connecting Line */}
                                <div className="absolute top-4 left-0 w-full h-1 bg-slate-200 dark:bg-slate-700 -z-10 rounded-full"></div>
                                <div className="absolute top-4 left-0 h-1 bg-green-500 -z-10 rounded-full transition-all duration-1000" style={{ width: `${((activeStageIndex + 1) / displayPlan.stages.length) * 100}%` }}></div>
                                
                                {displayPlan.stages.map((stage, idx) => {
                                    const isActive = stage.status === 'active';
                                    const isDone = stage.status === 'completed';
                                    return (
                                        <div key={idx} className="flex flex-col items-center gap-3 cursor-pointer group" onClick={() => {/* Optional: jump to stage view */}}>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 transition-all duration-300 ${isActive ? 'bg-white border-green-600 text-green-600 scale-125 shadow-lg shadow-green-500/20' : isDone ? 'bg-green-50 border-green-500 text-white' : 'bg-slate-50 border-slate-300 text-slate-400'}`}>
                                                {isDone ? '✓' : idx + 1}
                                            </div>
                                            <span className={`text-[10px] font-bold uppercase whitespace-nowrap px-2 py-1 rounded-full transition-colors ${isActive ? 'bg-green-100 text-green-800' : 'text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}`}>{stage.stageName}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
                    {activeStage && (
                        <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-700 animate-fadeIn">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <div className="flex gap-2 mb-2">
                                        <Badge className="bg-green-600 text-white hover:bg-green-700">Active Phase</Badge>
                                        <Badge variant="outline">{activeStage.approxDays}</Badge>
                                    </div>
                                    <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-2">{activeStage.stageName}</h3>
                                    <p className="text-slate-500 max-w-xl text-sm leading-relaxed">{activeStage.description}</p>
                                </div>
                                <div className="text-right hidden sm:block">
                                    <div className="text-sm font-bold text-slate-500 uppercase">Progress</div>
                                    <div className="text-4xl font-black text-green-600">Day 12 <span className="text-lg text-slate-400">/ 20</span></div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* MAIN CONTENT */}
                                <div className="lg:col-span-2 space-y-6">
                                    
                                    {/* TASKS */}
                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2"><span>✅</span> Tasks Checklist</h4>
                                            <span className="text-xs font-bold bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-400">{activeStage.tasks.filter(t => !t.isDone).length} Pending</span>
                                        </div>
                                        <div className="space-y-3">
                                            {activeStage.tasks.map((task, tIdx) => (
                                                <div key={tIdx} className={`flex items-center gap-4 p-4 rounded-2xl transition-all border cursor-pointer hover:bg-white dark:hover:bg-slate-800 ${task.isDone ? 'bg-green-50 border-green-100 opacity-60' : 'bg-white border-slate-100 shadow-sm'}`} onClick={() => handleStageTaskToggle(activeStageIndex, tIdx)}>
                                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${task.isDone ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300'}`}>
                                                        {task.isDone && '✓'}
                                                    </div>
                                                    <span className={`flex-1 font-medium text-sm ${task.isDone ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>{task.task}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <button onClick={() => handleCompleteStage(activeStageIndex)} className="w-full mt-6 py-4 bg-white border-2 border-green-100 text-green-700 font-bold rounded-2xl hover:bg-green-50 transition-colors">Mark Phase Complete →</button>
                                    </div>

                                    {/* VIDEO GUIDES (CAROUSEL) */}
                                    <div>
                                        <h4 className="font-bold text-lg text-slate-800 dark:text-white mb-4 flex items-center gap-2"><span>📺</span> Video Guides ({activeStage.videos?.length || 0})</h4>
                                        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x">
                                            {/* AI Veo Generation Card */}
                                            <div className="min-w-[280px] snap-center aspect-video bg-black rounded-2xl overflow-hidden relative group border border-slate-800">
                                                {activeStage.aiVideoUrl ? (
                                                    <video src={activeStage.aiVideoUrl} className="w-full h-full object-cover" controls />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-center p-4">
                                                        {generatingVideoForStage === activeStage.stageName ? (
                                                            <div className="text-white text-xs animate-pulse">{videoProgress}</div>
                                                        ) : (
                                                            <button onClick={() => handleGenerateStageVideo(activeStage.stageName, activeStage.description)} className="flex flex-col items-center gap-2 group-hover:scale-105 transition-transform">
                                                                <span className="text-3xl">✨</span>
                                                                <span className="text-xs font-bold text-white">Generate AI Guide</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="absolute top-2 left-2 bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">AI Gen</div>
                                            </div>

                                            {/* YouTube Videos */}
                                            {activeStage.videos && activeStage.videos.length > 0 ? (
                                                activeStage.videos.map((video, idx) => (
                                                    <a key={idx} href={video.url} target="_blank" className="min-w-[280px] snap-center aspect-video bg-black rounded-2xl overflow-hidden relative group block shadow-md hover:shadow-xl transition-all">
                                                        <img src={video.thumbnail} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                                        <div className="absolute inset-0 flex items-center justify-center"><div className="w-12 h-12 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-white scale-90 group-hover:scale-110 transition-transform">▶</div></div>
                                                        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                                                            <div className="text-xs font-bold text-white truncate">{video.title}</div>
                                                        </div>
                                                    </a>
                                                ))
                                            ) : (
                                                <div className="min-w-[280px] aspect-video bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 text-sm">No Videos Found</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* HEALTH CHECK (Active Logic) */}
                                    <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-3xl border border-blue-100 dark:border-blue-800">
                                        <h4 className="font-bold text-lg text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2"><span>🏥</span> Health Check</h4>
                                        <div className="bg-white/60 p-4 rounded-2xl mb-4">
                                            <p className="font-bold text-slate-800 text-sm">Do you see any yellowing or spots on leaves?</p>
                                            <p className="text-xs text-slate-500 mt-1">Regular monitoring prevents disease spread.</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => {
                                                    // Trigger Chat with context
                                                    setChatInput("I see yellow spots on my leaves. Is this a deficiency?");
                                                    setShowStageChat(activeStage.stageName);
                                                }}
                                                className="flex-1 py-3 bg-red-50 text-red-600 shadow-sm border border-red-100 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors"
                                            >
                                                Yes, I see issues
                                            </button>
                                            <button className="flex-1 py-3 bg-white text-green-600 shadow-sm border border-green-100 rounded-xl font-bold text-sm hover:bg-green-50 transition-colors">No, Crop is Healthy</button>
                                        </div>
                                    </div>
                                </div>

                                {/* SIDEBAR */}
                                <div className="space-y-6">
                                    {/* RISKS */}
                                    <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-[2rem] border border-red-100 dark:border-red-800">
                                        <h4 className="font-bold text-lg text-red-800 dark:text-red-300 mb-4 flex items-center gap-2"><span>⚠️</span> Risks</h4>
                                        <div className="space-y-3">
                                            {activeStage.risks && activeStage.risks.length > 0 ? activeStage.risks.map((risk, rIdx) => (
                                                <div key={rIdx} className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-red-500">
                                                    <div className="flex justify-between mb-1"><span className="font-bold text-sm text-red-700">{risk}</span><span className="text-[10px] font-bold bg-red-100 text-red-800 px-2 py-0.5 rounded-full">High</span></div>
                                                    <p className="text-xs text-slate-500">Monitor closely for signs.</p>
                                                </div>
                                            )) : (
                                                <div className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-orange-500">
                                                    <div className="flex justify-between mb-1"><span className="font-bold text-sm text-orange-700">General Pests</span><span className="text-[10px] font-bold bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">Med</span></div>
                                                    <p className="text-xs text-slate-500">Check undersides of leaves.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* DEALERS (Dynamic & Clickable) */}
                                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200">
                                        <h4 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2"><span>🛒</span> Auth. Dealers</h4>
                                        <div className="space-y-3">
                                            {dealers.length > 0 ? dealers.slice(0, 3).map((shop, i) => (
                                                <a 
                                                    key={i} 
                                                    href={shop.uri} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="flex gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer group"
                                                >
                                                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">🏢</div>
                                                    <div className="min-w-0 flex-1">
                                                        <h5 className="font-bold text-sm text-slate-900 truncate group-hover:text-blue-600 transition-colors">{shop.name}</h5>
                                                        <p className="text-xs text-slate-500 truncate">{shop.address}</p>
                                                        {shop.verified && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">Verified</span>}
                                                    </div>
                                                    <div className="flex items-center text-slate-300">→</div>
                                                </a>
                                            )) : (
                                                <p className="text-xs text-slate-400 text-center">Loading authorized dealers...</p>
                                            )}
                                        </div>
                                        <button className="w-full mt-4 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-50">View All</button>
                                    </div>

                                    <button 
                                        onClick={() => setShowStageChat(activeStage.stageName)}
                                        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 hover:scale-105 transition-transform"
                                    >
                                        <span className="text-2xl">💬</span> Ask Dr. AI
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Chat Modal */}
                <Dialog open={!!showStageChat}>
                    <DialogContent className="max-w-md h-[500px] flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                        <div className="p-4 bg-blue-600 text-white flex justify-between items-center">
                            <div><h3 className="font-bold text-sm">Dr. AI - {showStageChat} Specialist</h3></div>
                            <button onClick={() => setShowStageChat(null)} className="p-1 hover:bg-white/20 rounded-full">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4">
                            <Conversation>
                                <ConversationContent>
                                    <ConversationEmptyState title="Ask Questions" description={`About ${showStageChat}`} />
                                    {showStageChat && stageChatMessages[showStageChat]?.map((msg, i) => (
                                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white border'}`}>
                                                {msg.text || <span className="animate-pulse">...</span>}
                                            </div>
                                        </div>
                                    ))}
                                </ConversationContent>
                                <ConversationScrollButton />
                            </Conversation>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-900 border-t flex gap-2">
                            <input className="flex-1 bg-slate-100 px-4 py-2 rounded-full text-sm outline-none" placeholder="Ask..." value={chatInput} onChange={e => setChatInput(e.target.value)} disabled={chatLoading} />
                            <VoiceButton state={chatVoiceState} onPress={handleChatVoicePress} icon={<span>🎤</span>} className="w-10 h-10 rounded-full" size="icon" />
                            <button onClick={() => handleStageChatSubmit()} disabled={chatLoading} className="p-2 bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center">➤</button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-y-auto custom-scrollbar">
            {view === 'dashboard' && renderDashboard()}
            {view === 'wizard_input' && renderInputWizard()}
            {view === 'wizard_results' && renderResultsWizard()}
            {view === 'report' && renderPlanReport()}
        </div>
    );
};