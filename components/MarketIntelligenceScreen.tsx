
import Chart from 'chart.js/auto';
import React, { useEffect, useRef, useState } from 'react';
import { useMinimumLoading } from '../hooks/useMinimumLoading';
import { getRealMarketPrices } from '../services/agroService';
import { translateMarketData } from '../services/dashboardTranslationService';
import { t } from '../services/translationService';
import { Language, MarketItem, User } from '../types';
import { Skeleton } from './ui/Skeleton';

interface MarketIntelligenceScreenProps {
    user: User | null;
    lang: Language;
}

type TimeRange = '1D' | '1W' | '1M' | '1Y' | '3Y';

export const MarketIntelligenceScreen: React.FC<MarketIntelligenceScreenProps> = ({ user, lang }) => {
    const [loading, setLoading] = useState(true);
    const showSkeleton = useMinimumLoading(loading, 1500);
    const [myCropsPrices, setMyCropsPrices] = useState<MarketItem[]>([]);
    const [displayPrices, setDisplayPrices] = useState<MarketItem[]>([]); // Translated prices
    
    // Mandi Comparison State
    const [nearbyMandis, setNearbyMandis] = useState<MarketItem[]>([]);
    const [visibleMandisCount, setVisibleMandisCount] = useState(5);
    const [mandiViewMode, setMandiViewMode] = useState<'table' | 'map'>('table');
    const [mapFocus, setMapFocus] = useState<string>(''); // To focus specific mandi on map
    
    const [selectedCrop, setSelectedCrop] = useState<string>('');
    const [locationName, setLocationName] = useState("Local Mandi");
    const [userCoords, setUserCoords] = useState<{lat: number, lon: number} | null>(null);
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);

    // Graph State
    const [timeRange, setTimeRange] = useState<TimeRange>('1M');
    const [graphData, setGraphData] = useState<{labels: string[], prices: number[]}>({ labels: [], prices: [] });

    // AI Prediction State
    const [aiPrediction, setAiPrediction] = useState<{
        nextWeek: number;
        nextMonth: number;
        next3Months: number;
        confidence: number;
        trend: 'up' | 'down' | 'stable';
        factors: string[];
    } | null>(null);
    const [isPredicting, setIsPredicting] = useState(false);

    // Estimator State
    const [moisture, setMoisture] = useState(12);
    const [grainSize, setGrainSize] = useState(7);
    const [foreignMatter, setForeignMatter] = useState(2);
    const [estimatedRange, setEstimatedRange] = useState({ min: 2150, max: 2220 });
    const [isCalculating, setIsCalculating] = useState(false);

    // --- AI PREDICTION GENERATOR ---
    const generateAIPrediction = (basePrice: number, crop: string) => {
        setIsPredicting(true);
        
        // Simulate AI processing delay
        setTimeout(() => {
            // Seasonal factors based on crop
            const seasonalFactors: Record<string, { multiplier: number; trend: 'up' | 'down' | 'stable' }> = {
                'Rice': { multiplier: 1.08, trend: 'up' },
                'Wheat': { multiplier: 1.05, trend: 'up' },
                'Tomato': { multiplier: 0.92, trend: 'down' },
                'Potato': { multiplier: 1.03, trend: 'stable' },
                'Onion': { multiplier: 1.15, trend: 'up' },
                'Sugarcane': { multiplier: 1.02, trend: 'stable' },
                'Mango': { multiplier: 0.88, trend: 'down' },
                'Cotton': { multiplier: 1.06, trend: 'up' },
            };

            const cropFactor = seasonalFactors[crop] || { multiplier: 1.0, trend: 'stable' as const };
            const randomVariation = () => (Math.random() - 0.5) * 0.04; // ±2%

            const nextWeekPrice = Math.round(basePrice * (1 + randomVariation()) * 1.01);
            const nextMonthPrice = Math.round(basePrice * cropFactor.multiplier * (1 + randomVariation()));
            const next3MonthsPrice = Math.round(basePrice * Math.pow(cropFactor.multiplier, 1.5) * (1 + randomVariation()));

            const factors = [
                cropFactor.trend === 'up' ? '📈 Seasonal demand increasing' : cropFactor.trend === 'down' ? '📉 Post-harvest supply surge' : '📊 Stable market conditions',
                Math.random() > 0.5 ? '🌧️ Weather patterns favorable' : '☀️ Normal weather expected',
                Math.random() > 0.5 ? '🚛 Good transport availability' : '🏭 Processing demand steady',
                `📍 ${locationName} market trends positive`
            ];

            setAiPrediction({
                nextWeek: nextWeekPrice,
                nextMonth: nextMonthPrice,
                next3Months: next3MonthsPrice,
                confidence: Math.floor(75 + Math.random() * 20), // 75-95%
                trend: cropFactor.trend,
                factors: factors.slice(0, 3)
            });
            setIsPredicting(false);
        }, 1500);
    };

    // --- HELPER: Generate Mock Historical Data ---
    const generateHistoricalData = (basePrice: number, range: TimeRange) => {
        const labels: string[] = [];
        const prices: number[] = [];
        const now = new Date();
        let points = 0;
        let intervalDays = 0;
        let volatility = 0;

        switch (range) {
            case '1D': points = 12; intervalDays = 0; volatility = 0.01; break; // Hourlyish
            case '1W': points = 7; intervalDays = 1; volatility = 0.03; break;
            case '1M': points = 30; intervalDays = 1; volatility = 0.05; break;
            case '1Y': points = 12; intervalDays = 30; volatility = 0.15; break;
            case '3Y': points = 36; intervalDays = 30; volatility = 0.25; break;
        }

        for (let i = points - 1; i >= 0; i--) {
            const date = new Date(now);
            if (range === '1D') {
                date.setHours(date.getHours() - (i * 2)); // Every 2 hours
                labels.push(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            } else {
                date.setDate(date.getDate() - (i * intervalDays));
                if (range === '1Y' || range === '3Y') {
                    labels.push(date.toLocaleDateString([], { month: 'short', year: '2-digit' }));
                } else {
                    labels.push(date.toLocaleDateString([], { day: 'numeric', month: 'short' }));
                }
            }

            // Simulate price movement
            const seasonality = (range === '1Y' || range === '3Y') ? Math.sin(i / 2) * (basePrice * 0.1) : 0;
            const noise = (Math.random() - 0.5) * (basePrice * volatility);
            const p = Math.max(0, basePrice + seasonality + noise);
            prices.push(Math.round(p));
        }
        return { labels, prices };
    };

    // --- INITIAL DATA LOAD ---
    useEffect(() => {
        const loadIntelligence = async () => {
            setLoading(true);
            try {
                // Determine user crops
                const crops = user?.crops_grown?.length ? user.crops_grown : ["Rice", "Wheat", "Tomato"];
                
                // If selectedCrop is empty, set default
                if (!selectedCrop) setSelectedCrop(crops[0]);

                let locName = "India";
                let district = "Nagpur";
                let state = "Maharashtra";

                if (user?.location?.district) {
                    district = user.location.district;
                    state = user.location.state || "India";
                    locName = `${district}, ${state}`;
                    setUserCoords({ lat: user.location.lat, lon: user.location.lon });
                } else if ('geolocation' in navigator) {
                     navigator.geolocation.getCurrentPosition((pos) => {
                         setUserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
                     });
                }
                
                setLocationName(locName);

                // Fetch Prices - This now guarantees returning all profile crops
                const prices = await getRealMarketPrices(district, state, crops);
                
                // Enhance data
                const enhancedPrices: MarketItem[] = prices.map((p, index) => {
                    const basePrice = parseFloat(p.price.replace(/[^\d.]/g, '')) || 2200;
                    const trend: 'up' | 'down' | 'stable' = Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'stable' : 'down';
                    const changeVal = Math.floor(basePrice * (Math.random() * 0.05));
                    
                    return {
                        ...p,
                        min_price: `₹${(basePrice * 0.9).toFixed(0)}`,
                        max_price: `₹${(basePrice * 1.1).toFixed(0)}`,
                        modal_price: `₹${basePrice}`,
                        confidence: 'High',
                        advice: trend === 'up' ? 'Sell Now' : 'Hold',
                        advice_reason: trend === 'up' ? "Prices are at a monthly high and demand in local market is surging." : "Prices falling due to excess supply, better to sell now.",
                        trend,
                        change: `${trend === 'up' ? '+' : '-'}₹${changeVal} (${((changeVal/basePrice)*100).toFixed(1)}%)`,
                        distance: p.distance || `${5 + (index * 12)}km`
                    };
                });

                setMyCropsPrices(enhancedPrices);
                setDisplayPrices(enhancedPrices);

            } catch (e) {
                console.error("Market Intel Error", e);
            } finally {
                setLoading(false);
            }
        };
        loadIntelligence();
    }, [user, user?.crops_grown]); // Watch user crops change

    // --- TRANSLATION EFFECT ---
    useEffect(() => {
        if (myCropsPrices.length === 0) return;
        
        if (lang === 'en') {
            setDisplayPrices(myCropsPrices);
        } else {
            // Translate the data
            translateMarketData(myCropsPrices, lang).then(translated => {
                setDisplayPrices(translated);
            });
        }
    }, [lang, myCropsPrices]);

    // --- REGENERATING DATA WHEN CROP CHANGES ---
    useEffect(() => {
        if (!selectedCrop || displayPrices.length === 0) return;

        // 1. Get the current active crop details (from display prices for consistent text)
        const activeItem = displayPrices.find(c => c.crop === selectedCrop) || displayPrices[0];
        // Use raw price from myCropsPrices to ensure numeric parsing works even if display is translated (though price usually isn't)
        const rawItem = myCropsPrices.find(c => c.crop === selectedCrop) || myCropsPrices[0];
        
        const basePrice = parseFloat(rawItem.price.replace(/[^\d.]/g, '')) || 2000;
        
        // 2. Generate Historical Graph Data for selected crop
        const { labels, prices } = generateHistoricalData(basePrice, timeRange);
        setGraphData({ labels, prices });

        // 3. Generate AI Prediction for selected crop
        generateAIPrediction(basePrice, selectedCrop);

        // 4. Generate Distinct Mandi Comparison Data for selected crop
        const district = locationName.split(',')[0] || "Local";
        
        const mandisList: MarketItem[] = [
            { 
                ...activeItem, 
                mandi: `${district} APMC (Main)`, 
                price: `₹${basePrice}`, 
                distance: '2km', 
                change: activeItem.change,
                trend: activeItem.trend 
            },
            { 
                ...activeItem, 
                mandi: `Kisan Mandi`, 
                price: `₹${Math.round(basePrice * 1.015)}`, 
                distance: '12km', 
                change: `+₹${Math.round(basePrice * 0.015)}`,
                trend: 'up' 
            },
            { 
                ...activeItem, 
                mandi: `Regional Hub`, 
                price: `₹${Math.round(basePrice * 0.98)}`, 
                distance: '25km', 
                change: `-₹${Math.round(basePrice * 0.02)}`,
                trend: 'down' 
            },
            { 
                ...activeItem, 
                mandi: `Export Zone`, 
                price: `₹${Math.round(basePrice * 1.05)}`, 
                distance: '45km', 
                change: `+₹${Math.round(basePrice * 0.05)}`,
                trend: 'up' 
            },
            { 
                ...activeItem, 
                mandi: `State Market`, 
                price: `₹${Math.round(basePrice * 0.95)}`, 
                distance: '80km', 
                change: `-₹${Math.round(basePrice * 0.05)}`,
                trend: 'down' 
            }
        ];
        
        setNearbyMandis(mandisList);

    }, [selectedCrop, timeRange, displayPrices, locationName]);

    // --- CHART RENDERING ---
    useEffect(() => {
        if (chartRef.current && graphData.prices.length > 0 && !showSkeleton) {
            const ctx = chartRef.current.getContext('2d');
            if (ctx) {
                if (chartInstance.current) {
                    chartInstance.current.destroy();
                }

                const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                gradient.addColorStop(0, 'rgba(22, 163, 74, 0.2)'); // Green 600 with opacity
                gradient.addColorStop(1, 'rgba(22, 163, 74, 0)');

                chartInstance.current = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: graphData.labels,
                        datasets: [{
                            label: t('mkt_head_rate', lang),
                            data: graphData.prices,
                            borderColor: '#16a34a', // Green 600
                            backgroundColor: gradient,
                            borderWidth: 2,
                            tension: 0.3,
                            fill: true,
                            pointRadius: timeRange === '1Y' || timeRange === '3Y' ? 2 : 3,
                            pointHoverRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index',
                            intersect: false,
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: 'rgba(15, 23, 42, 0.9)', // Slate 900
                                titleColor: '#fff',
                                bodyColor: '#fff',
                                padding: 10,
                                cornerRadius: 8,
                                displayColors: false,
                                callbacks: {
                                    label: (context) => `₹${context.parsed.y} ${t('mkt_quintal', lang)}`
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: false,
                                grid: {
                                    color: 'rgba(148, 163, 184, 0.1)', // Slate 400
                                },
                                ticks: {
                                    callback: (val) => '₹' + val,
                                    font: { size: 10 }
                                }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6, font: { size: 10 } }
                            }
                        }
                    }
                });
            }
        }
        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
        };
    }, [graphData, lang, showSkeleton]);

    // Update Estimator logic
    useEffect(() => {
        setIsCalculating(true);
        const timer = setTimeout(() => {
            const base = 2100;
            const moisturePenalty = Math.max(0, (moisture - 12) * 20);
            const grainBonus = (grainSize - 5) * 30;
            const foreignPenalty = foreignMatter * 25;
            
            const estimated = base - moisturePenalty + grainBonus - foreignPenalty;
            setEstimatedRange({ min: Math.floor(estimated * 0.98), max: Math.ceil(estimated * 1.02) });
            setIsCalculating(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [moisture, grainSize, foreignMatter]);

    const handleLoadMoreMandis = () => {
        setVisibleMandisCount(prev => Math.min(prev + 5, nearbyMandis.length));
    };

    const handleContactMandi = (mandiName: string) => {
        const text = `Hello, I want to inquire about ${selectedCrop} prices at ${mandiName}.`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const handleLocateMandi = (mandiName: string) => {
        const query = encodeURIComponent(mandiName);
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, '_blank');
    };

    const activeItem = displayPrices.find(c => c.crop === selectedCrop) || displayPrices[0];

    // Helper to translate advice enum
    const getAdviceText = (advice: string | undefined) => {
        if (!advice) return "";
        if (advice === 'Sell Now') return t('mkt_advice_sell_now', lang);
        if (advice === 'Hold') return t('mkt_advice_hold', lang);
        return t('mkt_advice_wait', lang);
    };

    // Filter to ensure UNIQUE CROPS in the top summary card list
    const uniqueDisplayPrices = React.useMemo(() => {
        const seen = new Set();
        return displayPrices.filter(item => {
            const k = item.crop;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    }, [displayPrices]);

    return (
        <div className="flex flex-col min-h-full bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-y-auto overflow-x-hidden custom-scrollbar font-display text-slate-900 dark:text-white pb-32 transition-colors duration-200">
            
            {/* Hero Header with Glassmorphism */}
            <div className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm">
                <div className="w-full px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                    <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 rounded-xl sm:rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xl sm:text-2xl shadow-lg shadow-green-500/30">
                                📊
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-base sm:text-xl lg:text-2xl font-black tracking-tight text-slate-900 dark:text-white truncate">{t('mkt_intro_title', lang)}</h1>
                                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{t('mkt_intro_desc', lang)}</p>
                            </div>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-1.5 text-[10px] sm:text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-semibold">
                            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse"></span>
                            <span className="hidden xs:inline">Live</span> Prices
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full px-3 sm:px-4 lg:px-6 py-4 sm:py-6 flex flex-col gap-4 sm:gap-6">
                
                {/* Quick Stats Bar - Scrollable on Mobile */}
                {!showSkeleton && (
                    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory sm:grid sm:grid-cols-4 sm:gap-3 sm:overflow-visible animate-fadeIn">
                        {uniqueDisplayPrices.slice(0, 4).map((item, idx) => (
                            <button 
                                key={idx} 
                                onClick={() => setSelectedCrop(item.crop)}
                                className={`flex-shrink-0 w-[140px] sm:w-auto snap-start relative overflow-hidden rounded-xl sm:rounded-2xl p-3 sm:p-4 transition-all duration-300 ${
                                    item.crop === selectedCrop 
                                        ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30' 
                                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                                }`}
                            >
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center justify-between">
                                        <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wide ${item.crop === selectedCrop ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                                            {item.crop}
                                        </span>
                                        <span className={`text-base sm:text-lg ${item.trend === 'up' ? (item.crop === selectedCrop ? 'text-green-200' : 'text-green-500') : (item.crop === selectedCrop ? 'text-red-200' : 'text-red-500')}`}>
                                            {item.trend === 'up' ? '↗' : '↘'}
                                        </span>
                                    </div>
                                    <p className={`text-lg sm:text-xl font-black ${item.crop === selectedCrop ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                        {item.modal_price}
                                    </p>
                                    <p className={`text-[10px] sm:text-xs font-semibold ${
                                        item.crop === selectedCrop 
                                            ? (item.trend === 'up' ? 'text-green-200' : 'text-red-200')
                                            : (item.trend === 'up' ? 'text-green-600' : 'text-red-500')
                                    }`}>
                                        {item.change}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
                
                {/* Main Chart Card */}
                {showSkeleton ? (
                    <Skeleton className="h-[350px] sm:h-[400px] w-full rounded-2xl sm:rounded-3xl" />
                ) : (
                    <div className="bg-white dark:bg-slate-800/50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-sm border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm animate-fadeIn">
                        {/* Chart Header */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">{t('mkt_price_history', lang)}</h2>
                                {/* Crop Selector Pill */}
                                <div className="relative inline-block">
                                    <select 
                                        className="appearance-none bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full pl-4 pr-10 py-2 text-sm font-bold cursor-pointer focus:ring-2 focus:ring-green-400 focus:ring-offset-2 shadow-lg shadow-green-500/20"
                                        value={selectedCrop}
                                        onChange={(e) => setSelectedCrop(e.target.value)}
                                    >
                                        {uniqueDisplayPrices.map(c => <option key={c.crop} value={c.crop}>{c.crop}</option>)}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white text-xs">▼</div>
                                </div>
                            </div>

                            {/* Time Range Pills */}
                            <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar">
                                {(['1D', '1W', '1M', '1Y', '3Y'] as TimeRange[]).map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setTimeRange(r)}
                                        className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                                            timeRange === r 
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                        }`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Price Display */}
                        <div className="flex flex-wrap items-baseline gap-2 sm:gap-4 mb-4 sm:mb-6">
                            <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white">{activeItem?.modal_price}</span>
                            <span className={`text-base sm:text-lg font-bold px-2 py-0.5 rounded-lg ${activeItem?.trend === 'up' ? 'text-green-600 bg-green-100 dark:bg-green-900/30' : 'text-red-500 bg-red-100 dark:bg-red-900/30'}`}>
                                {activeItem?.change}
                            </span>
                            <span className="text-xs sm:text-sm text-slate-400 font-medium">{t('mkt_quintal', lang)}</span>
                        </div>

                        {/* Chart Canvas */}
                        <div className="h-40 sm:h-48 lg:h-56 w-full">
                            <canvas ref={chartRef}></canvas>
                        </div>
                    </div>
                )}

                {/* AI Future Price Prediction Card */}
                {!showSkeleton && (
                    <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 rounded-2xl p-4 sm:p-5 shadow-xl shadow-purple-500/20 relative overflow-hidden animate-fadeIn">
                        {/* Decorative Elements */}
                        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-400/20 rounded-full blur-2xl"></div>
                        
                        <div className="relative z-10">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-3 sm:mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/20 flex items-center justify-center text-lg sm:text-xl">🤖</div>
                                    <div>
                                        <h3 className="text-sm sm:text-base font-bold text-white">AI Price Prediction</h3>
                                        <p className="text-[10px] sm:text-xs text-white/60">for {selectedCrop}</p>
                                    </div>
                                </div>
                                {aiPrediction && (
                                    <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-full">
                                        <span className="text-[10px] sm:text-xs text-white font-bold">{aiPrediction.confidence}%</span>
                                        <span className="text-[10px] text-white/70">confidence</span>
                                    </div>
                                )}
                            </div>

                            {isPredicting ? (
                                <div className="flex items-center justify-center py-6 sm:py-8">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <p className="text-xs text-white/70">Analyzing market trends...</p>
                                    </div>
                                </div>
                            ) : aiPrediction ? (
                                <>
                                    {/* Prediction Cards */}
                                    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4">
                                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2 sm:p-3 text-center">
                                            <p className="text-[10px] sm:text-xs text-white/60 font-medium">Next Week</p>
                                            <p className="text-base sm:text-xl font-black text-white">₹{aiPrediction.nextWeek}</p>
                                            <p className={`text-[10px] sm:text-xs font-bold ${aiPrediction.nextWeek > parseFloat(activeItem?.modal_price?.replace(/[^\d]/g, '') || '0') ? 'text-green-300' : 'text-red-300'}`}>
                                                {aiPrediction.nextWeek > parseFloat(activeItem?.modal_price?.replace(/[^\d]/g, '') || '0') ? '↗' : '↘'} 
                                                {Math.abs(((aiPrediction.nextWeek / parseFloat(activeItem?.modal_price?.replace(/[^\d]/g, '') || '1')) - 1) * 100).toFixed(1)}%
                                            </p>
                                        </div>
                                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2 sm:p-3 text-center">
                                            <p className="text-[10px] sm:text-xs text-white/60 font-medium">Next Month</p>
                                            <p className="text-base sm:text-xl font-black text-white">₹{aiPrediction.nextMonth}</p>
                                            <p className={`text-[10px] sm:text-xs font-bold ${aiPrediction.nextMonth > parseFloat(activeItem?.modal_price?.replace(/[^\d]/g, '') || '0') ? 'text-green-300' : 'text-red-300'}`}>
                                                {aiPrediction.nextMonth > parseFloat(activeItem?.modal_price?.replace(/[^\d]/g, '') || '0') ? '↗' : '↘'} 
                                                {Math.abs(((aiPrediction.nextMonth / parseFloat(activeItem?.modal_price?.replace(/[^\d]/g, '') || '1')) - 1) * 100).toFixed(1)}%
                                            </p>
                                        </div>
                                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-2 sm:p-3 text-center">
                                            <p className="text-[10px] sm:text-xs text-white/60 font-medium">3 Months</p>
                                            <p className="text-base sm:text-xl font-black text-white">₹{aiPrediction.next3Months}</p>
                                            <p className={`text-[10px] sm:text-xs font-bold ${aiPrediction.next3Months > parseFloat(activeItem?.modal_price?.replace(/[^\d]/g, '') || '0') ? 'text-green-300' : 'text-red-300'}`}>
                                                {aiPrediction.next3Months > parseFloat(activeItem?.modal_price?.replace(/[^\d]/g, '') || '0') ? '↗' : '↘'} 
                                                {Math.abs(((aiPrediction.next3Months / parseFloat(activeItem?.modal_price?.replace(/[^\d]/g, '') || '1')) - 1) * 100).toFixed(1)}%
                                            </p>
                                        </div>
                                    </div>

                                    {/* Factors */}
                                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3">
                                        {aiPrediction.factors.map((factor, i) => (
                                            <span key={i} className="bg-white/10 text-white text-[10px] sm:text-xs px-2 py-1 rounded-full font-medium">
                                                {factor}
                                            </span>
                                        ))}
                                    </div>
                                </>
                            ) : null}

                            {/* Disclaimer */}
                            <div className="flex items-start gap-2 bg-white/10 rounded-lg p-2 sm:p-2.5">
                                <span className="text-yellow-300 text-sm flex-shrink-0">⚠️</span>
                                <p className="text-[9px] sm:text-[10px] text-white/70 leading-relaxed">
                                    <span className="font-bold text-yellow-200">Disclaimer:</span> This is an AI-based prediction for educational purposes only. 
                                    Actual prices may vary based on market conditions, weather, government policies, and other factors. 
                                    Do not make financial decisions solely based on this prediction.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
                    {/* Left Column - 2/3 width on XL */}
                    <div className="xl:col-span-2 flex flex-col gap-6 lg:gap-8">
                        
                        {/* Mandi Price Comparison */}
                        {showSkeleton ? <Skeleton className="h-[350px] sm:h-[400px] w-full rounded-2xl" /> : (
                            <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm overflow-hidden backdrop-blur-sm animate-fadeIn">
                                <div className="p-4 sm:p-6 border-b border-slate-200/50 dark:border-slate-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                                    <div>
                                        <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <span className="text-xl">🏪</span> {t('mkt_comparison', lang)}
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('mkt_comp_desc', lang)} <span className="font-semibold text-green-600 dark:text-green-400">{selectedCrop}</span></p>
                                    </div>
                                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl">
                                        <button 
                                            onClick={() => setMandiViewMode('table')}
                                            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${mandiViewMode === 'table' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                                        >
                                            📋 {t('mkt_table', lang)}
                                        </button>
                                        <button 
                                            onClick={() => setMandiViewMode('map')}
                                            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${mandiViewMode === 'map' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
                                        >
                                            🗺️ {t('mkt_map', lang)}
                                        </button>
                                    </div>
                                </div>
                                
                                {mandiViewMode === 'table' ? (
                                    <>
                                        {/* Mobile Card View */}
                                        <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-700/50">
                                            {nearbyMandis.slice(0, visibleMandisCount).map((m, i) => (
                                                <div key={i} className="p-4 flex items-center gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-slate-900 dark:text-white truncate">{m.mandi}</p>
                                                        <p className="text-xs text-slate-500">{m.distance} away</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-slate-900 dark:text-white">{m.price}</p>
                                                        <p className={`text-xs font-semibold ${m.change?.includes('+') ? 'text-green-600' : m.change?.includes('-') ? 'text-red-500' : 'text-slate-400'}`}>{m.change}</p>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button 
                                                            onClick={() => handleContactMandi(m.mandi || 'Trader')}
                                                            className="p-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg"
                                                        >
                                                            📞
                                                        </button>
                                                        <button 
                                                            onClick={() => handleLocateMandi(m.mandi || 'Market')}
                                                            className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg"
                                                        >
                                                            📍
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        {/* Desktop Table View */}
                                        <div className="hidden sm:block overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50/80 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400 uppercase">
                                                        <th className="p-4 font-bold">{t('mkt_head_name', lang)}</th>
                                                        <th className="p-4 font-bold">{t('mkt_head_rate', lang)}</th>
                                                        <th className="p-4 font-bold">{t('mkt_head_dist', lang)}</th>
                                                        <th className="p-4 font-bold">{t('mkt_head_change', lang)}</th>
                                                        <th className="p-4 font-bold text-right">{t('mkt_head_actions', lang)}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="text-slate-900 dark:text-white text-sm divide-y divide-slate-100 dark:divide-slate-700/50">
                                                    {nearbyMandis.slice(0, visibleMandisCount).map((m, i) => (
                                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                            <td className="p-4">
                                                                <div className="font-bold">{m.mandi}</div>
                                                                <div className="text-xs text-slate-500">{m.crop}</div>
                                                            </td>
                                                            <td className="p-4 font-bold text-base">{m.price}</td>
                                                            <td className="p-4 text-slate-500">{m.distance}</td>
                                                            <td className={`p-4 font-bold ${m.change?.includes('+') ? 'text-green-600' : m.change?.includes('-') ? 'text-red-500' : 'text-slate-400'}`}>{m.change}</td>
                                                            <td className="p-4 text-right">
                                                                <div className="flex gap-2 justify-end">
                                                                    <button 
                                                                        onClick={() => handleContactMandi(m.mandi || 'Trader')}
                                                                        className="p-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-100 transition-colors"
                                                                        title={t('mkt_contact_trader', lang)}
                                                                    >
                                                                        📞
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleLocateMandi(m.mandi || 'Market')}
                                                                        className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 transition-colors"
                                                                        title={t('mkt_get_directions', lang)}
                                                                    >
                                                                        📍
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        
                                        {visibleMandisCount < nearbyMandis.length && (
                                            <div className="p-4 border-t border-slate-100 dark:border-slate-700/50 flex justify-center">
                                                <button onClick={handleLoadMoreMandis} className="text-green-600 font-bold text-sm hover:underline flex items-center gap-1">
                                                    {t('mkt_view_more', lang)} <span>↓</span>
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="w-full h-64 sm:h-80 lg:h-96 bg-slate-100 dark:bg-slate-900 relative">
                                        <iframe 
                                            width="100%" 
                                            height="100%" 
                                            style={{ border: 0 }} 
                                            loading="lazy" 
                                            allowFullScreen 
                                            src={`https://www.google.com/maps?q=${mapFocus ? mapFocus : `${selectedCrop}+mandi`}+near+${userCoords ? `${userCoords.lat},${userCoords.lon}` : locationName}&output=embed`}
                                        ></iframe>
                                        
                                        {/* Map Overlay Quick Select */}
                                        <div className="absolute top-3 left-3 right-3 flex gap-2 overflow-x-auto no-scrollbar">
                                            {nearbyMandis.slice(0, 5).map((m, i) => (
                                                <button 
                                                    key={i}
                                                    onClick={() => setMapFocus(m.mandi || "")}
                                                    className={`px-3 py-1.5 rounded-full shadow-lg text-xs font-bold whitespace-nowrap transition-all ${
                                                        mapFocus === m.mandi 
                                                            ? 'bg-green-600 text-white' 
                                                            : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 hover:bg-green-50 dark:hover:bg-slate-700'
                                                    }`}
                                                >
                                                    📍 {m.mandi}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Quality-Based Price Estimator - Improved */}
                        {showSkeleton ? <Skeleton className="h-48 sm:h-64 w-full rounded-2xl" /> : (
                            <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm p-4 sm:p-6 backdrop-blur-sm animate-fadeIn">
                                <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
                                    <span className="text-2xl">⚖️</span> {t('mkt_quality_est', lang)}
                                </h3>
                                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                                    {/* Upload Section */}
                                    <div className="lg:w-1/3 flex flex-col gap-3">
                                        <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl h-32 sm:h-40 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-green-400 transition-all group">
                                            <span className="text-3xl sm:text-4xl mb-2 group-hover:scale-110 transition-transform">📸</span>
                                            <p className="text-xs sm:text-sm font-bold text-slate-500 text-center px-2">{t('mkt_upload_photo', lang)}</p>
                                        </div>
                                        <p className="text-[10px] sm:text-xs text-center text-slate-400">{t('mkt_ai_analyze', lang)}</p>
                                    </div>
                                    
                                    {/* Sliders Section */}
                                    <div className="flex-1 flex flex-col gap-4 sm:gap-5">
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/30 rounded-xl p-3">
                                                <div className="flex justify-between text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                                                    <span>💧 {t('mkt_moisture', lang)}</span>
                                                    <span className={`${moisture > 14 ? 'text-red-500' : 'text-green-600'}`}>{moisture}%</span>
                                                </div>
                                                <input className="w-full accent-green-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" max="20" min="0" type="range" value={moisture} onChange={e => setMoisture(parseInt(e.target.value))}/>
                                            </div>
                                            <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/30 rounded-xl p-3">
                                                <div className="flex justify-between text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                                                    <span>🌾 {t('mkt_grain_size', lang)}</span>
                                                    <span className="text-green-600">{grainSize > 7 ? 'Bold' : grainSize > 4 ? 'Medium' : 'Small'}</span>
                                                </div>
                                                <input className="w-full accent-green-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" max="10" min="0" type="range" value={grainSize} onChange={e => setGrainSize(parseInt(e.target.value))}/>
                                            </div>
                                            <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/30 rounded-xl p-3">
                                                <div className="flex justify-between text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                                                    <span>🧹 {t('mkt_foreign_matter', lang)}</span>
                                                    <span className={`${foreignMatter > 2 ? 'text-red-500' : 'text-green-600'}`}>{foreignMatter}%</span>
                                                </div>
                                                <input className="w-full accent-green-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" max="10" min="0" type="range" value={foreignMatter} onChange={e => setForeignMatter(parseInt(e.target.value))}/>
                                            </div>
                                        </div>

                                        <div className={`p-4 rounded-xl border-2 transition-all duration-300 ${isCalculating ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' : 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800'}`}>
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                                <p className="text-xs sm:text-sm font-bold text-green-700 dark:text-green-400">{t('mkt_est_price', lang)}</p>
                                                <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                                                    {isCalculating ? (
                                                        <span className="text-base sm:text-lg text-slate-500 animate-pulse">{t('mkt_calc', lang)}</span>
                                                    ) : (
                                                        <>₹{estimatedRange.min} - ₹{estimatedRange.max} <span className="text-xs sm:text-sm font-normal text-slate-500">{t('mkt_quintal', lang)}</span></>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Right Column - Sidebar */}
                    <div className="flex flex-col gap-4 sm:gap-6">
                        
                        {/* AI Selling Advisor - Premium Card */}
                        {showSkeleton ? <Skeleton className="h-44 sm:h-52 w-full rounded-2xl" /> : (
                            activeItem && (
                                <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 rounded-2xl shadow-xl p-4 sm:p-6 relative overflow-hidden animate-fadeIn">
                                    {/* Decorative Elements */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/20 to-emerald-500/10 rounded-full blur-2xl"></div>
                                    <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-purple-500/10 rounded-full blur-xl"></div>
                                    
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-2 mb-3 sm:mb-4">
                                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-lg sm:text-xl">🤖</div>
                                            <h3 className="text-base sm:text-lg font-bold text-white">{t('mkt_ai_advisor', lang)}</h3>
                                        </div>
                                        
                                        <div className={`rounded-xl p-3 sm:p-4 mb-3 sm:mb-4 ${activeItem.advice === 'Sell Now' ? 'bg-green-500/20 border border-green-500/30' : 'bg-yellow-500/20 border border-yellow-500/30'}`}>
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <div className={`w-2.5 h-2.5 rounded-full ${activeItem.advice === 'Sell Now' ? 'bg-green-400' : 'bg-yellow-400'} animate-pulse`}></div>
                                                <span className={`text-sm sm:text-base font-bold ${activeItem.advice === 'Sell Now' ? 'text-green-400' : 'text-yellow-400'}`}>
                                                    {getAdviceText(activeItem.advice)}
                                                </span>
                                            </div>
                                            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{activeItem.advice_reason}</p>
                                        </div>
                                        
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase">{t('mkt_est_profit', lang)}</p>
                                                <p className="text-lg sm:text-xl font-black text-green-400">+12%</p>
                                            </div>
                                            <button className="bg-white text-slate-900 text-xs font-bold px-3 sm:px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors shadow-lg">
                                                {t('mkt_view_report', lang)}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        )}

                        {/* Negotiation Tips - Compact */}
                        {showSkeleton ? <Skeleton className="h-32 sm:h-40 w-full rounded-2xl" /> : (
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-2xl border border-orange-200/50 dark:border-orange-800/50 shadow-sm p-4 sm:p-5 animate-fadeIn">
                                <h3 className="text-sm sm:text-base font-bold mb-3 flex items-center gap-2 text-orange-800 dark:text-orange-300">
                                    <span>💡</span> {t('mkt_neg_tips', lang)}
                                </h3>
                                <ul className="flex flex-col gap-2.5">
                                    <li className="flex gap-2 items-start">
                                        <span className="text-orange-500 text-sm mt-0.5">✓</span>
                                        <p className="text-xs text-orange-900 dark:text-orange-100 leading-relaxed"><span className="font-bold">{t('mkt_tip_quality', lang)}:</span> {t('mkt_tip_quality_desc', lang)} ({moisture}%)</p>
                                    </li>
                                    <li className="flex gap-2 items-start">
                                        <span className="text-orange-500 text-sm mt-0.5">✓</span>
                                        <p className="text-xs text-orange-900 dark:text-orange-100 leading-relaxed"><span className="font-bold">{t('mkt_tip_lev', lang)}:</span> "{t('mkt_tip_lev_desc', lang)}"</p>
                                    </li>
                                </ul>
                            </div>
                        )}

                        {/* Quick Invoice - Compact */}
                        {showSkeleton ? <Skeleton className="h-56 sm:h-64 w-full rounded-2xl" /> : (
                            <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-sm p-4 sm:p-5 backdrop-blur-sm animate-fadeIn">
                                <h3 className="text-sm sm:text-base font-bold mb-3 sm:mb-4 text-slate-900 dark:text-white flex items-center gap-2">
                                    <span>📄</span> {t('mkt_invoice', lang)}
                                </h3>
                                <form className="flex flex-col gap-3">
                                    <div>
                                        <label className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{t('mkt_buyer', lang)}</label>
                                        <input className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-slate-900 dark:text-white placeholder-slate-400" placeholder="Enter name" type="text"/>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{t('mkt_qty', lang)}</label>
                                            <input className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-slate-900 dark:text-white placeholder-slate-400" placeholder="0" type="number"/>
                                        </div>
                                        <div>
                                            <label className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{t('mkt_rate_q', lang)}</label>
                                            <input className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-slate-900 dark:text-white placeholder-slate-400" placeholder="₹" type="number"/>
                                        </div>
                                    </div>
                                    <button className="mt-1 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-2.5 rounded-xl text-sm font-bold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg shadow-green-500/20" type="button">
                                        <span>📄</span> {t('mkt_gen_invoice', lang)}
                                    </button>
                                </form>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};
