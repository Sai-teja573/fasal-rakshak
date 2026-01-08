import Chart from 'chart.js/auto';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useMinimumLoading } from '../hooks/useMinimumLoading';
import { createCommunityPost, getAgroStateNews, getCommunityFeed, getGovernmentSchemes, getRealMarketPrices, getUserCropPlans, getUserDiagnoses, reverseGeocode } from '../services/agroService';
import { getDisasterAlerts } from '../services/alertService';
import { translateGenericData, translateNewsData, translateSchemesData, translateSingleNewsContent } from '../services/dashboardTranslationService';
import { AudioPlayer } from '../services/geminiService';
import { t } from '../services/translationService';
import { getLocalWeather } from '../services/weatherService';
import { CommunityPost, DetailedCropPlan, DiagnosisResponse, DisasterAlert, FarmingGuide, Language, MarketItem, NearbyAlert, NewsItem, NotificationItem, Scheme, SoilAnalysisResponse, User } from '../types';
import { NotificationCenter } from './ui/NotificationCenter';
import { Badge, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Textarea } from './ui/Shadcn';
import { Skeleton } from './ui/Skeleton';

interface AgroHubScreenProps {
    user: User | null;
    lang: Language;
    onUserUpdate?: (user: User) => void;
    onLoginRequest?: () => void;
    onNavigateToDiagnosis?: () => void;
    onNavigateToHistory?: () => void;
    onNavigateToCropPlanner?: (planId?: string) => void;
    onNavigateToSoilLab?: () => void;
    onNavigateToChat?: () => void;
    onNavigateToTransport?: () => void;
    onOpenReport?: (item: DiagnosisResponse | SoilAnalysisResponse) => void;
}

type Tab = 'dashboard' | 'market' | 'community' | 'schemes' | 'knowledge';
type TimeRange = '1D' | '1W' | '1M' | '1Y';

const generateHistory = (currentPriceStr: string, range: TimeRange) => {
    const basePrice = parseFloat(currentPriceStr.replace(/[^\d.]/g, '')) || 2000;
    const points = range === '1D' ? 12 : range === '1W' ? 7 : range === '1M' ? 30 : 12;
    const prices = [];
    const labels = [];
    let volatility = 0;
    
    switch(range) {
        case '1D': volatility = 0.02; break;
        case '1W': volatility = 0.05; break;
        case '1M': volatility = 0.10; break;
        case '1Y': volatility = 0.20; break;
    }

    for (let i = points - 1; i >= 0; i--) {
        const d = new Date();
        if (range === '1D') d.setHours(d.getHours() - i * 2);
        else if (range === '1Y') d.setMonth(d.getMonth() - i);
        else d.setDate(d.getDate() - i);
        
        labels.push(range === '1D' ? d.toLocaleTimeString([], {hour: '2-digit'}) : d.toLocaleDateString([], {day:'numeric', month:'short'}));
        
        const noise = (Math.random() - 0.5) * (basePrice * volatility);
        prices.push(Math.round(basePrice + noise));
    }
    // Ensure last point is current price
    prices[prices.length-1] = basePrice;
    
    return { labels, prices };
};

const NewsReader = ({ news, initialIndex, onClose, lang }: { news: NewsItem[], initialIndex: number, onClose: () => void, lang: Language }) => {
    const [index, setIndex] = useState(initialIndex);
    
    return (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col">
            <div className="absolute top-4 right-4 z-50">
                <button onClick={onClose} className="p-2 bg-white/20 backdrop-blur rounded-full text-white">✕</button>
            </div>
            <div className="flex-1 relative flex items-center justify-center">
                <div className="w-full h-full max-w-md relative">
                    <img src={news[index].image_url || `https://source.unsplash.com/800x1200/?agriculture,${news[index].tags[0]}`} className="w-full h-full object-cover opacity-60" />
                    <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black via-black/80 to-transparent pt-32">
                        <span className="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full mb-3 inline-block">
                            {news[index].source}
                        </span>
                        <h2 className="text-2xl font-bold text-white mb-4 leading-tight">{news[index].title}</h2>
                        <p className="text-slate-200 text-sm leading-relaxed mb-6 line-clamp-6">{news[index].full_content || news[index].summary}</p>
                        <a href={news[index].url} target="_blank" className="block w-full py-3 bg-white text-black font-bold text-center rounded-xl">Read Full Article</a>
                    </div>
                </div>
            </div>
            {/* Controls */}
            <div className="absolute top-1/2 left-4 z-50">
                <button disabled={index===0} onClick={() => setIndex(i => i-1)} className="p-3 bg-white/10 backdrop-blur rounded-full text-white disabled:opacity-30">←</button>
            </div>
            <div className="absolute top-1/2 right-4 z-50">
                <button disabled={index===news.length-1} onClick={() => setIndex(i => i+1)} className="p-3 bg-white/10 backdrop-blur rounded-full text-white disabled:opacity-30">→</button>
            </div>
        </div>
    );
};

