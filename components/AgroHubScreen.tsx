
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
    onNavigateToChat?: (openAiChat?: boolean) => void;
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

    const [showWhatsAppOnboarding, setShowWhatsAppOnboarding] = useState(false);
    const [whatsappStep, setWhatsappStep] = useState(0);
    
    // Community Post Modal
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
                 const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
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
                            legend: { 
                                display: true, 
                                position: 'top', 
                                align: 'end', 
                                labels: { 
                                    boxWidth: 10, 
                                    boxHeight: 10,
                                    font: { size: 11, weight: '600' }, 
                                    usePointStyle: true, 
                                    pointStyle: 'circle',
                                    color: textColor,
                                    padding: 15
                                } 
                            },
                            tooltip: { 
                                mode: 'index', 
                                intersect: false, 
                                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)', 
                                titleColor: isDark ? '#fff' : '#0f172a', 
                                bodyColor: isDark ? '#cbd5e1' : '#475569', 
                                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', 
                                borderWidth: 1,
                                padding: 12,
                                cornerRadius: 12,
                                titleFont: { size: 13, weight: '700' },
                                bodyFont: { size: 12 },
                                displayColors: true,
                                boxWidth: 8,
                                boxHeight: 8,
                                boxPadding: 4,
                                callbacks: {
                                    label: (context) => ` ${context.dataset.label}: ₹${context.parsed.y.toLocaleString()}/q`
                                }
                            }
                        },
                        scales: { 
                            x: { 
                                display: true, 
                                grid: { display: false }, 
                                border: { display: false },
                                ticks: { 
                                    maxTicksLimit: 7, 
                                    font: { size: 10, weight: '500' }, 
                                    color: textColor,
                                    padding: 8
                                },
                                title: {
                                    display: true,
                                    text: t('lbl_date', lang),
                                    color: textColor,
                                    font: { size: 10, weight: '600' },
                                    padding: { top: 8 }
                                }
                            }, 
                            y: { 
                                display: true, 
                                position: 'left',
                                border: { display: false },
                                grid: { 
                                    color: gridColor,
                                    drawTicks: false
                                }, 
                                ticks: { 
                                    callback: (val) => '₹' + Number(val).toLocaleString(), 
                                    font: { size: 10, weight: '500' }, 
                                    color: textColor,
                                    padding: 10,
                                    maxTicksLimit: 6
                                },
                                title: {
                                    display: true,
                                    text: t('lbl_price_q', lang),
                                    color: textColor,
                                    font: { size: 10, weight: '600' },
                                    padding: { bottom: 8 }
                                }
                            } 
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
                flex-1 min-w-fit px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap
                ${activeTab === id 
                    ? 'bg-white dark:bg-slate-900 text-green-600 dark:text-green-400 shadow-lg shadow-green-500/10 ring-1 ring-green-500/20' 
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'
                }
            `}
        >
            {label}
        </button>
    );

    return (
        <div className={`flex flex-col h-full bg-gradient-to-b from-[#f0fdf4] via-[#f8fafc] to-[#f1f5f9] dark:from-[#052e16] dark:via-[#020617] dark:to-[#0f172a] relative font-sans transition-opacity duration-300 ${isPending ? 'opacity-70' : 'opacity-100'}`}>
            
            {/* Decorative Background Elements */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-green-500/10 to-transparent rounded-full blur-3xl"></div>
                <div className="absolute bottom-40 left-0 w-72 h-72 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-full blur-3xl"></div>
            </div>
            
            {/* Header Area - Premium Glass Design */}
            <div className="pt-4 md:pt-6 pb-2 px-4 md:px-8 z-20 sticky top-0 bg-gradient-to-b from-[#f0fdf4]/98 via-[#f8fafc]/95 to-[#f8fafc]/90 dark:from-[#052e16]/98 dark:via-[#020617]/95 dark:to-[#020617]/90 backdrop-blur-2xl border-b border-green-100/50 dark:border-green-900/30">
                <div className="flex justify-between items-center mb-4">
                    {/* Greeting with animated wave */}
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30 ring-2 ring-white/50 dark:ring-slate-800/50">
                                <span className="text-lg animate-bounce" style={{ animationDuration: '2s' }}>👋</span>
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"></div>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-widest">{t('hub_title', lang)}</p>
                            <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                {user?.name ? `Hi, ${user.name.split(' ')[0]}!` : t('hub_welcome', lang)}
                            </h1>
                        </div>
                    </div>
                    
                    {/* Action Buttons - Premium Style */}
                    <div className="flex items-center gap-2">
                        {/* WhatsApp Button - Opens Onboarding Modal */}
                        <button 
                            onClick={() => setShowWhatsAppOnboarding(true)}
                            className="relative w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30 hover:shadow-green-500/50 hover:scale-105 transition-all duration-300"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-ping"></span>
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
                        </button>
                        
                        {/* Messages Button - Opens All Conversations */}
                        {user && (
                            <button 
                                onClick={() => onNavigateToChat?.(false)} 
                                className="relative w-10 h-10 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-200/80 dark:border-slate-700/80 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 group"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600 dark:text-purple-400">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                                    <path d="M8 10h.01M12 10h.01M16 10h.01"/>
                                </svg>
                            </button>
                        )}
                        
                        {/* Notification Button */}
                        <button 
                            onClick={() => setShowNotifications(true)} 
                            className="relative w-10 h-10 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-200/80 dark:border-slate-700/80 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                            </svg>
                            {notifications.filter(n => !n.read).length > 0 && (
                                <>
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white dark:border-slate-800 text-[10px] font-bold text-white flex items-center justify-center">
                                        {notifications.filter(n => !n.read).length}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {networkError && <div className="bg-red-500 text-white text-xs font-bold p-2 rounded-lg mb-4 text-center animate-bounce-in shadow-md">{networkError}</div>}

                {/* Weather Card - Fully Responsive Premium Glassmorphism */}
                {showSkeleton ? (
                    <Skeleton className="h-24 md:h-28 w-full rounded-3xl mb-4" />
                ) : (
                    <div className="relative mb-4 group animate-fadeIn">
                        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-3 md:p-5 shadow-2xl shadow-slate-900/30 dark:shadow-black/40 flex justify-between items-center overflow-hidden w-full transition-all border border-slate-700/30">
                            {/* Animated Background Orbs */}
                            <div className="absolute inset-0 overflow-hidden">
                                <div className="absolute -top-10 -left-10 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-500/10 rounded-full blur-2xl animate-pulse"></div>
                                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-gradient-to-br from-green-500/15 to-cyan-500/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                            </div>
                            
                            {/* Left Arrow */}
                            <button onClick={() => handleWeatherSwipe('left')} disabled={activeWeatherIndex === 0} className="hidden md:flex absolute left-0 top-0 bottom-0 w-10 z-20 items-center justify-start pl-2 bg-gradient-to-r from-black/30 to-transparent disabled:hidden hover:from-black/50 transition-all">
                                <span className="text-white/60 hover:text-white text-xl transition-colors">‹</span>
                            </button>
                            
                            {/* Main Content */}
                            <div className="flex-1 flex flex-col md:flex-row justify-between items-start md:items-center px-2 md:px-4 z-10 gap-3 md:gap-0">
                                {/* Weather Display */}
                                <div className="flex items-start md:items-center gap-2 md:gap-4 w-full md:w-auto">
                                    <motion.div 
                                        key={`icon-${activeWeatherIndex}`} 
                                        initial={{ opacity: 0, y: 10, scale: 0.8 }} 
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        className="relative shrink-0"
                                    >
                                        <span className="text-4xl md:text-5xl drop-shadow-lg block">
                                            {displayCondition.includes('Rain') ? '🌧️' : displayCondition.includes('Cloud') ? '☁️' : '☀️'}
                                        </span>
                                        <div className="absolute -bottom-1 -right-1 w-4 md:w-6 h-4 md:h-6 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-[8px] md:text-[10px] font-bold">
                                            {isToday ? '📍' : '📅'}
                                        </div>
                                    </motion.div>
                                    <div className="flex-1">
                                        <div className="flex items-baseline gap-1 md:gap-2">
                                            <motion.span 
                                                key={`temp-${activeWeatherIndex}`} 
                                                initial={{ opacity: 0, x: -10 }} 
                                                animate={{ opacity: 1, x: 0 }}
                                                className="text-3xl md:text-4xl font-black tracking-tight"
                                            >
                                                {displayTemp?.toFixed(0)}°
                                            </motion.span>
                                            <span className="text-base md:text-lg font-bold text-white/60">C</span>
                                        </div>
                                        <motion.p 
                                            key={`cond-${activeWeatherIndex}`} 
                                            initial={{ opacity: 0 }} 
                                            animate={{ opacity: 1 }}
                                            className="text-xs md:text-sm font-medium text-white/70 capitalize truncate"
                                        >
                                            {displayCondition}
                                        </motion.p>
                                    </div>
                                </div>
                                
                                {/* Location & Date Info */}
                                <div className="text-right md:text-right w-full md:w-auto flex md:flex-col items-center md:items-end justify-between md:justify-end gap-2">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] md:text-xs">📍</span>
                                        <p className="text-[10px] md:text-xs font-bold text-white/80 uppercase tracking-wider truncate">{locationInfo?.district || "LOADING..."}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <motion.div 
                                            key={`date-${activeWeatherIndex}`} 
                                            initial={{ opacity: 0, x: 10 }} 
                                            animate={{ opacity: 1, x: 0 }}
                                            className={`text-[10px] md:text-sm font-bold px-2 md:px-2.5 py-0.5 rounded-full ${isToday ? 'bg-blue-500/30 text-blue-300' : 'bg-white/10 text-white/70'}`}
                                        >
                                            {displayDateLabel}
                                        </motion.div>
                                        <span className="text-[10px] text-white/50 flex items-center gap-0.5 shrink-0">
                                            💧{isToday ? weatherData?.rh : Math.max(20, (weatherData?.rh || 50) - 5)}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Right Arrow */}
                            <button onClick={() => handleWeatherSwipe('right')} disabled={activeWeatherIndex === weatherHistoryList.length - 1} className="hidden md:flex absolute right-0 top-0 bottom-0 w-10 z-20 items-center justify-end pr-2 bg-gradient-to-l from-black/30 to-transparent disabled:hidden hover:from-black/50 transition-all">
                                <span className="text-white/60 hover:text-white text-xl transition-colors">›</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Tab Navigation - Pill Style */}
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 pt-1 bg-slate-100/80 dark:bg-slate-800/50 rounded-2xl p-1.5">
                    <TabButton id="dashboard" label={t('hub_dashboard', lang)} />
                    <TabButton id="community" label={t('hub_community', lang)} />
                    <TabButton id="schemes" label={t('hub_schemes', lang)} />
                    <TabButton id="knowledge" label={t('hub_knowledge', lang)} />
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 pb-28 md:pb-12 relative z-10">
                <AnimatePresence mode="wait">
                    
                    {/* DASHBOARD TAB */}
                    {activeTab === 'dashboard' && (
                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">
                            
                            {/* CRITICAL ALERTS - Premium Style */}
                            {newAlerts.length > 0 && (
                                <div className="space-y-2 animate-bounce-in">
                                    {newAlerts.map(alert => (
                                        <div key={alert.id} className="relative bg-gradient-to-r from-red-500 to-rose-600 rounded-2xl p-4 flex items-start gap-4 shadow-xl shadow-red-500/30 overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse"></div>
                                            <div className="relative z-10 w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-xl animate-bounce shrink-0">
                                                ⚠️
                                            </div>
                                            <div className="relative z-10 flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold text-white uppercase">{t('alert_critical', lang)}</span>
                                                </div>
                                                <h4 className="font-bold text-white text-sm">{alert.title}</h4>
                                                <p className="text-sm text-white/80 mt-1 line-clamp-2">{alert.message}</p>
                                                <p className="text-[10px] text-white/60 mt-2 font-medium">{alert.source} • {new Date(alert.timestamp).toLocaleTimeString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* 1. Quick Actions Grid - Premium Bento Style */}
                            {showSkeleton ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <Skeleton className="h-28 rounded-3xl" />
                                    <Skeleton className="h-28 rounded-3xl" />
                                    <Skeleton className="h-28 rounded-3xl" />
                                    <Skeleton className="h-28 rounded-3xl" />
                                </div>
                            ) : (
                                <div className="space-y-3 animate-fadeIn">
                                    {/* Row 1: Main Actions */}
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Scan Crop - Hero Card */}
                                        <button 
                                            onClick={onNavigateToDiagnosis} 
                                            className="relative group bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 rounded-3xl p-4 shadow-xl shadow-green-500/20 hover:shadow-green-500/40 hover:scale-[1.02] transition-all duration-300 overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                                            <div className="relative z-10">
                                                <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform">
                                                    📸
                                                </div>
                                                <h3 className="text-white font-bold text-base text-left">Scan Crop</h3>
                                                <p className="text-white/70 text-xs text-left mt-0.5">AI Disease Detection</p>
                                            </div>
                                        </button>
                                        
                                        {/* Soil Test */}
                                        <button 
                                            onClick={onNavigateToSoilLab} 
                                            className="relative group bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-3xl p-4 shadow-xl shadow-orange-500/20 hover:shadow-orange-500/40 hover:scale-[1.02] transition-all duration-300 overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                                            <div className="relative z-10">
                                                <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform">
                                                    🪨
                                                </div>
                                                <h3 className="text-white font-bold text-base text-left">Soil Lab</h3>
                                                <p className="text-white/70 text-xs text-left mt-0.5">Nutrient Analysis</p>
                                            </div>
                                        </button>
                                    </div>
                                    
                                    {/* Row 2: Secondary Actions */}
                                    <div className="grid grid-cols-3 gap-3">
                                        {/* AI Crop Planner */}
                                        <button 
                                            onClick={() => onNavigateToCropPlanner?.()} 
                                            className="relative group bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-lg border border-slate-100 dark:border-slate-800 hover:border-blue-500/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                                        >
                                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-lg mb-2 shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                                                🌱
                                            </div>
                                            <h3 className="text-slate-900 dark:text-white font-bold text-xs">AI Planner</h3>
                                        </button>
                                        
                                        {/* Ask AI Farmer */}
                                        <button 
                                            onClick={() => onNavigateToChat?.(true)} 
                                            className="relative group bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-lg border border-slate-100 dark:border-slate-800 hover:border-purple-500/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                                        >
                                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center text-lg mb-2 shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
                                                💬
                                            </div>
                                            <h3 className="text-slate-900 dark:text-white font-bold text-xs">AI Chat</h3>
                                        </button>
                                        
                                        {/* Transport */}
                                        <button 
                                            onClick={() => onNavigateToTransport?.()} 
                                            className="relative group bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-lg border border-slate-100 dark:border-slate-800 hover:border-cyan-500/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                                        >
                                            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-lg mb-2 shadow-lg shadow-cyan-500/30 group-hover:scale-110 transition-transform">
                                                🚚
                                            </div>
                                            <h3 className="text-slate-900 dark:text-white font-bold text-xs">Transport</h3>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* 2. Market Graph - Premium Card with Data Source */}
                            {showSkeleton ? (
                                <Skeleton className="h-72 md:h-80 w-full rounded-[2rem]" />
                            ) : (
                                <div className="relative bg-white dark:bg-slate-900 rounded-[2rem] p-4 md:p-6 shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-fadeIn">
                                    {/* Decorative Background */}
                                    <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-green-500/8 to-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
                                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-emerald-500/5 to-transparent rounded-full blur-2xl pointer-events-none"></div>
                                    
                                    {/* Header */}
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-0 mb-5 md:mb-6 relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 md:w-12 h-10 md:h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30 shrink-0">
                                                <span className="text-xl md:text-2xl">📈</span>
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">Market Trends</h3>
                                                <p className="text-[11px] md:text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shrink-0"></span>
                                                    <span>Real-time mandi prices</span>
                                                </p>
                                            </div>
                                        </div>
                                        <select 
                                            className="bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs md:text-sm font-bold px-3 md:px-4 py-2 md:py-2.5 outline-none cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm"
                                            value={marketGraphSelection}
                                            onChange={(e) => setMarketGraphSelection(e.target.value)}
                                            disabled={!marketData}
                                        >
                                            <option value="All">All Crops</option>
                                            {Array.from(new Set(marketData?.map(m => m.crop))).map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    
                                    {/* Chart Container */}
                                    <div className="h-48 md:h-56 w-full flex items-center justify-center relative z-10 bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/30 dark:to-slate-900/20 rounded-2xl p-2 md:p-4 border border-slate-100/50 dark:border-slate-700/50">
                                        {marketData ? (
                                            <canvas ref={marketChartRef} style={{ maxWidth: '100%' }}></canvas>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <div className="animate-spin w-8 h-8 border-4 border-slate-300 dark:border-slate-600 border-t-green-500 rounded-full"></div>
                                                <span className="text-xs text-slate-400">Loading Market Data...</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Time Range Selector */}
                                    <div className="flex justify-center gap-2 mt-4 md:mt-5 relative z-10 flex-wrap">
                                        {(['1D', '1W', '1M', '1Y'] as TimeRange[]).map(r => (
                                            <button 
                                                key={r} 
                                                onClick={() => setGraphTimeRange(r)}
                                                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[11px] md:text-xs font-bold transition-all duration-300 ${graphTimeRange === r 
                                                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/40' 
                                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                }`}
                                            >
                                                {r === '1D' ? 'Today' : r === '1W' ? 'Week' : r === '1M' ? 'Month' : 'Year'}
                                            </button>
                                        ))}
                                    </div>
                                    
                                    {/* Data Source Reference */}
                                    <div className="mt-4 md:mt-5 pt-3 md:pt-4 border-t border-slate-100 dark:border-slate-800 relative z-10">
                                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] md:text-xs text-slate-400">📊 Source:</span>
                                                <span className="text-[10px] md:text-xs font-medium text-slate-600 dark:text-slate-400">eNAM, AGMARKNET</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-[10px] md:text-xs text-slate-400">
                                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full shrink-0"></span>
                                                <span>Updated: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 2.5 Live Prices Ticker - Premium Cards */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center px-1">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                        <h3 className="font-bold text-base text-slate-900 dark:text-white">Live Prices</h3>
                                    </div>
                                    <button onClick={() => setActiveTab('market')} className="text-green-600 text-xs font-bold hover:underline flex items-center gap-1">
                                        View All <span>→</span>
                                    </button>
                                </div>
                                
                                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
                                    {showSkeleton ? (
                                        [1, 2, 3, 4].map(i => <Skeleton key={i} className="min-w-[140px] h-[130px] rounded-2xl shrink-0" />)
                                    ) : (
                                        marketData && marketData.length > 0 ? (
                                            marketData.map((item, idx) => (
                                                <div 
                                                    key={idx} 
                                                    className="min-w-[140px] bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-lg flex flex-col justify-between animate-fadeIn hover:shadow-xl hover:scale-[1.02] transition-all duration-300 shrink-0 relative overflow-hidden group"
                                                >
                                                    {/* Background Gradient */}
                                                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                                                        item.trend === 'up' ? 'bg-gradient-to-br from-green-500/5 to-transparent' : 
                                                        item.trend === 'down' ? 'bg-gradient-to-br from-red-500/5 to-transparent' : 
                                                        'bg-gradient-to-br from-slate-500/5 to-transparent'
                                                    }`}></div>
                                                    
                                                    <div className="relative z-10">
                                                        <div className="flex justify-between items-start mb-3">
                                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[85px]">{item.crop}</span>
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5 ${
                                                                item.trend === 'up' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 
                                                                item.trend === 'down' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' : 
                                                                'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                                            }`}>
                                                                {item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : '•'}
                                                            </span>
                                                        </div>
                                                        <p className="text-xl font-black text-slate-900 dark:text-white">{item.price.split('/')[0]}</p>
                                                        <p className="text-[10px] text-slate-400 font-medium">/quintal</p>
                                                    </div>
                                                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 relative z-10">
                                                        <span className="text-[9px] text-slate-400 truncate block">📍 {item.mandi || 'Local Mandi'}</span>
                                                    </div>
                                                </div>
                                            ))
                                        ) : ([1,2,3,4].map(i => <div key={i} className="min-w-[140px] h-[130px] bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse shrink-0"></div>))
                                    )}
                                </div>
                            </div>

                            {/* 3. My Crops Tracking - Premium Cards */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center px-1">
                                    <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                                        <span className="text-lg">🌾</span> My Crops
                                    </h3>
                                    <button onClick={() => onNavigateToCropPlanner?.()} className="text-green-600 text-xs font-bold hover:underline flex items-center gap-1">
                                        Manage <span>→</span>
                                    </button>
                                </div>
                                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
                                    {showSkeleton ? (
                                        [1, 2].map(i => <Skeleton key={i} className="min-w-[280px] h-[120px] rounded-2xl shrink-0" />)
                                    ) : (
                                        activePlans.length === 0 ? (
                                            <div className="w-full p-8 text-center bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-dashed border-green-200 dark:border-green-800 rounded-3xl animate-fadeIn">
                                                <div className="w-14 h-14 mx-auto bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-green-500/30 mb-3">🌱</div>
                                                <p className="text-slate-600 dark:text-slate-400 text-sm mb-2">No active crop plans yet</p>
                                                <button onClick={() => onNavigateToCropPlanner?.()} className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transition-all">
                                                    Start Your First Plan →
                                                </button>
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
                                                    className="min-w-[280px] bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-lg flex gap-4 items-center cursor-pointer hover:shadow-xl hover:scale-[1.01] hover:border-green-500/50 transition-all duration-300 animate-fadeIn shrink-0 group relative overflow-hidden"
                                                >
                                                    {/* Background Gradient */}
                                                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                    
                                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-700 relative overflow-hidden flex items-center justify-center shadow-inner ring-2 ring-white/50 dark:ring-slate-700/50">
                                                        {!isLowBandwidth ? (
                                                            <img src={cropImage} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-2xl">🌱</span>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0 relative z-10">
                                                        <h4 className="font-bold text-slate-900 dark:text-white truncate">{plan.cropName}</h4>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                                                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                                            <span className="truncate">{activeStage?.stageName}</span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2.5 overflow-hidden">
                                                            <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                                                        </div>
                                                        <div className="flex justify-between items-center mt-1">
                                                            <span className="text-[10px] text-slate-400 font-medium">{progress}% complete</span>
                                                            <span className="text-[10px] text-green-600 font-bold">→</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* 4. Recent Checks - Premium Style */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center px-1">
                                    <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                                        <span className="text-lg">🔬</span> Recent Scans
                                    </h3>
                                    <button onClick={onNavigateToHistory} className="text-green-600 text-xs font-bold hover:underline flex items-center gap-1">
                                        History <span>→</span>
                                    </button>
                                </div>
                                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
                                    {showSkeleton ? (
                                        [1, 2, 3].map(i => <Skeleton key={i} className="min-w-[150px] h-[170px] rounded-2xl shrink-0" />)
                                    ) : (
                                        recentScans.length === 0 ? (
                                            <div className="w-full p-6 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl animate-fadeIn">
                                                <span className="text-3xl mb-2 block">📷</span>
                                                <p className="text-slate-400 text-sm">No scans yet. Start by scanning a crop!</p>
                                            </div>
                                        ) : recentScans.map((scan, i) => {
                                            const isSoil = 'soilType' in scan;
                                            const title = isSoil ? (scan as SoilAnalysisResponse).soilType : (scan as DiagnosisResponse).disease_name_local;
                                            return (
                                                <div 
                                                    key={i} 
                                                    onClick={() => onOpenReport && onOpenReport(scan)}
                                                    className="min-w-[150px] bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-lg cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-300 animate-fadeIn shrink-0 group"
                                                >
                                                    <div className="h-24 bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                                                        {!isLowBandwidth && scan.imageUrl ? (
                                                            <img src={scan.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                        ) : (
                                                            <div className="flex items-center justify-center h-full text-3xl">{isSoil ? '🪨' : '🌿'}</div>
                                                        )}
                                                        <div className={`absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold rounded-full backdrop-blur-md ${isSoil ? 'bg-amber-500/90 text-white' : 'bg-green-500/90 text-white'}`}>
                                                            {isSoil ? 'Soil' : 'Crop'}
                                                        </div>
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                                                    </div>
                                                    <div className="p-3">
                                                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{title}</h4>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(scan.timestamp).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* 5. Combined News & Schemes - Premium Card */}
                            {showSkeleton ? (
                                <Skeleton className="h-80 w-full rounded-[2rem]" />
                            ) : (
                                <div className="relative bg-white dark:bg-slate-900 rounded-[2rem] p-5 shadow-xl border border-slate-100 dark:border-slate-800 animate-fadeIn overflow-hidden">
                                    {/* Decorative Background */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-3xl"></div>
                                    
                                    <div className="flex justify-between items-center mb-4 relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                                                <span className="text-lg">📢</span>
                                            </div>
                                            <div>
                                                <h3 className="text-base font-bold text-slate-900 dark:text-white">Latest Updates</h3>
                                                <p className="text-[10px] text-slate-500 font-medium">News & Schemes</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setActiveTab('schemes')} className="text-green-600 text-xs font-bold hover:underline flex items-center gap-1">
                                            All <span>→</span>
                                        </button>
                                    </div>
                                    <div className="space-y-3 relative z-10">
                                        {combinedUpdates.length === 0 ? <div className="h-20 bg-slate-50 rounded-xl animate-pulse"></div> : combinedUpdates.slice(0, 5).map((item: any, i) => (
                                            <div key={i} onClick={() => handleOpenContent(item, item.type === 'news' ? 'news' : 'scheme')} className="flex gap-3 cursor-pointer group p-2 -mx-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors animate-fadeIn">
                                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-md ${
                                                    item.type === 'news' 
                                                        ? 'bg-gradient-to-br from-blue-400 to-blue-600' 
                                                        : 'bg-gradient-to-br from-purple-400 to-purple-600'
                                                }`}>
                                                    <span className="text-white">{item.type === 'news' ? '📰' : '📜'}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-sm text-slate-800 dark:text-white line-clamp-1 leading-snug group-hover:text-green-600 transition-colors">{item.title || item.name}</h4>
                                                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{item.summary || item.benefit}</p>
                                                </div>
                                                <span className="text-green-600 text-sm opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => setActiveTab('schemes')} className="w-full mt-4 py-3 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-800/50 text-slate-600 dark:text-slate-400 font-bold rounded-xl text-sm hover:shadow-md transition-all flex items-center justify-center gap-2">
                                        <span>Explore More</span>
                                        <span className="text-green-600">→</span>
                                    </button>
                                </div>
                            )}

                            {/* PREVIOUS ALERTS (BOTTOM) */}
                            {seenAlerts.length > 0 && (
                                <div className="opacity-60 mt-6">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 px-1 tracking-wider">{t('alert_prev', lang)}</h4>
                                    <div className="space-y-2">
                                        {seenAlerts.map(alert => (
                                            <div key={alert.id} className="bg-slate-100/80 dark:bg-slate-800/50 rounded-xl p-3 flex items-start gap-3">
                                                <span className="text-slate-400 text-base">⚠️</span>
                                                <div>
                                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{alert.title}</p>
                                                    <p className="text-[10px] text-slate-400">{new Date(alert.timestamp).toLocaleDateString()}</p>
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
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-xl mx-auto space-y-4">
                            {/* Create Post Button - Premium */}
                            <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setShowPostModal(true)}
                                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl p-4 flex items-center justify-center gap-3 shadow-lg shadow-green-500/25 font-bold"
                            >
                                <span className="text-2xl">✍️</span>
                                <span>Share with Community</span>
                            </motion.button>

                            {showSkeleton ? (
                                [1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-2xl w-full" />)
                            ) : (
                                posts.length === 0 ? (
                                    <div className="text-center py-16">
                                        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-4xl mx-auto mb-4">
                                            👨‍🌾
                                        </div>
                                        <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-2">No Discussions Yet</h3>
                                        <p className="text-slate-500 dark:text-slate-400">Be the first to start a conversation!</p>
                                    </div>
                                ) : posts.map((post, idx) => (
                                    <motion.div 
                                        key={post.id} 
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="bg-white dark:bg-slate-900/80 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-700/50 overflow-hidden backdrop-blur-sm"
                                    >
                                        {/* Header - Messaging Style */}
                                        <div className="p-4 flex items-center gap-3">
                                            <div className="relative">
                                                <img 
                                                    src={post.author_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author}`} 
                                                    className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 p-0.5" 
                                                    loading="lazy" 
                                                />
                                                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-slate-900"></div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">{post.author}</h4>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-green-600 dark:text-green-400 font-semibold">🌾 Farmer</span>
                                                    <span className="text-slate-300 dark:text-slate-600">•</span>
                                                    <span className="text-xs text-slate-500">{post.author_loc}</span>
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-medium uppercase">{post.timestamp}</span>
                                        </div>

                                        {/* Content */}
                                        <div className="px-4 pb-3">
                                            <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed">{post.content}</p>
                                        </div>

                                        {/* Image if exists */}
                                        {post.image_url && (
                                            <div className="relative">
                                                <img src={post.image_url} className="w-full aspect-video object-cover" loading="lazy" />
                                            </div>
                                        )}

                                        {/* Quote style for short posts without image */}
                                        {(!post.image_url && post.content.length < 80) && (
                                            <div className="mx-4 mb-3 p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border-l-4 border-green-500">
                                                <p className="text-lg font-medium italic text-slate-700 dark:text-slate-300">"{post.content}"</p>
                                            </div>
                                        )}

                                        {/* Engagement Bar */}
                                        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <button className="flex items-center gap-1.5 text-slate-500 hover:text-red-500 transition-colors group">
                                                    <span className="text-lg group-hover:scale-110 transition-transform">❤️</span>
                                                    <span className="text-xs font-bold">{post.likes}</span>
                                                </button>
                                                <button className="flex items-center gap-1.5 text-slate-500 hover:text-blue-500 transition-colors group">
                                                    <span className="text-lg group-hover:scale-110 transition-transform">💬</span>
                                                    <span className="text-xs font-bold">{post.comments || 0}</span>
                                                </button>
                                                <button className="flex items-center gap-1.5 text-slate-500 hover:text-green-500 transition-colors group">
                                                    <span className="text-lg group-hover:scale-110 transition-transform">🔄</span>
                                                </button>
                                            </div>
                                            <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                                <span className="text-lg">🔖</span>
                                            </button>
                                        </div>
                                    </motion.div>
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
                                    <div key={i} className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800 hover:border-green-500 transition-all flex flex-col justify-between h-full relative group hover:shadow-lg">
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

            {/* WhatsApp Onboarding Modal */}
            <AnimatePresence>
                {showWhatsAppOnboarding && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
                        onClick={() => setShowWhatsAppOnboarding(false)}
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-xl"></div>
                                <div className="relative z-10 flex items-center gap-4">
                                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#25D366">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-white">WhatsApp Assistant</h2>
                                        <p className="text-white/80 text-sm font-medium">Fasal Rakshak on WhatsApp</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setShowWhatsAppOnboarding(false)}
                                    className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                            
                            {/* Steps Content */}
                            <div className="p-6">
                                <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 text-center">
                                    Get AI-powered crop diagnosis, weather alerts & farming tips directly on WhatsApp!
                                </p>
                                
                                {/* Step Cards */}
                                <div className="space-y-3">
                                    {/* Step 1 */}
                                    <motion.div 
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 }}
                                        className="flex gap-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border border-green-100 dark:border-green-800"
                                    >
                                        <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-white font-bold shrink-0 shadow-lg shadow-green-500/30">
                                            1
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1">Open WhatsApp</h4>
                                            <p className="text-xs text-slate-600 dark:text-slate-400">Click the button below to open WhatsApp chat</p>
                                        </div>
                                    </motion.div>
                                    
                                    {/* Step 2 */}
                                    <motion.div 
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.2 }}
                                        className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700"
                                    >
                                        <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold shrink-0">
                                            2
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1">Send Activation Code</h4>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Send this exact message to activate:</p>
                                            <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-green-300 dark:border-green-700 rounded-xl p-3 relative">
                                                <code className="text-green-600 dark:text-green-400 font-mono font-bold text-sm">join flame-harder</code>
                                                <button 
                                                    onClick={() => navigator.clipboard.writeText('join flame-harder')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-green-600 font-bold hover:underline"
                                                >
                                                    Copy
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                    
                                    {/* Step 3 */}
                                    <motion.div 
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.3 }}
                                        className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700"
                                    >
                                        <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold shrink-0">
                                            3
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1">Type "start"</h4>
                                            <p className="text-xs text-slate-600 dark:text-slate-400">After activation, type <code className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded font-mono font-bold">start</code> to begin using AI assistant</p>
                                        </div>
                                    </motion.div>
                                </div>
                                
                                {/* WhatsApp Number */}
                                <div className="mt-5 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-center">
                                    <p className="text-xs text-slate-500 mb-1">WhatsApp Number</p>
                                    <p className="font-mono font-bold text-slate-900 dark:text-white">+1 415 523 8886</p>
                                </div>
                                
                                {/* Action Button */}
                                <motion.a
                                    href="https://wa.me/14155238886?text=join%20flame-harder"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-5 w-full py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white font-bold rounded-2xl shadow-lg shadow-green-500/30 flex items-center justify-center gap-3 transition-all"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowWhatsAppOnboarding(false)}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="white">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                    </svg>
                                    Open WhatsApp & Activate
                                </motion.a>
                                
                                <p className="text-[10px] text-slate-400 text-center mt-4">
                                    🔒 Powered by Twilio. Your data is secure.
                                </p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