export const AgroHubScreen: React.FC<AgroHubScreenProps> = ({ user, lang, onUserUpdate, onLoginRequest, onNavigateToDiagnosis, onNavigateToHistory, onNavigateToCropPlanner, onNavigateToSoilLab, onNavigateToChat, onNavigateToTransport, onOpenReport }) => {
    const [isPending, startTransition] = useTransition();
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');
    
    // Data State
    const [rawNews, setRawNews] = useState<NewsItem[] | null>(null);
    const [rawSchemes, setRawSchemes] = useState<Scheme[] | null>(null);
    const [rawSummary, setRawSummary] = useState<any>(null);
    const [rawDisasterAlerts, setRawDisasterAlerts] = useState<DisasterAlert[]>([]);
    
    const [weatherData, setWeatherData] = useState<any>(null);
    const [marketData, setMarketData] = useState<MarketItem[] | null>(null);
    const [newsData, setNewsData] = useState<NewsItem[] | null>(null);
    const [schemesData, setSchemesData] = useState<Scheme[] | null>(null);
    const [aiSummary, setAiSummary] = useState<any>(null);
    const [locationInfo, setLocationInfo] = useState<{district: string, state: string} | null>(null);

    const [activePlans, setActivePlans] = useState<DetailedCropPlan[]>([]);
    const [posts, setPosts] = useState<CommunityPost[]>([]);
    const [guides, setGuides] = useState<FarmingGuide[] | null>(null); 
    const [alerts, setAlerts] = useState<NearbyAlert[]>([]);
    const [disasterAlerts, setDisasterAlerts] = useState<DisasterAlert[]>([]);
    const [recentScans, setRecentScans] = useState<(DiagnosisResponse | SoilAnalysisResponse)[]>([]);
    
    // Alert Filtering
    const [newAlerts, setNewAlerts] = useState<DisasterAlert[]>([]);
    const [seenAlerts, setSeenAlerts] = useState<DisasterAlert[]>([]);
    
    const [marketGraphSelection, setMarketGraphSelection] = useState<string>('All');
    const [graphTimeRange, setGraphTimeRange] = useState<TimeRange>('1M'); 
    
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);

    const [guestLocation, setGuestLocation] = useState<{lat: number, lon: number} | null>(null);

    const [showPostModal, setShowPostModal] = useState(false);
    const [postContent, setPostContent] = useState("");
    const [postMedia, setPostMedia] = useState<File[]>([]);
    const [postMediaPreviews, setPostMediaPreviews] = useState<string[]>([]);
    
    const [selectedContent, setSelectedContent] = useState<any | null>(null);
    const [contentType, setContentType] = useState<'news' | 'scheme' | 'guide' | null>(null);
    const [viewingNewsIndex, setViewingNewsIndex] = useState<number | null>(null);

    // WEATHER SWIPE LOGIC
    const [activeWeatherIndex, setActiveWeatherIndex] = useState(0); 
    const [weatherHistoryList, setWeatherHistoryList] = useState<any[]>([]);

    // 2G / Low Bandwidth Optimization
    const [isLowBandwidth, setIsLowBandwidth] = useState(false);
    const [networkError, setNetworkError] = useState<string | null>(null);

    // Initial Data Loading State for Skeletons
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const showSkeleton = useMinimumLoading(isInitialLoad, 1000);

    const audioPlayerRef = useRef<AudioPlayer | null>(null);
    const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
    
    const marketChartRef = useRef<HTMLCanvasElement>(null);
    const postFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        audioPlayerRef.current = new AudioPlayer();
        notificationAudioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        notificationAudioRef.current.volume = 0.8;
        if ('Notification' in window && Notification.permission !== 'granted') Notification.requestPermission();
        
        // Detect Low Bandwidth
        const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
        if (connection) {
            const checkConnection = () => {
                const type = connection.effectiveType;
                setIsLowBandwidth(type === 'slow-2g' || type === '2g' || connection.saveData);
            };
            checkConnection();
            connection.addEventListener('change', checkConnection);
            return () => {
                connection.removeEventListener('change', checkConnection);
                audioPlayerRef.current?.stop();
            };
        }
        
        return () => audioPlayerRef.current?.stop();
    }, []);

    // --- CHECK FOR TASKS & ALERTS ---
    useEffect(() => {
        if (activePlans.length > 0) {
            const newNotifs: NotificationItem[] = [];
            activePlans.forEach(plan => {
                const activeStage = plan.stages.find(s => s.status === 'active');
                if (activeStage) {
                    const pendingTasks = activeStage.tasks.filter(t => !t.isDone);
                    if (pendingTasks.length > 0) {
                        newNotifs.push({
                            id: `task-${plan.id}-${activeStage.stageName}`,
                            title: `Task Due: ${plan.cropName}`,
                            message: `Complete ${pendingTasks.length} tasks in '${activeStage.stageName}' phase.`,
                            type: 'reminder',
                            severity: 'info',
                            timestamp: Date.now(),
                            read: false,
                            actionLabel: 'View Plan',
                            actionLink: 'crop_planner'
                        });
                    }
                }
            });
            setNotifications(prev => {
                const unique = [...prev];
                newNotifs.forEach(n => {
                    if (!unique.find(existing => existing.id === n.id)) {
                        unique.unshift(n);
                    }
                });
                return unique;
            });
        }
    }, [activePlans]);

    // --- LAZY TRANSLATION LOGIC ---
    useEffect(() => {
        const translateVisibleContent = async () => {
            if (lang === 'en') {
                if (rawNews && newsData !== rawNews) setNewsData(rawNews);
                if (rawSchemes && schemesData !== rawSchemes) setSchemesData(rawSchemes);
                if (rawSummary && rawSummary !== null) setAiSummary(rawSummary);
                if (rawDisasterAlerts && disasterAlerts !== rawDisasterAlerts) setDisasterAlerts(rawDisasterAlerts);
                return;
            }

            if (activeTab === 'dashboard') {
                if (rawNews) translateNewsData(rawNews, lang).then(setNewsData);
                if (rawDisasterAlerts.length > 0) translateGenericData(rawDisasterAlerts, lang).then(setDisasterAlerts);
                if (rawSchemes) translateSchemesData(rawSchemes, lang).then(setSchemesData); 
            }
            if (activeTab === 'schemes' && rawSchemes) translateSchemesData(rawSchemes, lang).then(setSchemesData);
        };
        translateVisibleContent();
    }, [lang, activeTab, rawNews, rawSchemes, rawSummary, rawDisasterAlerts]);

    const effectiveUser = user;

    // --- CHART LOGIC FOR DASHBOARD ---
    useEffect(() => {
        let chartInstance: Chart | null = null;

        if (activeTab === 'dashboard' && marketData && marketData.length > 0 && marketChartRef.current && !showSkeleton) {
             const ctx = marketChartRef.current.getContext('2d');
             if (ctx) {
                 const existingChart = Chart.getChart(marketChartRef.current);
                 if (existingChart) existingChart.destroy();

                 const uniqueCropsMap = new Map<string, MarketItem>();
                 marketData.forEach(item => {
                     const key = item.crop.trim();
                     if (!uniqueCropsMap.has(key)) uniqueCropsMap.set(key, item);
                 });
                 const uniqueMarketItems = Array.from(uniqueCropsMap.values());
                 
                 let cropsToPlot: MarketItem[] = [];
                 if (marketGraphSelection === 'All') {
                     const userCrops = user?.crops_grown || [];
                     const preferred = uniqueMarketItems.filter(m => userCrops.some(uc => m.crop.toLowerCase().includes(uc.toLowerCase())));
                     const others = uniqueMarketItems.filter(m => !userCrops.some(uc => m.crop.toLowerCase().includes(uc.toLowerCase())));
                     cropsToPlot = [...preferred, ...others].slice(0, 5);
                 } else {
                     cropsToPlot = uniqueMarketItems.filter(c => c.crop === marketGraphSelection);
                 }

                 const colors = ['#16a34a', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#db2777'];
                 
                 const { labels } = generateHistory("0", graphTimeRange);

                 const datasets = cropsToPlot.map((m, i) => {
                     const { prices } = generateHistory(m.price, graphTimeRange);
                     const color = colors[i % colors.length];
                     const isSingle = cropsToPlot.length === 1;

                     return {
                         label: m.crop,
                         data: prices,
                         borderColor: color,
                         backgroundColor: isSingle ? color + '20' : 'transparent',
                         fill: isSingle,
                         borderWidth: 2,
                         tension: 0.4,
                         pointRadius: 0,
                         pointHoverRadius: 4
                     };
                 });

                 const isDark = document.documentElement.classList.contains('dark');
                 const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
                 const textColor = isDark ? '#94a3b8' : '#64748b';

                 chartInstance = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: datasets
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { 
                            legend: { display: true, position: 'top', align: 'end', labels: { boxWidth: 8, font: { size: 10 }, usePointStyle: true, color: textColor } },
                            tooltip: { mode: 'index', intersect: false, backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)', titleColor: isDark ? '#fff' : '#0f172a', bodyColor: isDark ? '#fff' : '#0f172a', borderColor: gridColor, borderWidth: 1 }
                        },
                        scales: { 
                            x: { display: true, grid: { display: false }, ticks: { maxTicksLimit: 6, font: { size: 10 }, color: textColor } }, 
                            y: { display: true, position: 'right', grid: { color: gridColor }, ticks: { callback: (val) => '₹' + val, font: { size: 10 }, color: textColor } } 
                        },
                        interaction: { mode: 'nearest', axis: 'x', intersect: false }
                    }
                 });
             }
        }

        return () => { if (chartInstance) chartInstance.destroy(); };
    }, [activeTab, marketData, marketGraphSelection, graphTimeRange, user, showSkeleton]);

    // PROGRESSIVE LOADER with Retry Logic
    useEffect(() => {
        const load = async () => {
            if (!effectiveUser) return;
            setNetworkError(null);
            
            // Only set loading if crucial data is completely missing
            if (!weatherData && !marketData) {
                setIsInitialLoad(true);
            }

            let lat = 20.5937, lon = 78.9629, district = "Delhi", state = "Delhi";
            
            if (effectiveUser.location) {
                lat = effectiveUser.location.lat;
                lon = effectiveUser.location.lon;
                if (effectiveUser.location.district) {
                    district = effectiveUser.location.district;
                    state = effectiveUser.location.state || "India";
                } else {
                    const loc = await reverseGeocode(lat, lon);
                    if (loc) { district = loc.district; state = loc.state; }
                }
            }
            setLocationInfo({ district, state });
            
            const handleError = (e: any) => {
                console.warn("API Failure", e);
                if (!navigator.onLine) setNetworkError("Network unreachable. Please try again after 10 minutes.");
            };

            try {
                // ADDED COMMUNITY FEED FETCH TO INITIAL LOAD
                const [w, alertsList, market, diagnoses, plans, news, schemes, community] = await Promise.allSettled([
                    getLocalWeather(lat, lon),
                    getDisasterAlerts({ lat, lon }),
                    getRealMarketPrices(district, state, effectiveUser.crops_grown || []),
                    user ? getUserDiagnoses(user.id, 20) : Promise.resolve([]),
                    user ? getUserCropPlans(user.id) : Promise.resolve([]),
                    getAgroStateNews(effectiveUser.crops_grown || [], state, 'en'),
                    getGovernmentSchemes(state, 'en'),
                    getCommunityFeed(lat, lon)
                ]);

                if (w.status === 'fulfilled') {
                    setWeatherData(w.value.display);
                    const history = [...(w.value.display.history || [])]; 
                    if (history.length === 0 || history[history.length - 1].date !== 'Today') {
                        history.push({ date: 'Today', temp: w.value.display.temp, condition: w.value.display.condition });
                    }
                    setWeatherHistoryList(history);
                    setActiveWeatherIndex(history.length - 1);
                }

                if (alertsList.status === 'fulfilled') {
                    setRawDisasterAlerts(alertsList.value);
                    const seenIds = JSON.parse(localStorage.getItem('fasal_seen_alerts') || '[]');
                    setNewAlerts(alertsList.value.filter(a => !seenIds.includes(a.id)));
                    setSeenAlerts(alertsList.value.filter(a => seenIds.includes(a.id)));
                }

                if (market.status === 'fulfilled') {
                    setMarketData(market.value.length > 0 ? market.value : [
                        {crop: 'Wheat', price: '₹2200/q', trend:'up', last_updated: 'Today', mandi: 'Local APMC'},
                        {crop: 'Rice', price: '₹1950/q', trend:'down', last_updated: 'Today', mandi: 'District Hub'},
                        {crop: 'Tomato', price: '₹1200/q', trend:'up', last_updated: 'Today', mandi: 'Veg Market'},
                        {crop: 'Cotton', price: '₹6200/q', trend:'stable', last_updated: 'Today', mandi: 'Cotton Yard'}
                    ]);
                }

                if (diagnoses.status === 'fulfilled') setRecentScans(diagnoses.value);
                if (plans.status === 'fulfilled') setActivePlans(plans.value);
                if (news.status === 'fulfilled') {
                    setRawNews(news.value);
                    if (lang === 'en') setNewsData(news.value);
                }
                if (schemes.status === 'fulfilled') {
                    setRawSchemes(schemes.value);
                    if (lang === 'en') setSchemesData(schemes.value);
                }
                if (community.status === 'fulfilled') {
                    setPosts(community.value);
                }

            } catch (e) {
                handleError(e);
            } finally {
                setIsInitialLoad(false);
            }
        };

        startTransition(() => { load(); });
    }, [
        // Granular dependencies to prevent full reload on unrelated user changes
        effectiveUser?.id, 
        effectiveUser?.location?.lat, 
        effectiveUser?.location?.lon,
        JSON.stringify(effectiveUser?.crops_grown),
        guestLocation
    ]);

    const combinedUpdates = useMemo(() => {
        const news = newsData || [];
        const schemes = schemesData || [];
        const mixed = [];
        const max = Math.max(news.length, schemes.length);
        for(let i=0; i<max; i++) {
            if (news[i]) mixed.push({ ...news[i], type: 'news' as const });
            if (schemes[i]) mixed.push({ ...schemes[i], type: 'scheme' as const });
        }
        return mixed.slice(0, 7);
    }, [newsData, schemesData]);

    const handleOpenContent = async (item: any, type: 'news' | 'scheme' | 'guide') => {
        if (type === 'news' && newsData) {
            const index = newsData.findIndex(n => n.id === item.id);
            if (index !== -1) {
                setViewingNewsIndex(index);
                if (lang !== 'en') {
                    const currentNews = newsData[index];
                    const fullTranslated = await translateSingleNewsContent(currentNews, lang);
                    const updatedNews = [...newsData];
                    updatedNews[index] = fullTranslated;
                    setNewsData(updatedNews);
                }
                return;
            }
        }
        setSelectedContent(item);
        setContentType(type);
    };

    const handlePostMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files) as File[];
            setPostMedia(prev => [...prev, ...files]);
            const newPreviews = files.map(file => URL.createObjectURL(file));
            setPostMediaPreviews(prev => [...prev, ...newPreviews]);
        }
    };

    const handleWeatherSwipe = (direction: 'left' | 'right') => {
        if (weatherHistoryList.length === 0) return;
        let nextIndex = activeWeatherIndex;
        if (direction === 'left') nextIndex = Math.max(0, activeWeatherIndex - 1);
        if (direction === 'right') nextIndex = Math.min(weatherHistoryList.length - 1, activeWeatherIndex + 1);
        setActiveWeatherIndex(nextIndex);
    };

    const displayedWeather = weatherHistoryList[activeWeatherIndex] || weatherData;
    const isToday = activeWeatherIndex === weatherHistoryList.length - 1;
    const isYesterday = activeWeatherIndex === weatherHistoryList.length - 2;
    const displayTemp = isToday ? weatherData?.temp : displayedWeather?.temp || weatherData?.temp - 2;
    const displayCondition = isToday ? weatherData?.condition : displayedWeather?.condition || 'Clear';
    const displayDateLabel = isToday ? t('time_today', lang) : isYesterday ? t('time_yesterday', lang) : displayedWeather?.date;

    const TabButton = ({ id, label }: { id: Tab, label: string }) => (
        <button 
            onClick={() => setActiveTab(id)}
            className={`
                px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 whitespace-nowrap
                ${activeTab === id 
                    ? 'bg-slate-900 text-white shadow-lg scale-105 dark:bg-white dark:text-slate-900 ring-2 ring-slate-200 dark:ring-slate-700' 
                    : 'bg-white text-slate-500 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                }
            `}
        >
            {label}
        </button>
    );

    return (
        <div className={`flex flex-col h-full bg-[#f8fafc] dark:bg-[#020617] relative font-sans transition-opacity duration-300 ${isPending ? 'opacity-70' : 'opacity-100'}`}>
            
            {/* Header Area */}
            <div className="pt-4 md:pt-6 pb-2 px-4 md:px-8 z-20 sticky top-0 bg-[#f8fafc]/95 dark:bg-[#020617]/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('hub_title', lang)}</h1>
                    <div className="flex items-center gap-3">
                        {user && (
                            <button onClick={onNavigateToChat} className="relative w-10 h-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 transition-colors text-green-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            </button>
                        )}
                        <button onClick={() => setShowNotifications(true)} className="relative w-10 h-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-50 transition-colors">
                            <span className="text-slate-600 dark:text-slate-300">🔔</span>
                            {notifications.filter(n => !n.read).length > 0 && <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-800"></span>}
                        </button>
                    </div>
                </div>

                {networkError && <div className="bg-red-500 text-white text-xs font-bold p-2 rounded-lg mb-4 text-center animate-bounce-in shadow-md">{networkError}</div>}

                {/* Weather Card Skeleton vs Content */}
                {showSkeleton ? (
                    <Skeleton className="h-[90px] w-full rounded-3xl mb-4" />
                ) : (
                    <div className="relative mb-4 group animate-fadeIn">
                        <div className="bg-[#1c1c1e] text-white rounded-3xl p-5 shadow-xl flex justify-between items-center relative overflow-hidden h-[90px] w-full transition-all">
                            <button onClick={() => handleWeatherSwipe('left')} disabled={activeWeatherIndex === 0} className="absolute left-0 top-0 bottom-0 w-12 z-20 flex items-center justify-start pl-2 bg-gradient-to-r from-black/20 to-transparent disabled:hidden">
                                <span className="text-white/50 hover:text-white text-2xl transition-colors">‹</span>
                            </button>
                            <div className="flex-1 flex justify-between items-center px-4 z-10">
                                <div className="flex items-center gap-4">
                                    <motion.span key={`icon-${activeWeatherIndex}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-4xl">
                                        {displayCondition.includes('Rain') ? '🌧️' : displayCondition.includes('Cloud') ? '☁️' : '☀️'}
                                    </motion.span>
                                    <div>
                                        <div className="flex items-baseline gap-2">
                                            <motion.span key={`temp-${activeWeatherIndex}`} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-bold">
                                                {displayTemp?.toFixed(0)}°C
                                            </motion.span>
                                        </div>
                                        <motion.p key={`cond-${activeWeatherIndex}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-slate-400 capitalize">{displayCondition}</motion.p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{locationInfo?.district || "LOADING..."}</p>
                                    <motion.p key={`date-${activeWeatherIndex}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className={`text-sm font-bold ${isToday ? 'text-blue-400' : 'text-slate-300'}`}>{displayDateLabel}</motion.p>
                                    <div className="text-xs text-slate-500 font-bold mt-1">H: {isToday ? weatherData?.rh : Math.max(20, (weatherData?.rh || 50) - 5)}%</div>
                                </div>
                            </div>
                            <button onClick={() => handleWeatherSwipe('right')} disabled={activeWeatherIndex === weatherHistoryList.length - 1} className="absolute right-0 top-0 bottom-0 w-12 z-20 flex items-center justify-end pr-2 bg-gradient-to-l from-black/20 to-transparent disabled:hidden">
                                <span className="text-white/50 hover:text-white text-2xl transition-colors">›</span>
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 pt-1">
                    <TabButton id="dashboard" label={t('hub_dashboard', lang)} />
                    <TabButton id="community" label={t('hub_community', lang)} />
                    <TabButton id="schemes" label={t('hub_schemes', lang)} />
                    <TabButton id="knowledge" label={t('hub_knowledge', lang)} />
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 pb-24 md:pb-12">
                <AnimatePresence mode="wait">
                    
                    {/* DASHBOARD TAB */}
                    {activeTab === 'dashboard' && (
                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                            
                            {/* NEW: CRITICAL ALERTS (TOP) */}
                            {newAlerts.length > 0 && (
                                <div className="space-y-2 animate-bounce-in">
                                    {newAlerts.map(alert => (
                                        <div key={alert.id} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-start gap-4 shadow-sm">
                                            <div className="bg-red-100 text-red-600 p-2 rounded-full text-xl animate-pulse">⚠️</div>
                                            <div>
                                                <h4 className="font-bold text-red-800 dark:text-red-300 text-sm uppercase tracking-wide">{t('alert_critical', lang)}: {alert.title}</h4>
                                                <p className="text-sm text-red-700 dark:text-red-200 mt-1">{alert.message}</p>
                                                <p className="text-[10px] text-red-500 mt-2 font-bold uppercase">{alert.source} • {new Date(alert.timestamp).toLocaleTimeString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* 1. Quick Actions Grid */}
                            {showSkeleton ? (
                                <div className="grid grid-cols-4 gap-3 md:gap-6">
                                    <Skeleton className="h-32 rounded-2xl" />
                                    <Skeleton className="h-32 rounded-2xl" />
                                    <Skeleton className="h-32 rounded-2xl" />
                                    <Skeleton className="h-32 rounded-2xl" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-4 gap-3 md:gap-6 animate-fadeIn">
                                    <button onClick={onNavigateToDiagnosis} className="flex flex-col items-center justify-center p-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-2xl shadow-sm hover:scale-105 transition-transform">
                                        <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xl mb-2">📸</div>
                                        <span className="text-[10px] md:text-xs font-bold text-green-800 dark:text-green-300 text-center">Check Crop</span>
                                    </button>
                                    <button onClick={onNavigateToSoilLab} className="flex flex-col items-center justify-center p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-2xl shadow-sm hover:scale-105 transition-transform">
                                        <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xl mb-2">🪨</div>
                                        <span className="text-[10px] md:text-xs font-bold text-amber-800 dark:text-amber-300 text-center">Soil Test</span>
                                    </button>
                                    <button onClick={() => onNavigateToCropPlanner?.()} className="flex flex-col items-center justify-center p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl shadow-sm hover:scale-105 transition-transform">
                                        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl mb-2">🌱</div>
                                        <span className="text-[10px] md:text-xs font-bold text-blue-800 dark:text-blue-300 text-center">AI Crop</span>
                                    </button>
                                    {/* NEW CHAT BUTTON */}
                                    <button onClick={() => onNavigateToChat?.()} className="flex flex-col items-center justify-center p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-2xl shadow-sm hover:scale-105 transition-transform">
                                        <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xl mb-2">💬</div>
                                        <span className="text-[10px] md:text-xs font-bold text-purple-800 dark:text-purple-300 text-center">Ask Farmer</span>
                                    </button>
                                    <button onClick={() => onNavigateToTransport?.()} className="flex flex-col items-center justify-center p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl shadow-sm hover:scale-105 transition-transform">
                                        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl mb-2">🚚</div>
                                        <span className="text-[10px] md:text-xs font-bold text-blue-800 dark:text-blue-300 text-center">Transport</span>
                                    </button>
                                </div>
                            )}

                            {/* 2. Market Graph (With Scales) */}
                            {showSkeleton ? (
                                <Skeleton className="h-64 w-full rounded-[2rem]" />
                            ) : (
                                <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-5 shadow-sm border border-slate-200 dark:border-slate-800 relative animate-fadeIn">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><span>📈</span> Market Trends</h3>
                                        <select 
                                            className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-xs font-bold px-3 py-1.5 outline-none cursor-pointer"
                                            value={marketGraphSelection}
                                            onChange={(e) => setMarketGraphSelection(e.target.value)}
                                            disabled={!marketData}
                                        >
                                            <option value="All">All Crops</option>
                                            {Array.from(new Set(marketData?.map(m => m.crop))).map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="h-48 w-full flex items-center justify-center">
                                        {marketData ? <canvas ref={marketChartRef}></canvas> : <div className="text-slate-400 text-sm animate-pulse">Loading Market Data...</div>}
                                    </div>
                                    <div className="flex justify-center gap-2 mt-4">
                                        {(['1D', '1W', '1M', '1Y'] as TimeRange[]).map(r => (
                                            <button 
                                                key={r} 
                                                onClick={() => setGraphTimeRange(r)}
                                                className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${graphTimeRange === r ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}
                                            >
                                                {r}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 2.5 Live Prices Ticker (Professional UI) */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center px-1">
                                    <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                                        <span>⚡</span> Live Prices
                                    </h3>
                                    <button onClick={() => setActiveTab('market')} className="text-blue-600 text-xs font-bold hover:underline">
                                        View All
                                    </button>
                                </div>
                                
                                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                                    {showSkeleton ? (
                                        [1, 2, 3, 4].map(i => <Skeleton key={i} className="min-w-[150px] h-32 rounded-xl" />)
                                    ) : (
                                        marketData && marketData.length > 0 ? (
                                            marketData.map((item, idx) => (
                                                <div key={idx} className="min-w-[150px] bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between animate-fadeIn hover:shadow-md transition-shadow">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase truncate max-w-[90px]">{item.crop}</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center ${item.trend === 'up' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : item.trend === 'down' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                                                            {item.trend === 'up' ? '▲' : item.trend === 'down' ? '▼' : '•'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="text-lg font-black text-slate-900 dark:text-white">{item.price.split('/')[0]}</p> 
                                                        <div className="flex flex-col mt-1">
                                                            <span className={`text-[10px] font-bold ${item.trend === 'up' ? 'text-green-600' : item.trend === 'down' ? 'text-red-500' : 'text-slate-400'}`}>
                                                                {item.trend === 'up' ? 'High' : item.trend === 'down' ? 'Low' : 'Stable'}
                                                            </span>
                                                            <span className="text-[9px] text-slate-400 truncate max-w-full">@ {item.mandi || 'Local Mandi'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : ([1,2,3,4].map(i => <div key={i} className="min-w-[140px] h-24 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"></div>))
                                    )}
                                </div>
                            </div>

                            {/* 3. My Crops Tracking */}
                            <div className="space-y-3">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white px-1">My Crops</h3>
                                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                                    {showSkeleton ? (
                                        [1, 2].map(i => <Skeleton key={i} className="min-w-[260px] h-32 rounded-2xl" />)
                                    ) : (
                                        activePlans.length === 0 ? (
                                            <div className="w-full p-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 text-sm animate-fadeIn">
                                                No active crop plans. <button onClick={() => onNavigateToCropPlanner?.()} className="text-blue-600 font-bold hover:underline">Start Plan</button>
                                            </div>
                                        ) : activePlans.map(plan => {
                                            const activeStage = plan.stages.find(s => s.status === 'active') || plan.stages[plan.stages.length-1];
                                            const completedCount = plan.stages.filter(s => s.status === 'completed').length;
                                            const progress = Math.round((completedCount / plan.stages.length) * 100);
                                            const cropImage = `https://source.unsplash.com/100x100/?${plan.cropName.toLowerCase().split(' ')[0]},farm`;

                                            return (
                                                <div 
                                                    key={plan.id} 
                                                    onClick={() => onNavigateToCropPlanner?.(plan.id)}
                                                    className="min-w-[260px] bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm flex gap-4 items-center cursor-pointer hover:border-green-500 transition-colors animate-fadeIn"
                                                >
                                                    <div className="w-16 h-16 rounded-xl bg-slate-100 relative overflow-hidden flex items-center justify-center">
                                                        {!isLowBandwidth ? (
                                                            <img src={cropImage} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-2xl">🌱</span>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-slate-900 dark:text-white truncate">{plan.cropName}</h4>
                                                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                                            {activeStage?.stageName}
                                                        </div>
                                                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                                                            <div className="h-full bg-blue-500" style={{ width: `${progress}%` }}></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* 4. Recent Checks (Clickable & Swipeable) */}
                            <div className="space-y-3">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white px-1">Recent Checks</h3>
                                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                                    {showSkeleton ? (
                                        [1, 2, 3].map(i => <Skeleton key={i} className="min-w-[160px] h-36 rounded-2xl" />)
                                    ) : (
                                        recentScans.length === 0 ? (
                                            <div className="text-slate-400 text-sm italic px-2 animate-fadeIn">No scans yet.</div>
                                        ) : recentScans.map((scan, i) => {
                                            const isSoil = 'soilType' in scan;
                                            const title = isSoil ? (scan as SoilAnalysisResponse).soilType : (scan as DiagnosisResponse).disease_name_local;
                                            return (
                                                <div 
                                                    key={i} 
                                                    onClick={() => onOpenReport && onOpenReport(scan)}
                                                    className="min-w-[160px] bg-white dark:bg-slate-900 rounded-2xl p-3 border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer hover:border-green-500 transition-colors animate-fadeIn relative group"
                                                >
                                                    <div className="h-24 rounded-xl bg-slate-100 overflow-hidden mb-3 relative flex items-center justify-center">
                                                        {!isLowBandwidth && scan.imageUrl ? (
                                                            <img src={scan.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                        ) : (
                                                            <div className="flex items-center justify-center h-full text-2xl">{isSoil ? '🪨' : '🌿'}</div>
                                                        )}
                                                        <div className={`absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-white/90 ${isSoil ? 'text-amber-600' : 'text-green-600'}`}>
                                                            {isSoil ? 'Soil' : 'Crop'}
                                                        </div>
                                                    </div>
                                                    <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{title}</h4>
                                                    <p className="text-[10px] text-slate-500">{new Date(scan.timestamp).toLocaleDateString()}</p>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* 5. Combined News & Schemes */}
                            {showSkeleton ? (
                                <Skeleton className="h-96 w-full rounded-[2rem]" />
                            ) : (
                                <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-200 dark:border-slate-800 animate-fadeIn">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2"><span>📢</span> Latest Updates</h3>
                                        <button onClick={() => setActiveTab('schemes')} className="text-blue-600 text-xs font-bold hover:underline">View All</button>
                                    </div>
                                    <div className="space-y-4">
                                        {combinedUpdates.length === 0 ? <div className="h-20 bg-slate-50 rounded-xl animate-pulse"></div> : combinedUpdates.map((item: any, i) => (
                                            <div key={i} onClick={() => handleOpenContent(item, item.type === 'news' ? 'news' : 'scheme')} className="flex gap-4 cursor-pointer group animate-fadeIn">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${item.type === 'news' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                                    {item.type === 'news' ? '📰' : '📜'}
                                                </div>
                                                <div className="flex-1 border-b border-slate-100 dark:border-slate-800 pb-4 group-last:border-0 group-last:pb-0">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="font-bold text-sm text-slate-800 dark:text-white line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">{item.title || item.name}</h4>
                                                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 ml-2 whitespace-nowrap">{item.type === 'news' ? 'News' : 'Scheme'}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{item.summary || item.benefit}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => setActiveTab('schemes')} className="w-full mt-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-xl text-sm hover:bg-slate-100 transition-colors">
                                        Read More News & Schemes →
                                    </button>
                                </div>
                            )}

                            {/* PREVIOUS ALERTS (BOTTOM) - Smart Position */}
                            {seenAlerts.length > 0 && (
                                <div className="opacity-70 mt-8">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 px-2">{t('alert_prev', lang)}</h4>
                                    <div className="space-y-2">
                                        {seenAlerts.map(alert => (
                                            <div key={alert.id} className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 flex items-start gap-3">
                                                <span className="text-slate-500 text-lg">⚠️</span>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{alert.title}</p>
                                                    <p className="text-[10px] text-slate-500">{new Date(alert.timestamp).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </motion.div>
                    )}

                    {/* OTHER TABS */}
                    {activeTab === 'community' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-xl mx-auto space-y-6">
                            {showSkeleton ? (
                                [1, 2, 3].map(i => <Skeleton key={i} className="h-64 rounded-3xl w-full" />)
                            ) : (
                                posts.length === 0 ? <p className="text-center text-slate-400 py-10">No discussions found.</p> : posts.map(post => (
                                    <div key={post.id} className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden relative">
                                        <div className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3"><img src={post.author_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author}`} className="w-10 h-10 rounded-full bg-slate-100 border border-white shadow-sm" loading="lazy" /><div><h4 className="font-bold text-slate-900 dark:text-white text-sm">{post.author}</h4><p className="text-[10px] text-slate-500 font-bold">{post.author_loc}</p></div></div>
                                        </div>
                                        {(!post.image_url && post.content.length < 100) && <div className="w-full aspect-video bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center p-6 text-center"><p className="text-xl font-serif italic text-slate-700 dark:text-slate-300">"{post.content}"</p></div>}
                                        <div className="px-4 pb-3"><p className="font-bold text-sm text-slate-900 dark:text-white mb-1">{post.likes} likes</p><div className="text-sm text-slate-800 dark:text-slate-200"><span className="font-bold mr-1">{post.author}</span>{post.content}</div><p className="text-[10px] text-slate-400 uppercase mt-3">{post.timestamp}</p></div>
                                    </div>
                                ))
                            )}
                        </motion.div>
                    )}

                    {(activeTab === 'schemes' || activeTab === 'knowledge') && (
                        <div className="space-y-4">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid md:grid-cols-2 gap-4">
                                {showSkeleton ? [1,2,3,4].map(i => <Skeleton key={i} className="h-40 rounded-[2rem]" />) : 
                                ((activeTab === 'schemes' ? schemesData : guides)?.length === 0) ? <div className="col-span-full text-center py-10"><p className="text-slate-500 dark:text-slate-400 font-medium">No items found.</p></div> :
                                (activeTab === 'schemes' ? (schemesData || []) : (guides || [])).map((item: any, i) => (
                                    <div key={i} className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800 hover:border-green-50 transition-all flex flex-col justify-between h-full relative group hover:shadow-lg">
                                        <div><Badge variant="secondary" className="mb-3">{item.provider || item.category}</Badge><h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2 leading-tight">{item.name || item.title}</h3><p className="text-sm text-slate-600 dark:text-slate-400 mb-6 line-clamp-3 leading-relaxed">{item.benefit || item.content}</p></div>
                                        <div className="mt-auto flex gap-2"><button onClick={() => handleOpenContent(item, activeTab === 'schemes' ? 'scheme' : 'guide')} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">{t('hub_read_details', lang)}</button></div>
                                    </div>
                                ))}
                            </motion.div>
                        </div>
                    )}

                </AnimatePresence>
            </div>

            <NotificationCenter open={showNotifications} onClose={() => setShowNotifications(false)} notifications={notifications} onMarkRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))} onClearAll={() => setNotifications([])} />

            <AnimatePresence>
                {viewingNewsIndex !== null && newsData && (
                    <NewsReader news={newsData} initialIndex={viewingNewsIndex} onClose={() => setViewingNewsIndex(null)} lang={lang} />
                )}
            </AnimatePresence>

            <Dialog open={!!selectedContent && !viewingNewsIndex}>
                <DialogContent className="max-w-2xl bg-white dark:bg-slate-900 h-[85vh] overflow-y-auto custom-scrollbar rounded-[2rem]">
                    <DialogHeader><DialogTitle className="text-xl font-bold dark:text-white leading-relaxed">{selectedContent?.title || selectedContent?.name}</DialogTitle></DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700"><h4 className="text-sm font-bold uppercase text-slate-500 mb-2">{t('hub_summary', lang)}</h4><p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">{selectedContent?.summary || selectedContent?.benefit}</p></div>
                        <div><h4 className="text-sm font-bold uppercase text-slate-500 mb-2">{t('hub_details', lang)}</h4><div className="prose dark:prose-invert text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{selectedContent?.full_content || selectedContent?.full_details || selectedContent?.content || "Details loading..."}</div></div>
                        {(selectedContent?.link || selectedContent?.url) && <a href={selectedContent?.link || selectedContent?.url} target="_blank" className="block text-center w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-md">{t('hub_official_source', lang)}</a>}
                    </div>
                    <DialogFooter><Button onClick={() => setSelectedContent(null)} className="rounded-xl">{t('hub_close', lang)}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {showPostModal && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2rem] p-6 shadow-2xl animate-bounce-in">
                        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-xl dark:text-white">{t('comm_new_post', lang)}</h3><button onClick={() => setShowPostModal(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200">✕</button></div>
                        <Textarea value={postContent} onChange={(e) => setPostContent(e.target.value)} placeholder={t('comm_share_placeholder', lang)} className="min-h-[120px] mb-4 bg-slate-50 dark:bg-slate-800 border-none resize-none rounded-xl p-4 text-lg" />
                        <div className="mb-6"><input type="file" accept="image/*,video/*" multiple className="hidden" ref={postFileInputRef} onChange={handlePostMediaChange} /><div className="flex gap-2 overflow-x-auto pb-2"><button onClick={() => postFileInputRef.current?.click()} className="w-20 h-20 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex items-center justify-center text-3xl text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">+</button>{postMediaPreviews.map((url, i) => (<div key={i} className="w-20 h-20 rounded-2xl overflow-hidden relative border border-slate-200 shadow-sm"><img src={url} className="w-full h-full object-cover" /></div>))}</div></div>
                        <Button onClick={async () => { if(!user || !postContent) return; await createCommunityPost(user, postContent, postMedia); setPostContent(""); setPostMedia([]); setPostMediaPreviews([]); setShowPostModal(false); }} className="w-full bg-green-600 text-white rounded-xl py-4 text-lg font-bold shadow-lg shadow-green-500/30 hover:bg-green-700">{t('comm_share_btn', lang)}</Button>
                    </div>
                </div>
            )}
        </div>
    );
};
